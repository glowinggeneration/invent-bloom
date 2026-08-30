CREATE TABLE public.campaign_skip_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  campaign_id uuid,
  job_id uuid,
  run_ref text NOT NULL DEFAULT '',
  account_id uuid,
  handle text NOT NULL DEFAULT '',
  persona_name text NOT NULL DEFAULT '',
  reason text NOT NULL,
  detail text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.campaign_skip_audit TO authenticated;
GRANT ALL ON public.campaign_skip_audit TO service_role;

ALTER TABLE public.campaign_skip_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own skip audit"
  ON public.campaign_skip_audit FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own skip audit"
  ON public.campaign_skip_audit FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX campaign_skip_audit_user_created_idx
  ON public.campaign_skip_audit (user_id, created_at DESC);