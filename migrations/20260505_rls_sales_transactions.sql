-- ============================================================================
-- MIGRATION: RLS gap-fill for sales views, sales_history, stock_grants, and
--            customer_ownership_log_manual_*. Builds on top of
--            20260401_rls_branch_isolation.sql which already covered most
--            tables (sales_transactions, customers_kb, customers_kk, users,
--            stores, etc.).
-- Date: 2026-05-05
-- Idempotent — safe to run multiple times.
--
-- Why this exists:
--   The Supabase Table Editor still shows UNRESTRICTED on a handful of
--   tables/views that the previous migration missed. This file:
--     1. Re-asserts RLS lockdown on those objects.
--     2. Switches the sales_kinabatangan / sales_kota_kinabalu VIEWs to
--        `security_invoker = true` so RLS on the underlying sales_transactions
--        is honoured when the views are queried.
--
-- Server-side API routes use the service_role key which bypasses RLS by
-- design; branch enforcement for that key remains in application code
-- (lib/branchPermissions.ts + middleware.ts).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. SALES TABLES — re-assert lockdown (covers sales_transactions, sales_items,
--    sales_history, and the legacy split tables if still present as TABLEs)
-- ---------------------------------------------------------------------------
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sales_transactions',
    'sales_items',
    'sales_history',
    'sales_kinabatangan_legacy',
    'sales_kota_kinabalu_legacy'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t AND table_type = 'BASE TABLE'
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "anon_no_access"           ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON %I', t);
      EXECUTE format('CREATE POLICY "anon_no_access"           ON %I FOR ALL TO anon          USING (false)', t);
      EXECUTE format('CREATE POLICY "service_role_full_access" ON %I FOR ALL TO service_role  USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. SALES VIEWS — make them security_invoker so they honour RLS on the
--    underlying sales_transactions table. This removes the UNRESTRICTED badge
--    in the Supabase dashboard for the views.
-- ---------------------------------------------------------------------------
DO $$ DECLARE v TEXT;
BEGIN
  FOREACH v IN ARRAY ARRAY['sales_kinabatangan','sales_kota_kinabalu'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = v
    ) THEN
      EXECUTE format('ALTER VIEW %I SET (security_invoker = true)', v);
      EXECUTE format('REVOKE ALL ON %I FROM anon', v);
      EXECUTE format('GRANT  SELECT ON %I TO service_role', v);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. STOCK GRANTS / STOCK EDIT GRANTS
-- ---------------------------------------------------------------------------
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['stock_grants','stock_edit_grants'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t AND table_type = 'BASE TABLE'
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "anon_no_access"           ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON %I', t);
      EXECUTE format('CREATE POLICY "anon_no_access"           ON %I FOR ALL TO anon          USING (false)', t);
      EXECUTE format('CREATE POLICY "service_role_full_access" ON %I FOR ALL TO service_role  USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. CUSTOMER OWNERSHIP LOG VARIANTS (covers manual / archive variants the
--    previous migration missed).
-- ---------------------------------------------------------------------------
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name LIKE 'customer_ownership_log%'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_no_access"           ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON %I', t);
    EXECUTE format('CREATE POLICY "anon_no_access"           ON %I FOR ALL TO anon          USING (false)', t);
    EXECUTE format('CREATE POLICY "service_role_full_access" ON %I FOR ALL TO service_role  USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. CUSTOMERS — re-assert lockdown (covers customers, customers_kb,
--    customers_kk, customers_archive). Idempotent overlap with
--    20260401_rls_branch_isolation.sql is intentional.
-- ---------------------------------------------------------------------------
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','customers_kb','customers_kk','customers_archive'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t AND table_type = 'BASE TABLE'
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "anon_no_access"           ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON %I', t);
      EXECUTE format('CREATE POLICY "anon_no_access"           ON %I FOR ALL TO anon          USING (false)', t);
      EXECUTE format('CREATE POLICY "service_role_full_access" ON %I FOR ALL TO service_role  USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION (run after the migration; expected = 0 rows)
-- ============================================================================
-- SELECT n.nspname AS schema, c.relname AS table_name
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'r'                    -- ordinary tables only
--   AND NOT c.relrowsecurity                -- RLS not enabled
--   AND c.relname NOT LIKE 'pg_%'
-- ORDER BY c.relname;
-- ============================================================================
