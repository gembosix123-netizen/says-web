-- Align products table schema across environments.
-- Safe to run multiple times.

BEGIN;

-- Ensure canonical product columns exist.
ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS current_stock INTEGER DEFAULT 0;

-- Ensure ID is auto-generated when omitted by callers.
ALTER TABLE IF EXISTS public.products
  ALTER COLUMN id SET DEFAULT ('prod_' || replace(gen_random_uuid()::text, '-', ''));

-- Backfill null values for newly-aligned columns.
UPDATE public.products
SET
  is_active = COALESCE(is_active, TRUE),
  current_stock = COALESCE(current_stock, 0)
WHERE is_active IS NULL OR current_stock IS NULL;

-- Keep common filter fast for active products.
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products (is_active);

COMMIT;
