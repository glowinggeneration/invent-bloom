CREATE TABLE public.managed_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  reporting_period_start date,
  reporting_period_end date,
  client text NOT NULL DEFAULT '',
  campaign text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  cover_image text,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'published',
  uploaded_by text NOT NULL DEFAULT 'SMAIT',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.managed_reports TO authenticated;
GRANT ALL ON public.managed_reports TO service_role;

ALTER TABLE public.managed_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read published managed reports"
ON public.managed_reports FOR SELECT TO authenticated
USING (status = 'published' OR (auth.jwt() ->> 'email') = 'ledimothabo@gmail.com');

CREATE TRIGGER managed_reports_updated_at
BEFORE UPDATE ON public.managed_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX managed_reports_uploaded_at_idx ON public.managed_reports (uploaded_at DESC);

CREATE POLICY "Admin manages managed report files"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'managed-reports' AND (auth.jwt() ->> 'email') = 'ledimothabo@gmail.com')
WITH CHECK (bucket_id = 'managed-reports' AND (auth.jwt() ->> 'email') = 'ledimothabo@gmail.com');