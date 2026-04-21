-- Migration: Create exchange_returns table
-- Date: 2026-03-03
-- Purpose: Track product exchanges, returns, and disposals

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_exchange_returns_sale_id ON exchange_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_exchange_returns_type ON exchange_returns(type);
CREATE INDEX IF NOT EXISTS idx_exchange_returns_status ON exchange_returns(status);
CREATE INDEX IF NOT EXISTS idx_exchange_returns_branch ON exchange_returns(branch);
CREATE INDEX IF NOT EXISTS idx_exchange_returns_created_at ON exchange_returns(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_exchange_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_exchange_returns_updated_at
  BEFORE UPDATE ON exchange_returns
  FOR EACH ROW
  EXECUTE FUNCTION update_exchange_returns_updated_at();

-- Add comments to document the schema
COMMENT ON TABLE exchange_returns IS 'Tracks product exchanges, returns, and disposals';
COMMENT ON COLUMN exchange_returns.type IS 'Type: exchange (swap product), return (refund), disposal (damaged/expired)';
COMMENT ON COLUMN exchange_returns.reason IS 'Reason code: damaged, expired, wrong_item, customer_request, quality_issue, etc';
COMMENT ON COLUMN exchange_returns.status IS 'Status: pending (awaiting approval), approved, rejected, completed';
