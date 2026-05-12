-- OTP sekali guna untuk sahkan void invois (MVP: kod 6 digit, TTL 15 min, simpan plaintext — elakkan untuk produksi keras tanpa HTTPS)
BEGIN;

CREATE TABLE IF NOT EXISTS public.sales_void_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales_transactions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_void_otp_sale_unused
  ON public.sales_void_otp_challenges(sale_id)
  WHERE used_at IS NULL;

COMMENT ON TABLE public.sales_void_otp_challenges IS 'OTP pendek untuk pengesahan void; set VOID_OTP_REQUIRED=true pada env untuk wajibkan';

COMMIT;
