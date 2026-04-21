CREATE TABLE IF NOT EXISTS public.monthly_report_history (
	id TEXT PRIMARY KEY,
	month TEXT NOT NULL,
	branch TEXT NOT NULL DEFAULT 'all',
	status TEXT NOT NULL DEFAULT 'closed',
	submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	submitted_by TEXT NOT NULL,
	submitted_by_id TEXT,
	notes TEXT,
	snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_report_history_month
	ON public.monthly_report_history (month);

CREATE INDEX IF NOT EXISTS idx_monthly_report_history_branch
	ON public.monthly_report_history (branch);

CREATE INDEX IF NOT EXISTS idx_monthly_report_history_submitted_at
	ON public.monthly_report_history (submitted_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_report_history_month_branch
	ON public.monthly_report_history (month, branch);

CREATE OR REPLACE FUNCTION public.set_monthly_report_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_monthly_report_history_updated_at ON public.monthly_report_history;

CREATE TRIGGER trg_monthly_report_history_updated_at
BEFORE UPDATE ON public.monthly_report_history
FOR EACH ROW
EXECUTE FUNCTION public.set_monthly_report_history_updated_at();

ALTER TABLE public.monthly_report_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on monthly_report_history" ON public.monthly_report_history;

CREATE POLICY "Allow all on monthly_report_history"
ON public.monthly_report_history
FOR ALL
USING (true)
WITH CHECK (true);
