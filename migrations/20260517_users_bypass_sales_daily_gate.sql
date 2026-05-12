-- Main Admin boleh buka kunci jurujual: benarkan jualan baharu walaupun laporan harian tertunggak (kecemasan / pengecualian).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bypass_sales_daily_gate boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.bypass_sales_daily_gate IS 'When true (Sales only), skip daily-report gate for POST /api/sales and new-sale-eligibility.';
