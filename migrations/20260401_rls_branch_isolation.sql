-- ============================================================================
-- MIGRATION: Row Level Security (RLS) — Branch Data Isolation
-- Date: 2026-04-01
-- Purpose: Ensure all tables are locked so that:
--          1. Anon key (client-side) has NO direct table access.
--          2. Only the server (service role / postgres) can read/write.
--          3. Branch-scoped data is enforced at the application layer via
--             server-side API routes; RLS here acts as a defence-in-depth
--             backstop preventing any accidental direct DB access.
-- Run in Supabase SQL editor (idempotent — safe to run multiple times)
-- ============================================================================

BEGIN;

-- ============================================================================
-- HELPER: drop all existing policies on a table before recreating
-- ============================================================================

-- ---- SALES TABLES ----
-- Use DO blocks so the script is safe even if a table was never created.

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sales_transactions',
    'sales_kinabatangan',   -- created by 20260209_split_sales.sql (may not exist)
    'sales_kota_kinabalu',  -- created by 20260209_split_sales.sql (may not exist)
    'sales_items'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "anon_no_access"           ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON %I', t);
      EXECUTE format('CREATE POLICY "anon_no_access"           ON %I FOR ALL TO anon          USING (false)',         t);
      EXECUTE format('CREATE POLICY "service_role_full_access" ON %I FOR ALL TO service_role  USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

-- ---- TRANSACTIONS (legacy Firestore mirror — may not exist) ----

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_no_access"          ON transactions;
    DROP POLICY IF EXISTS "service_role_full_access" ON transactions;
    CREATE POLICY "anon_no_access"           ON transactions FOR ALL TO anon          USING (false);
    CREATE POLICY "service_role_full_access" ON transactions FOR ALL TO service_role  USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---- CUSTOMERS ----

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','customers_kb','customers_kk','customers_archive'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "anon_no_access"           ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON %I', t);
      EXECUTE format('CREATE POLICY "anon_no_access"           ON %I FOR ALL TO anon          USING (false)',         t);
      EXECUTE format('CREATE POLICY "service_role_full_access" ON %I FOR ALL TO service_role  USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

-- ---- CUSTOMER OWNERSHIP ----

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_ownership_log') THEN
    ALTER TABLE customer_ownership_log ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_no_access"          ON customer_ownership_log;
    DROP POLICY IF EXISTS "service_role_full_access" ON customer_ownership_log;
    CREATE POLICY "anon_no_access"           ON customer_ownership_log FOR ALL TO anon          USING (false);
    CREATE POLICY "service_role_full_access" ON customer_ownership_log FOR ALL TO service_role  USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---- USERS ----

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_no_access"          ON users;
    DROP POLICY IF EXISTS "service_role_full_access" ON users;
    CREATE POLICY "anon_no_access"           ON users FOR ALL TO anon          USING (false);
    CREATE POLICY "service_role_full_access" ON users FOR ALL TO service_role  USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---- STORES & STORE VISITS ----

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['stores','store_visits'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "anon_no_access"           ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON %I', t);
      EXECUTE format('CREATE POLICY "anon_no_access"           ON %I FOR ALL TO anon          USING (false)',         t);
      EXECUTE format('CREATE POLICY "service_role_full_access" ON %I FOR ALL TO service_role  USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

-- ---- STORE AUDIT ----

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_audit_items') THEN
    ALTER TABLE store_audit_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_no_access"          ON store_audit_items;
    DROP POLICY IF EXISTS "service_role_full_access" ON store_audit_items;
    CREATE POLICY "anon_no_access"           ON store_audit_items FOR ALL TO anon          USING (false);
    CREATE POLICY "service_role_full_access" ON store_audit_items FOR ALL TO service_role  USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---- ORDERS ----

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_no_access"          ON orders;
    DROP POLICY IF EXISTS "service_role_full_access" ON orders;
    CREATE POLICY "anon_no_access"           ON orders FOR ALL TO anon          USING (false);
    CREATE POLICY "service_role_full_access" ON orders FOR ALL TO service_role  USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---- EXPENSES ----

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses') THEN
    ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_no_access"          ON expenses;
    DROP POLICY IF EXISTS "service_role_full_access" ON expenses;
    CREATE POLICY "anon_no_access"           ON expenses FOR ALL TO anon          USING (false);
    CREATE POLICY "service_role_full_access" ON expenses FOR ALL TO service_role  USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---- EXCHANGE RETURNS ----

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exchange_returns') THEN
    ALTER TABLE exchange_returns ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_no_access"          ON exchange_returns;
    DROP POLICY IF EXISTS "service_role_full_access" ON exchange_returns;
    CREATE POLICY "anon_no_access"           ON exchange_returns FOR ALL TO anon          USING (false);
    CREATE POLICY "service_role_full_access" ON exchange_returns FOR ALL TO service_role  USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---- INVENTORY MOVEMENTS ----

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_movements') THEN
    ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_no_access"          ON inventory_movements;
    DROP POLICY IF EXISTS "service_role_full_access" ON inventory_movements;
    CREATE POLICY "anon_no_access"           ON inventory_movements FOR ALL TO anon          USING (false);
    CREATE POLICY "service_role_full_access" ON inventory_movements FOR ALL TO service_role  USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---- PRODUCTS & PRICES ----

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','product_prices'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "anon_no_access"           ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON %I', t);
      EXECUTE format('CREATE POLICY "anon_no_access"           ON %I FOR ALL TO anon          USING (false)',         t);
      EXECUTE format('CREATE POLICY "service_role_full_access" ON %I FOR ALL TO service_role  USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

-- ---- WEEKLY / MONTHLY REPORTS ----

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['weekly_reports','monthly_report_history'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "anon_no_access"           ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON %I', t);
      EXECUTE format('CREATE POLICY "anon_no_access"           ON %I FOR ALL TO anon          USING (false)',         t);
      EXECUTE format('CREATE POLICY "service_role_full_access" ON %I FOR ALL TO service_role  USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

-- ---- DAY END REPORTS ----

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'day_end_report_files') THEN
    ALTER TABLE day_end_report_files ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_no_access"          ON day_end_report_files;
    DROP POLICY IF EXISTS "service_role_full_access" ON day_end_report_files;
    CREATE POLICY "anon_no_access"           ON day_end_report_files FOR ALL TO anon          USING (false);
    CREATE POLICY "service_role_full_access" ON day_end_report_files FOR ALL TO service_role  USING (true) WITH CHECK (true);
  END IF;
END $$;

-- day_end_closings (may exist depending on migration run order)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'day_end_closings') THEN
    ALTER TABLE day_end_closings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_no_access"          ON day_end_closings;
    DROP POLICY IF EXISTS "service_role_full_access" ON day_end_closings;
    CREATE POLICY "anon_no_access"           ON day_end_closings FOR ALL TO anon          USING (false);
    CREATE POLICY "service_role_full_access" ON day_end_closings FOR ALL TO service_role  USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. All tables now show "RLS enabled" in Supabase dashboard (no more
--    "UNRESTRICTED" warning).
-- 2. The service_role key (used by Next.js API routes) bypasses RLS by
--    design — branch enforcement for that key is done in application code.
-- 3. The anon key (used by client-side Supabase imports for file uploads and
--    Realtime subscriptions) has zero table-read access. Realtime channels
--    are used only for change notifications (scheduleRefresh callbacks), not
--    for direct data reads, so functionality is preserved.
-- 4. Supabase Storage bucket policies are separate and should be configured
--    in the dashboard under Storage → Policies.
-- ============================================================================
