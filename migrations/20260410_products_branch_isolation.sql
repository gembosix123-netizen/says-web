-- Enforce branch-level isolation for products.
-- Safe to run multiple times.

BEGIN;

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS branch TEXT;

UPDATE public.products
SET branch = COALESCE(NULLIF(branch, ''), 'HQ')
WHERE branch IS NULL OR branch = '';

ALTER TABLE IF EXISTS public.products
  ALTER COLUMN branch SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_branch_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_branch_check
      CHECK (branch IN ('Kota Kinabalu', 'Kinabatangan', 'HQ'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_branch ON public.products (branch);

-- If older schema had unique(code), replace with branch-scoped uniqueness.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_code_key'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      DROP CONSTRAINT products_code_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_branch_code_unique
  ON public.products (branch, code)
  WHERE code IS NOT NULL;

COMMIT;
