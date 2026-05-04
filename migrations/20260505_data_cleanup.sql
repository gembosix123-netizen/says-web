-- ============================================================================
-- MIGRATION: Data cleanup for legacy backdated imports
-- Date: 2026-05-05
-- Purpose:
--   C1. Fix sales_transactions where transaction_date year is 0001..0099
--       (caused by a 2-digit year in backdated import, e.g. "26" -> "0026").
--       Shift those rows by +2000 years -> 2001..2099.
--   C2. Reconcile customer_id NULL rows that still carry "[Customer: NAME]"
--       tags in notes. Match the tagged name against the **same table that
--       sales_transactions.customer_id FK references** (usually
--       public.customers_archive after 20260326_separate_customers_by_branch.sql
--       renamed `customers` → `customers_archive`). Joining public.customers
--       instead would assign branch IDs (e.g. CUST-KK-0002) that are not in
--       the FK parent and raise ERROR 23503.
--   C3. Audit-only: list sales_transactions with user_id IS NULL so the
--       business can decide on a "Legacy" attribution strategy. NO data
--       changes are applied; output is via RAISE NOTICE for the SQL editor.
--
-- Order of operations matters:
--   * Run AFTER 20260505_rls_sales_transactions.sql so RLS posture is final.
--   * The whole file is wrapped in a transaction. Convert COMMIT -> ROLLBACK
--     for a dry run.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Pre-flight counts (visible in SQL editor result panel via NOTICE)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  bad_dates INTEGER;
  null_customer_with_tag INTEGER;
  null_user INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_dates
  FROM sales_transactions
  WHERE EXTRACT(YEAR FROM transaction_date) BETWEEN 1 AND 99;

  SELECT COUNT(*) INTO null_customer_with_tag
  FROM sales_transactions
  WHERE customer_id IS NULL
    AND notes ILIKE '%[Customer:%';

  SELECT COUNT(*) INTO null_user
  FROM sales_transactions
  WHERE user_id IS NULL;

  RAISE NOTICE 'Pre-cleanup: bad_year_dates=%  null_customer_with_tag=%  null_user_id=%',
    bad_dates, null_customer_with_tag, null_user;
END $$;

-- ---------------------------------------------------------------------------
-- C1. Fix transaction_date year 0001..0099 -> 2001..2099
-- ---------------------------------------------------------------------------
UPDATE sales_transactions
SET transaction_date = transaction_date + INTERVAL '2000 years'
WHERE EXTRACT(YEAR FROM transaction_date) BETWEEN 1 AND 99;

-- Apply the same shift to created_at when it was filled from the bad year.
-- (We only touch rows where created_at is also clearly in the 0001..0099
-- range so we never damage normal rows.)
UPDATE sales_transactions
SET created_at = created_at + INTERVAL '2000 years'
WHERE created_at IS NOT NULL
  AND EXTRACT(YEAR FROM created_at) BETWEEN 1 AND 99;

-- ---------------------------------------------------------------------------
-- C2. Reconcile NULL customer_id from "[Customer: NAME]" tag
--
--     Matching key collapses both sides to lowercase alphanumeric only, so
--     "Sintong Enterprise" and "SINTONG  ENTERPRISE!" map to the same key.
--
--     FK parent table is chosen at runtime: prefer customers_archive (matches
--     typical constraint after branch-split migration), else fall back to customers.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customers_archive'
  ) THEN
    WITH tagged AS (
      SELECT
        s.id,
        lower(regexp_replace(
          coalesce((regexp_match(s.notes, '\[Customer:\s*(.*?)\]'))[1], ''),
          '[^a-z0-9]', '', 'gi'
        )) AS key
      FROM sales_transactions s
      WHERE s.customer_id IS NULL
        AND s.notes ILIKE '%[Customer:%'
    ),
    candidates AS (
      SELECT DISTINCT ON (t.id)
        t.id AS sale_id,
        ca.id AS canonical_id
      FROM tagged t
      INNER JOIN public.customers_archive ca
        ON lower(regexp_replace(ca.name, '[^a-z0-9]', '', 'gi')) = t.key
       AND t.key <> ''
      ORDER BY t.id, ca.id
    )
    UPDATE public.sales_transactions s
    SET
      customer_id = c.canonical_id,
      notes = NULLIF(
        btrim(regexp_replace(
          coalesce(s.notes, ''),
          '\s*\[Customer:\s*[^\]]*\]\s*', ' ', 'gi'
        )),
        ''
      )
    FROM candidates c
    WHERE s.id = c.sale_id;

  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) THEN
    WITH tagged AS (
      SELECT
        s.id,
        lower(regexp_replace(
          coalesce((regexp_match(s.notes, '\[Customer:\s*(.*?)\]'))[1], ''),
          '[^a-z0-9]', '', 'gi'
        )) AS key
      FROM sales_transactions s
      WHERE s.customer_id IS NULL
        AND s.notes ILIKE '%[Customer:%'
    ),
    candidates AS (
      SELECT DISTINCT ON (t.id)
        t.id AS sale_id,
        cu.id AS canonical_id
      FROM tagged t
      INNER JOIN public.customers cu
        ON lower(regexp_replace(cu.name, '[^a-z0-9]', '', 'gi')) = t.key
       AND t.key <> ''
      ORDER BY t.id, cu.id
    )
    UPDATE public.sales_transactions s
    SET
      customer_id = c.canonical_id,
      notes = NULLIF(
        btrim(regexp_replace(
          coalesce(s.notes, ''),
          '\s*\[Customer:\s*[^\]]*\]\s*', ' ', 'gi'
        )),
        ''
      )
    FROM candidates c
    WHERE s.id = c.sale_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- C3. Audit baris user_id IS NULL — diagnostic only.
--     Surfaces a per-branch breakdown so the team can decide whether to map
--     them to a "Legacy Import" service account or simply exclude from
--     commission calculations.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'C3 audit: rows with user_id IS NULL (per branch)';
  FOR rec IN
    SELECT branch, COUNT(*) AS cnt
    FROM sales_transactions
    WHERE user_id IS NULL
    GROUP BY branch
    ORDER BY cnt DESC
  LOOP
    RAISE NOTICE '  branch=%  count=%', rec.branch, rec.cnt;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Post-flight counts
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  bad_dates INTEGER;
  null_customer_with_tag INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_dates
  FROM sales_transactions
  WHERE EXTRACT(YEAR FROM transaction_date) BETWEEN 1 AND 99;

  SELECT COUNT(*) INTO null_customer_with_tag
  FROM sales_transactions
  WHERE customer_id IS NULL
    AND notes ILIKE '%[Customer:%';

  RAISE NOTICE 'Post-cleanup: bad_year_dates=%  null_customer_with_tag=%',
    bad_dates, null_customer_with_tag;
END $$;

COMMIT;

-- ============================================================================
-- DRY-RUN CHEAT SHEET
-- ============================================================================
-- 1. Replace the final COMMIT above with ROLLBACK and run the whole file in
--    Supabase SQL editor. The NOTICE blocks will still print and you can
--    review the post-cleanup numbers without persisting changes.
-- 2. After verifying, change ROLLBACK back to COMMIT and run again.
-- ============================================================================
