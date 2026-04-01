-- ============================================================================
-- MIGRATION: Product Prices Per Branch / Salesman
-- Date: 2026-04-01
-- Purpose: Allow different selling prices per branch or per salesman
-- Run in Supabase SQL editor (idempotent - safe to run multiple times)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  branch TEXT,            -- NULL = apply to all branches (used when salesman_id is also NULL = row is default override)
  salesman_id TEXT,       -- NULL = branch-level price; NOT NULL = salesman-specific price
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- A product can have one price per (branch, salesman) combination
  UNIQUE (product_id, branch, salesman_id)
);

COMMENT ON TABLE product_prices IS 'Price overrides per branch or salesman. Priority: salesman > branch > products.price (default)';
COMMENT ON COLUMN product_prices.branch IS 'Branch name, e.g. Kota Kinabalu, Kinabatangan, HQ. NULL = not scoped to branch.';
COMMENT ON COLUMN product_prices.salesman_id IS 'User ID of salesman. NULL = applies to all salesmen in the branch.';

CREATE INDEX IF NOT EXISTS idx_product_prices_product ON product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_branch ON product_prices(branch);
CREATE INDEX IF NOT EXISTS idx_product_prices_salesman ON product_prices(salesman_id);

-- Enable Row Level Security
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on product_prices" ON product_prices;
CREATE POLICY "Allow all on product_prices" ON product_prices FOR ALL USING (true);

CREATE OR REPLACE FUNCTION update_product_prices_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_prices_updated_at ON product_prices;
CREATE TRIGGER trg_product_prices_updated_at
  BEFORE UPDATE ON product_prices FOR EACH ROW
  EXECUTE FUNCTION update_product_prices_updated_at();

COMMIT;
