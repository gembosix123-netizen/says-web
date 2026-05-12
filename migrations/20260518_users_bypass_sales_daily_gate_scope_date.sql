-- Skop bypass: hanya tertunggak pada tarikh ini (paling awal) dibenarkan; tertunggak lain tidak dilindungi.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bypass_sales_daily_gate_scope_date date NULL;

COMMENT ON COLUMN public.users.bypass_sales_daily_gate_scope_date IS 'When bypass_sales_daily_gate is true: oldest pending daily-report date this bypass applies to; mismatch = gate still blocks.';
