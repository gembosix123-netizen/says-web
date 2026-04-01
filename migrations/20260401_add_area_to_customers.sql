-- Add area/district column to both customer tables for area-based analytics
ALTER TABLE public.customers_kb ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE public.customers_kk ADD COLUMN IF NOT EXISTS area TEXT;

-- Index for analytics queries by area
CREATE INDEX IF NOT EXISTS idx_customers_kb_area ON public.customers_kb(area);
CREATE INDEX IF NOT EXISTS idx_customers_kk_area ON public.customers_kk(area);

-- Add area column to sales tables for area-based analytics
ALTER TABLE public.sales_kota_kinabalu ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE public.sales_kinabatangan ADD COLUMN IF NOT EXISTS area TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_kb_area ON public.sales_kota_kinabalu(area);
CREATE INDEX IF NOT EXISTS idx_sales_kk_area ON public.sales_kinabatangan(area);
