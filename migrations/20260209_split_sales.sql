-- Migration: Split sales into region-specific tables and add sales_history view
-- Run this in Supabase SQL editor or psql connected to your project

BEGIN;

-- Create Kota Kinabalu sales table
CREATE TABLE IF NOT EXISTS public.sales_kota_kinabalu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice text UNIQUE NOT NULL,
  amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  items jsonb,
  item_name text,
  customer_name text,
  customer_id text,
  check_in_time timestamptz,
  gps_lat numeric,
  gps_long numeric,
  payment_method text,
  return_amount numeric DEFAULT 0,
  exchange_amount numeric DEFAULT 0,
  foc_amount numeric DEFAULT 0,
  proof_photo_url text,
  branch text DEFAULT 'Kota Kinabalu',
  created_at timestamptz DEFAULT now()
);

-- Create Kinabatangan sales table
CREATE TABLE IF NOT EXISTS public.sales_kinabatangan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice text UNIQUE NOT NULL,
  amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  items jsonb,
  item_name text,
  customer_name text,
  customer_id text,
  check_in_time timestamptz,
  gps_lat numeric,
  gps_long numeric,
  payment_method text,
  return_amount numeric DEFAULT 0,
  exchange_amount numeric DEFAULT 0,
  foc_amount numeric DEFAULT 0,
  proof_photo_url text,
  branch text DEFAULT 'Kinabatangan',
  created_at timestamptz DEFAULT now()
);

-- Optional: Create consolidated view for history (union of both)
CREATE OR REPLACE VIEW public.sales_history AS
SELECT id, invoice, total_amount as amount, branch, items, created_at FROM public.sales_kota_kinabalu
UNION ALL
SELECT id, invoice, total_amount as amount, branch, items, created_at FROM public.sales_kinabatangan;

-- Indexes to help time-range queries
CREATE INDEX IF NOT EXISTS idx_sales_kota_created_at ON public.sales_kota_kinabalu (created_at);
CREATE INDEX IF NOT EXISTS idx_sales_kin_created_at ON public.sales_kinabatangan (created_at);

COMMIT;

-- Notes:
-- 1) After running this migration, you can migrate existing `sales` rows into the correct table
--    by running INSERT INTO ... SELECT ... WHERE branch = 'Kota Kinabalu' / 'Kinabatangan'.
-- 2) Ensure `gen_random_uuid()` is available (pgcrypto or pgext installed). On Supabase it's available.
