BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT UNIQUE,
  actor_id TEXT,
  actor_username TEXT,
  actor_name TEXT,
  actor_role TEXT,
  actor_branch TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  branch TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'denied')),
  reason TEXT,
  reference_no TEXT,
  source_system TEXT NOT NULL DEFAULT 'web',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_event_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.audit_events(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT UNIQUE NOT NULL,
  module TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('csv', 'xlsx', 'sheet')),
  source_file_name TEXT,
  source_file_hash TEXT,
  period_start DATE,
  period_end DATE,
  branch TEXT,
  total_rows INT NOT NULL DEFAULT 0,
  success_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  duplicate_rows INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'partial', 'failed')),
  reason TEXT,
  imported_by TEXT,
  imported_role TEXT,
  imported_branch TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_events_module ON public.audit_events(module);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON public.audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_branch ON public.audit_events(branch);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_id ON public.audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_module_created_at ON public.audit_events(module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_changes_event_id ON public.audit_event_changes(event_id);

CREATE INDEX IF NOT EXISTS idx_audit_import_batches_module ON public.audit_import_batches(module);
CREATE INDEX IF NOT EXISTS idx_audit_import_batches_status ON public.audit_import_batches(status);
CREATE INDEX IF NOT EXISTS idx_audit_import_batches_created_at ON public.audit_import_batches(created_at DESC);

COMMIT;
