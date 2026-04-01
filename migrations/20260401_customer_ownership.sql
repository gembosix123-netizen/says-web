-- ============================================================================
-- MIGRATION: Customer Ownership & Handover System
-- Date: 2026-04-01
-- Purpose:
--   - Setiap customer boleh ada pemilik (assigned_to = salesman user ID)
--   - Customer tanpa pemilik = company customer, sesiapa boleh buat sale
--   - Admin boleh assign + handover customer
--   - Duplicate detection via phone/name
--   - Full audit log untuk setiap pertukaran pemilik
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Tambah ownership columns pada customers_kb (Kinabatangan)
-- ============================================================================
ALTER TABLE customers_kb
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,           -- salesman user ID
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,      -- snapshot nama salesman
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'Sabah',
  ADD COLUMN IF NOT EXISTS geo_group TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_kb_assigned_to ON customers_kb(assigned_to);

-- ============================================================================
-- 2. Tambah ownership columns pada customers_kk (Kota Kinabalu)
-- ============================================================================
ALTER TABLE customers_kk
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'Sabah',
  ADD COLUMN IF NOT EXISTS geo_group TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_kk_assigned_to ON customers_kk(assigned_to);

-- ============================================================================
-- 3. Tambah assigned_districts pada users (salesman coverage area)
-- ============================================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS assigned_districts TEXT[] DEFAULT '{}';

COMMENT ON COLUMN users.assigned_districts IS 'Array of districts this salesman covers e.g. {Beaufort, Kota Belud}';

-- ============================================================================
-- 4. Customer ownership audit log
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer_ownership_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  customer_table TEXT NOT NULL CHECK (customer_table IN ('customers_kb', 'customers_kk')),
  from_salesman_id TEXT,
  from_salesman_name TEXT,
  to_salesman_id TEXT,
  to_salesman_name TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'assign',     -- admin assign customer kepada salesman
    'handover',   -- salesmanA serah kepada salesmanB / admin handover
    'release',    -- buang pemilik, jadi company customer semula
    'self_add'    -- salesman sendiri tambah customer baru
  )),
  reason TEXT,
  done_by TEXT NOT NULL,
  done_by_name TEXT,
  branch TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cust_own_log_customer ON customer_ownership_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_own_log_from ON customer_ownership_log(from_salesman_id);
CREATE INDEX IF NOT EXISTS idx_cust_own_log_to ON customer_ownership_log(to_salesman_id);
CREATE INDEX IF NOT EXISTS idx_cust_own_log_branch ON customer_ownership_log(branch);

COMMENT ON TABLE customer_ownership_log IS 'Full audit trail: assign, handover, release customer ownership';

COMMIT;
