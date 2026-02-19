-- Migration: Add Merchandiser Role and Tables
-- Date: 2026-02-19
-- Description: Add Merchandiser role support, store visits tracking, and audit functionality

-- 1. Update users table to include Merchandiser role
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
  ADD CONSTRAINT users_role_check 
  CHECK (role IN ('Main Admin', 'Admin', 'Sales', 'Merchandiser'));

-- 2. Add allowed_stores column to users table for merchandiser assignments
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS allowed_stores JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN users.allowed_stores IS 'Array of customer IDs that merchandiser is allowed to visit';

-- 3. Create store_visits table
CREATE TABLE IF NOT EXISTS store_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchandiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  branch TEXT NOT NULL CHECK (branch IN ('Kota Kinabalu', 'Kinabatangan', 'HQ')),
  
  -- Visit tracking
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  gps_lat DECIMAL(10,8),
  gps_long DECIMAL(11,8),
  
  -- Staff information
  staff_name TEXT,
  staff_contact TEXT,
  
  -- Visit details
  visit_type TEXT DEFAULT 'audit' CHECK (visit_type IN ('audit', 'inspection', 'follow-up')),
  status TEXT DEFAULT 'in-progress' CHECK (status IN ('in-progress', 'completed', 'cancelled')),
  notes TEXT,
  
  -- Photos (array of URLs)
  photo_urls TEXT[],
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create store_audit_items table
CREATE TABLE IF NOT EXISTS store_audit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES store_visits(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  
  -- Stock status
  balance_stock INTEGER DEFAULT 0,
  expired_stock INTEGER DEFAULT 0,
  damaged_stock INTEGER DEFAULT 0,
  
  -- Condition notes
  condition_notes TEXT,
  photo_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_store_visits_merchandiser ON store_visits(merchandiser_id);
CREATE INDEX IF NOT EXISTS idx_store_visits_customer ON store_visits(customer_id);
CREATE INDEX IF NOT EXISTS idx_store_visits_branch ON store_visits(branch);
CREATE INDEX IF NOT EXISTS idx_store_visits_date ON store_visits(check_in_time);
CREATE INDEX IF NOT EXISTS idx_store_visits_status ON store_visits(status);
CREATE INDEX IF NOT EXISTS idx_store_visits_completed ON store_visits(check_out_time) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_store_visits_by_date_branch ON store_visits(check_in_time, branch);

CREATE INDEX IF NOT EXISTS idx_audit_items_visit ON store_audit_items(visit_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_product ON store_audit_items(product_id);

-- 6. Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Add trigger to store_visits
DROP TRIGGER IF EXISTS update_store_visits_updated_at ON store_visits;
CREATE TRIGGER update_store_visits_updated_at
    BEFORE UPDATE ON store_visits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Add comments for documentation
COMMENT ON TABLE store_visits IS 'Tracks merchandiser visits to customer stores';
COMMENT ON TABLE store_audit_items IS 'Detailed product audit items for each store visit';

COMMENT ON COLUMN store_visits.merchandiser_id IS 'User ID of merchandiser (or salesman doing merchandiser work)';
COMMENT ON COLUMN store_visits.customer_id IS 'Customer store being visited';
COMMENT ON COLUMN store_visits.check_in_time IS 'When merchandiser arrived at store (with GPS)';
COMMENT ON COLUMN store_visits.check_out_time IS 'When merchandiser completed visit';
COMMENT ON COLUMN store_visits.photo_urls IS 'Array of photo URLs from visit';

COMMENT ON COLUMN store_audit_items.balance_stock IS 'Current stock balance at store';
COMMENT ON COLUMN store_audit_items.expired_stock IS 'Count of expired products';
COMMENT ON COLUMN store_audit_items.damaged_stock IS 'Count of damaged/broken products';
