CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL DEFAULT 'daily',
  report_date date NOT NULL,
  label text NOT NULL DEFAULT '',
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  status text NOT NULL DEFAULT 'generating',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversation jsonb NOT NULL DEFAULT '{}'::jsonb,
  campaigns jsonb NOT NULL DEFAULT '{}'::jsonb,
  personas jsonb NOT NULL DEFAULT '{}'::jsonb,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX reports_kind_period_idx
  ON public.reports (kind, report_date, period_start, period_end);
CREATE INDEX reports_date_idx ON public.reports (report_date DESC);

GRANT SELECT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read reports"
  ON public.reports FOR SELECT TO authenticated USING (true);

CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'fkf-daily-report',
  '55 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--9109f686-339e-417e-8f02-4cc5ee32daae.lovable.app/api/public/hooks/daily-report',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_ZhaswiLy51UBtCy0W8NazQ_gWGXzH2q"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);