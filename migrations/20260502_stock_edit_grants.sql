BEGIN;

CREATE TABLE IF NOT EXISTS public.stock_edit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id TEXT NOT NULL,
  requester_name TEXT,
  requester_branch TEXT,
  approver_id TEXT,
  approver_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'denied')),
  duration_minutes INT NOT NULL DEFAULT 15,
  requested_duration_minutes INT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  reason_request TEXT,
  reason_approve TEXT,
  change_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_edit_grants_requester_status
  ON public.stock_edit_grants (requester_id, status);

CREATE INDEX IF NOT EXISTS idx_stock_edit_grants_expires_at
  ON public.stock_edit_grants (expires_at);

CREATE INDEX IF NOT EXISTS idx_stock_edit_grants_status_requested
  ON public.stock_edit_grants (status, requested_at DESC);

COMMENT ON TABLE public.stock_edit_grants IS 'Time-boxed approval for branch Admin to edit product freezer stock';

COMMIT;
