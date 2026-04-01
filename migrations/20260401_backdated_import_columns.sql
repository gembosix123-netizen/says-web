-- Migration: Add backdated import tracking columns to sales_transactions
-- Date: 2026-04-01
-- Purpose: Support backdated import feature — track which records were imported
--          manually and by whom.
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS)

ALTER TABLE public.sales_transactions
  ADD COLUMN IF NOT EXISTS is_backdated  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS imported_by   TEXT,
  ADD COLUMN IF NOT EXISTS imported_at   TIMESTAMPTZ;

COMMENT ON COLUMN public.sales_transactions.is_backdated IS 'TRUE = rekod diimport secara manual (backdated), bukan dari app live';
COMMENT ON COLUMN public.sales_transactions.imported_by  IS 'Nama/ID admin yang import rekod ini';
COMMENT ON COLUMN public.sales_transactions.imported_at  IS 'Masa import dilakukan';

CREATE INDEX IF NOT EXISTS idx_sales_is_backdated ON public.sales_transactions(is_backdated);
