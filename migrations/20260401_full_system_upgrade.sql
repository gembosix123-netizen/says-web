-- ============================================================================
-- MIGRATION: Full System Upgrade
-- Date: 2026-04-01
-- Purpose: Daerah filter, expenses, weekly reports, inventory movements,
--          day-end report archive, proof photo hardblock support
-- Run in Supabase SQL editor (idempotent - safe to run multiple times)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DAERAH (District) columns for customers & stores
-- ============================================================================
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'Sabah',
  ADD COLUMN IF NOT EXISTS geo_group TEXT;

COMMENT ON COLUMN stores.district IS 'e.g. Beaufort, Kota Belud, Lawas, Labuan';
COMMENT ON COLUMN stores.state IS 'e.g. Sabah, Labuan, Sarawak';
COMMENT ON COLUMN stores.geo_group IS 'e.g. Sabah Mainland, Labuan, Lawas Corridor';

-- customers_kb (Kinabatangan)
ALTER TABLE customers_kb
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'Sabah',
  ADD COLUMN IF NOT EXISTS geo_group TEXT;

-- customers_kk (Kota Kinabalu)
ALTER TABLE customers_kk
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'Sabah',
  ADD COLUMN IF NOT EXISTS geo_group TEXT;

-- Index for district filter queries
CREATE INDEX IF NOT EXISTS idx_stores_district ON stores(district);
CREATE INDEX IF NOT EXISTS idx_stores_geo_group ON stores(geo_group);
CREATE INDEX IF NOT EXISTS idx_customers_kb_district ON customers_kb(district);
CREATE INDEX IF NOT EXISTS idx_customers_kk_district ON customers_kk(district);

-- ============================================================================
-- 2. EXPENSES (Perbelanjaan semasa sales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch TEXT NOT NULL,
  district TEXT,
  salesman_id TEXT NOT NULL,
  salesman_name TEXT,
  related_sale_id UUID REFERENCES sales_transactions(id) ON DELETE SET NULL,
  related_invoice TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'minyak', 'tol', 'parking', 'makan', 'penginapan',
    'telefon', 'peralatan', 'lain-lain'
  )),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  receipt_image_urls JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  approved_by TEXT,
  approved_by_name TEXT,
  approved_at TIMESTAMPTZ,
  reject_reason TEXT,
  paid_at TIMESTAMPTZ,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch);
CREATE INDEX IF NOT EXISTS idx_expenses_salesman ON expenses(salesman_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();

COMMENT ON TABLE expenses IS 'Company expenses claimed by salesman during field operations';

-- ============================================================================
-- 3. INVENTORY MOVEMENTS (Stok baki + stok masuk freezer)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'sale_deduct',       -- stok tolak bila jualan
    'return_approved',   -- stok masuk balik bila return approved
    'carry_forward',     -- stok baki salesman bawa ke hari seterusnya
    'freezer_in',        -- stok baharu masuk freezer dari supplier
    'freezer_to_van',    -- stok keluar freezer masuk van salesman
    'van_to_freezer',    -- stok pulang dari van ke freezer
    'damage_write_off',  -- stok rosak dihapus kira
    'adjustment'         -- manual adjustment oleh admin
  )),
  source_ref TEXT,       -- invoice_id / refund_id / dayend_id
  product_id TEXT NOT NULL,
  product_name TEXT,
  qty NUMERIC(10,2) NOT NULL,
  from_bucket TEXT CHECK (from_bucket IN ('supplier','freezer','van','damaged','returned','adjustment')),
  to_bucket TEXT CHECK (to_bucket IN ('supplier','freezer','van','damaged','returned','adjustment')),
  movement_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_branch ON inventory_movements(branch);
CREATE INDEX IF NOT EXISTS idx_inv_mov_actor ON inventory_movements(actor_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_date ON inventory_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_inv_mov_product ON inventory_movements(product_id);

COMMENT ON TABLE inventory_movements IS 'Full audit trail of all stock movements: freezer, van, sale, return, carry-forward';

-- ============================================================================
-- 4. WEEKLY REPORTS ARCHIVE
-- ============================================================================
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_label TEXT NOT NULL,           -- e.g. "2026-W14"
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  branch TEXT NOT NULL,
  generated_by TEXT,
  generated_by_name TEXT,
  file_url TEXT,                      -- Excel URL in storage
  file_pdf_url TEXT,                  -- PDF URL in storage
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  total_gross_sales NUMERIC(14,2) DEFAULT 0,
  total_refund NUMERIC(14,2) DEFAULT 0,
  total_net_sales NUMERIC(14,2) DEFAULT 0,
  total_cash NUMERIC(14,2) DEFAULT 0,
  total_credit NUMERIC(14,2) DEFAULT 0,
  total_expense NUMERIC(14,2) DEFAULT 0,
  snapshot JSONB,                     -- full data snapshot saat close
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_branch ON weekly_reports(branch);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON weekly_reports(week_label);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_dates ON weekly_reports(date_start, date_end);

CREATE OR REPLACE FUNCTION update_weekly_reports_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_weekly_reports_updated_at ON weekly_reports;
CREATE TRIGGER trg_weekly_reports_updated_at
  BEFORE UPDATE ON weekly_reports FOR EACH ROW
  EXECUTE FUNCTION update_weekly_reports_updated_at();

-- ============================================================================
-- 5. DAY-END REPORT ARCHIVE (simpan fail excel/pdf harian)
-- ============================================================================
CREATE TABLE IF NOT EXISTS day_end_report_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  branch TEXT NOT NULL,
  salesman_id TEXT,
  salesman_name TEXT,
  generated_by TEXT,
  generated_by_name TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('xlsx','pdf')),
  total_gross_sales NUMERIC(14,2) DEFAULT 0,
  total_refund NUMERIC(14,2) DEFAULT 0,
  total_net_sales NUMERIC(14,2) DEFAULT 0,
  total_cash NUMERIC(14,2) DEFAULT 0,
  total_credit NUMERIC(14,2) DEFAULT 0,
  total_expense NUMERIC(14,2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  store_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dayend_files_date ON day_end_report_files(report_date);
CREATE INDEX IF NOT EXISTS idx_dayend_files_branch ON day_end_report_files(branch);
CREATE INDEX IF NOT EXISTS idx_dayend_files_salesman ON day_end_report_files(salesman_id);

COMMENT ON TABLE day_end_report_files IS 'Archive of generated daily/day-end Excel and PDF report files';

-- ============================================================================
-- 6. CREATE exchange_returns (if not exists) + PATCH: add proof photos + reject reason
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales_transactions(id) ON DELETE SET NULL,
  invoice VARCHAR(100),
  product_id VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  type VARCHAR(20) NOT NULL CHECK (type IN ('exchange', 'return', 'disposal')),
  reason VARCHAR(50) NOT NULL,
  reason_details TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  branch VARCHAR(50),
  requested_by VARCHAR(100),
  requested_by_name VARCHAR(255),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by VARCHAR(100),
  approved_by_name VARCHAR(255),
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  notes TEXT,
  proof_photo_urls JSONB DEFAULT '[]'::jsonb,
  reject_reason TEXT,
  unit_price NUMERIC(12,2) DEFAULT 0,
  customer_id TEXT,
  customer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchange_returns_sale_id ON exchange_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_exchange_returns_type ON exchange_returns(type);
CREATE INDEX IF NOT EXISTS idx_exchange_returns_status ON exchange_returns(status);
CREATE INDEX IF NOT EXISTS idx_exchange_returns_branch ON exchange_returns(branch);
CREATE INDEX IF NOT EXISTS idx_exchange_returns_created_at ON exchange_returns(created_at);

CREATE OR REPLACE FUNCTION update_exchange_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_exchange_returns_updated_at ON exchange_returns;
CREATE TRIGGER trigger_exchange_returns_updated_at
  BEFORE UPDATE ON exchange_returns FOR EACH ROW
  EXECUTE FUNCTION update_exchange_returns_updated_at();

-- Patch: add columns if table already existed without them
ALTER TABLE exchange_returns
  ADD COLUMN IF NOT EXISTS proof_photo_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT;

COMMENT ON COLUMN exchange_returns.proof_photo_urls IS 'Array of image URLs (gambar produk rosak/expired)';
COMMENT ON COLUMN exchange_returns.reject_reason IS 'Sebab admin tolak return request';

-- ============================================================================
-- 7. PATCH sales_transactions: add district + cash proof enforced flag
-- ============================================================================
ALTER TABLE sales_transactions
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS proof_enforced BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN sales_transactions.district IS 'District/daerah copied from store at time of sale';
COMMENT ON COLUMN sales_transactions.proof_enforced IS 'True = bukti gambar wajib untuk transaksi ini';

-- ============================================================================
-- 8. ENABLE ROW LEVEL SECURITY on all new tables
-- ============================================================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_end_report_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on expenses" ON expenses;
DROP POLICY IF EXISTS "Allow all on inventory_movements" ON inventory_movements;
DROP POLICY IF EXISTS "Allow all on weekly_reports" ON weekly_reports;
DROP POLICY IF EXISTS "Allow all on day_end_report_files" ON day_end_report_files;
DROP POLICY IF EXISTS "Allow all on exchange_returns" ON exchange_returns;

CREATE POLICY "Allow all on expenses" ON expenses FOR ALL USING (true);
CREATE POLICY "Allow all on inventory_movements" ON inventory_movements FOR ALL USING (true);
CREATE POLICY "Allow all on weekly_reports" ON weekly_reports FOR ALL USING (true);
CREATE POLICY "Allow all on day_end_report_files" ON day_end_report_files FOR ALL USING (true);
CREATE POLICY "Allow all on exchange_returns" ON exchange_returns FOR ALL USING (true);

COMMIT;
