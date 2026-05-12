-- Tarikh kutipan untuk invois kredit (bill_to_bill) yang diselesaikan kemudian —
-- digunakan oleh laporan harian "CASH PAID CUSTOMER" tanpa bergantung pada created_at sahaja.

ALTER TABLE public.sales_transactions
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

COMMENT ON COLUMN public.sales_transactions.paid_at IS 'Masa kutipan bayaran (tunai/pindahan) bagi invois yang asalnya kredit atau pembayaran kemudian';

CREATE INDEX IF NOT EXISTS idx_sales_transactions_paid_at ON public.sales_transactions(paid_at);
