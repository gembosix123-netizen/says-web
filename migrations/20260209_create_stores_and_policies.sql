-- Migration: Create stores table (for Supabase) and example RLS policies
-- Paste this into Supabase SQL editor and run

BEGIN;

-- Create stores table
CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  branch text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Example: create index
CREATE INDEX IF NOT EXISTS idx_stores_branch ON public.stores (branch);

-- Example Row Level Security (RLS) policies - adapt to your auth claims
-- Enable RLS
-- ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Allow admins full access (requires a claim 'role' set on JWT)
-- CREATE POLICY "Admins can manage stores" ON public.stores
--   USING (auth.role() = 'admin')
--   WITH CHECK (auth.role() = 'admin');

-- Allow read to authenticated users
-- CREATE POLICY "Authenticated can read stores" ON public.stores
--   FOR SELECT
--   USING (auth.role() IS NOT NULL);

COMMIT;

-- Note: Supabase uses 'auth.uid()' and JWT claims; replace auth.role() usage
-- with appropriate expressions like (current_setting('request.jwt.claim.role', true) = 'admin')
-- or use RLS helpers documented in Supabase.
