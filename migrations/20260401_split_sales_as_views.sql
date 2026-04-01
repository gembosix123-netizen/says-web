-- ============================================================================
-- MIGRATION: Consolidate sales tables + create branch-scoped VIEWs
-- Date: 2026-04-01
-- Problem: sales_transactions holds all real data; sales_kinabatangan and
--          sales_kota_kinabalu are separate empty/legacy tables causing
--          commissions + day-end to show wrong data.
-- Solution:
--   1. Copy any legacy data from split tables into sales_transactions
--   2. Backfill NULL branch values
--   3. Add NOT NULL + CHECK constraints on branch
--   4. Rename split tables to _legacy (preserve data)
--   5. Create branch-scoped VIEWs with original names
-- Run in Supabase SQL editor. Idempotent — safe to run multiple times.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Copy any data from legacy split tables into sales_transactions
--         (only if those tables exist and have rows)
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_kinabatangan'
      AND table_type = 'BASE TABLE'
  ) THEN
    -- Add columns that exist in sales_transactions but not in old split table
    ALTER TABLE sales_kinabatangan
      ADD COLUMN IF NOT EXISTS user_id         TEXT,
      ADD COLUMN IF NOT EXISTS customer_id     TEXT,
      ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS subtotal_amount  NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS grand_total      NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS receipt_no       TEXT,
      ADD COLUMN IF NOT EXISTS billing_ref_no   TEXT,
      ADD COLUMN IF NOT EXISTS transfer_ref_no  TEXT,
      ADD COLUMN IF NOT EXISTS qr_txn_ref_no    TEXT,
      ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'completed',
      ADD COLUMN IF NOT EXISTS notes            TEXT,
      ADD COLUMN IF NOT EXISTS is_backdated     BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_locked        BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS imported_by      TEXT,
      ADD COLUMN IF NOT EXISTS imported_at      TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS salesman_name    TEXT,
      ADD COLUMN IF NOT EXISTS proof_photo_url  TEXT,
      ADD COLUMN IF NOT EXISTS proof_photo_urls JSONB,
      ADD COLUMN IF NOT EXISTS receipt_url      TEXT,
      ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

    ALTER TABLE sales_kinabatangan
      ALTER COLUMN branch SET DEFAULT 'Kinabatangan';

    -- Copy rows that don't already exist in sales_transactions
    INSERT INTO sales_transactions (
      id, invoice, branch, user_id, customer_id,
      transaction_date, subtotal_amount, grand_total,
      payment_method, status, notes, created_at
    )
    SELECT
      id,
      COALESCE(invoice, 'LEGACY-' || id::text),
      COALESCE(branch, 'Kinabatangan'),
      user_id,
      customer_id,
      COALESCE(transaction_date, created_at),
      COALESCE(subtotal_amount, total_amount, amount, 0),
      COALESCE(grand_total, total_amount, amount, 0),
      payment_method,
      COALESCE(status, 'completed'),
      notes,
      created_at
    FROM sales_kinabatangan
    WHERE NOT EXISTS (
      SELECT 1 FROM sales_transactions st WHERE st.id = sales_kinabatangan.id
    )
    ON CONFLICT (id) DO NOTHING;

  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_kota_kinabalu'
      AND table_type = 'BASE TABLE'
  ) THEN
    ALTER TABLE sales_kota_kinabalu
      ADD COLUMN IF NOT EXISTS user_id         TEXT,
      ADD COLUMN IF NOT EXISTS customer_id     TEXT,
      ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS subtotal_amount  NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS grand_total      NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS receipt_no       TEXT,
      ADD COLUMN IF NOT EXISTS billing_ref_no   TEXT,
      ADD COLUMN IF NOT EXISTS transfer_ref_no  TEXT,
      ADD COLUMN IF NOT EXISTS qr_txn_ref_no    TEXT,
      ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'completed',
      ADD COLUMN IF NOT EXISTS notes            TEXT,
      ADD COLUMN IF NOT EXISTS is_backdated     BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_locked        BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS imported_by      TEXT,
      ADD COLUMN IF NOT EXISTS imported_at      TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS salesman_name    TEXT,
      ADD COLUMN IF NOT EXISTS proof_photo_url  TEXT,
      ADD COLUMN IF NOT EXISTS proof_photo_urls JSONB,
      ADD COLUMN IF NOT EXISTS receipt_url      TEXT,
      ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

    ALTER TABLE sales_kota_kinabalu
      ALTER COLUMN branch SET DEFAULT 'Kota Kinabalu';

    INSERT INTO sales_transactions (
      id, invoice, branch, user_id, customer_id,
      transaction_date, subtotal_amount, grand_total,
      payment_method, status, notes, created_at
    )
    SELECT
      id,
      COALESCE(invoice, 'LEGACY-' || id::text),
      COALESCE(branch, 'Kota Kinabalu'),
      user_id,
      customer_id,
      COALESCE(transaction_date, created_at),
      COALESCE(subtotal_amount, total_amount, amount, 0),
      COALESCE(grand_total, total_amount, amount, 0),
      payment_method,
      COALESCE(status, 'completed'),
      notes,
      created_at
    FROM sales_kota_kinabalu
    WHERE NOT EXISTS (
      SELECT 1 FROM sales_transactions st WHERE st.id = sales_kota_kinabalu.id
    )
    ON CONFLICT (id) DO NOTHING;

  END IF;
END $$;

-- ============================================================================
-- STEP 2: Backfill NULL branch using salesman's branch from users table
-- ============================================================================

UPDATE sales_transactions st
SET branch = u.branch
FROM users u
WHERE st.user_id::text = u.id::text
  AND (st.branch IS NULL OR st.branch = '');

-- Any remaining NULLs default to Kota Kinabalu (safer default)
UPDATE sales_transactions
SET branch = 'Kota Kinabalu'
WHERE branch IS NULL OR branch = '';

-- ============================================================================
-- STEP 3: Add NOT NULL + CHECK constraint on branch
-- ============================================================================

ALTER TABLE sales_transactions
  ALTER COLUMN branch SET NOT NULL;

ALTER TABLE sales_transactions
  DROP CONSTRAINT IF EXISTS chk_sales_valid_branch;

ALTER TABLE sales_transactions
  ADD CONSTRAINT chk_sales_valid_branch
    CHECK (branch IN ('Kinabatangan', 'Kota Kinabalu'));

-- ============================================================================
-- STEP 4: Rename physical split tables to _legacy (safe, no data loss)
-- ============================================================================

DO $$ BEGIN
  -- Rename sales_kinabatangan → sales_kinabatangan_legacy
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_kinabatangan'
      AND table_type = 'BASE TABLE'
  ) THEN
    -- Drop the old sales_history view that unions the split tables
    DROP VIEW IF EXISTS public.sales_history CASCADE;
    ALTER TABLE sales_kinabatangan RENAME TO sales_kinabatangan_legacy;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_kota_kinabalu'
      AND table_type = 'BASE TABLE'
  ) THEN
    ALTER TABLE sales_kota_kinabalu RENAME TO sales_kota_kinabalu_legacy;
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Create branch-scoped VIEWs
-- ============================================================================

DROP VIEW IF EXISTS public.sales_kinabatangan CASCADE;
DROP VIEW IF EXISTS public.sales_kota_kinabalu CASCADE;
DROP VIEW IF EXISTS public.sales_history CASCADE;

CREATE VIEW public.sales_kinabatangan AS
  SELECT * FROM public.sales_transactions
  WHERE branch = 'Kinabatangan';

CREATE VIEW public.sales_kota_kinabalu AS
  SELECT * FROM public.sales_transactions
  WHERE branch = 'Kota Kinabalu';

-- Recreate union view for Main Admin
CREATE VIEW public.sales_history AS
  SELECT * FROM public.sales_transactions;

-- ============================================================================
-- STEP 6: Add index on branch for fast filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_transactions_branch
  ON public.sales_transactions(branch);

CREATE INDEX IF NOT EXISTS idx_sales_transactions_branch_date
  ON public.sales_transactions(branch, created_at);

COMMIT;

-- ============================================================================
-- RESULT
-- ============================================================================
-- • sales_transactions        → physical table, all data, enforced branch column
-- • sales_kinabatangan        → VIEW: only branch = 'Kinabatangan'
-- • sales_kota_kinabalu       → VIEW: only branch = 'Kota Kinabalu'
-- • sales_history             → VIEW: all branches (Main Admin)
-- • sales_kinabatangan_legacy → renamed old physical table (backup)
-- • sales_kota_kinabalu_legacy→ renamed old physical table (backup)
-- ============================================================================
