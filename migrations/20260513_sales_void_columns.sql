-- Void / audit columns for sales_transactions (idempotent)
BEGIN;

ALTER TABLE public.sales_transactions
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_remarks TEXT,
  ADD COLUMN IF NOT EXISTS original_grand_total DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS original_subtotal_amount DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS replacement_transaction_id UUID REFERENCES public.sales_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_transactions_voided_at ON public.sales_transactions(voided_at);

COMMENT ON COLUMN public.sales_transactions.voided_at IS 'Set when admin voids sale; amounts zeroed for accounting';
COMMENT ON COLUMN public.sales_transactions.original_grand_total IS 'Snapshot of grand_total before void (KPI / audit)';
COMMENT ON COLUMN public.sales_transactions.replacement_transaction_id IS 'New sale that replaces this row after correction';

COMMIT;
