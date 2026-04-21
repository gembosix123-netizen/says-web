-- Migration: Separate customers table by branch (KB and KK)
-- Date: 2026-03-26
-- Purpose: Isolate customers per branch for security and data separation

BEGIN;

-- 1. Create customers_kb table (Kota Kinabalu)
CREATE TABLE IF NOT EXISTS public.customers_kb (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  phone TEXT,
  address TEXT,
  town TEXT,
  outstandingBalance DECIMAL(12, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_kb_is_active ON public.customers_kb (is_active);
CREATE INDEX IF NOT EXISTS idx_customers_kb_name ON public.customers_kb (name);
CREATE INDEX IF NOT EXISTS idx_customers_kb_code ON public.customers_kb (code);

-- 2. Create customers_kk table (Kinabatangan)
CREATE TABLE IF NOT EXISTS public.customers_kk (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  phone TEXT,
  address TEXT,
  town TEXT,
  outstandingBalance DECIMAL(12, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_kk_is_active ON public.customers_kk (is_active);
CREATE INDEX IF NOT EXISTS idx_customers_kk_name ON public.customers_kk (name);
CREATE INDEX IF NOT EXISTS idx_customers_kk_code ON public.customers_kk (code);

-- 3. Migrate existing customers from 'customers' table if it exists
-- Safe migration: only if customers table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    INSERT INTO public.customers_kb (id, name, code, phone, address, town, is_active, created_at, updated_at)
    SELECT id, name, code, phone, address, town, is_active, COALESCE(created_at, now()), now()
    FROM public.customers
    ON CONFLICT (id) DO NOTHING;
    
    -- Backup old table
    ALTER TABLE IF EXISTS public.customers RENAME TO customers_archive;
  END IF;
END $$;

-- 4. Create empty customers_kk table (KK staff can start fresh)

-- 5. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.customers_kb TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customers_kk TO authenticated;

-- 6. Enable Row Level Security (RLS) for data isolation
ALTER TABLE public.customers_kb ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers_kk ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: Branch-based access control (permissive for now)
-- Application layer handles branch filtering via code
CREATE POLICY "Enable read for KB users" ON public.customers_kb
  FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for KB users" ON public.customers_kb
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for KB users" ON public.customers_kb
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete for KB users" ON public.customers_kb
  FOR DELETE
  USING (true);

CREATE POLICY "Enable read for KK users" ON public.customers_kk
  FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for KK users" ON public.customers_kk
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for KK users" ON public.customers_kk
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete for KK users" ON public.customers_kk
  FOR DELETE
  USING (true);

COMMIT;
