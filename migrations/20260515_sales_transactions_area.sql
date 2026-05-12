-- Kolum kawasan jualan (disimpan dari app semasa rekod jualan)
-- Migrasi lama (20260401_add_area_to_customers) hanya tambah `area` pada jadual split;
-- data kini dalam `sales_transactions` — pastikan kolum wujud supaya POST /api/sales kekal.

ALTER TABLE public.sales_transactions
  ADD COLUMN IF NOT EXISTS area TEXT;

COMMENT ON COLUMN public.sales_transactions.area IS 'Kawasan lawatan / sales area pada masa jualan (cth dari sales_area_today)';

CREATE INDEX IF NOT EXISTS idx_sales_transactions_area ON public.sales_transactions(area)
  WHERE area IS NOT NULL AND area <> '';
