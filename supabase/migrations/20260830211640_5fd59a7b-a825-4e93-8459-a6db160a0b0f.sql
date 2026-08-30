CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org text,
  action text NOT NULL,
  resource_table text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_resource_idx ON public.audit_log (resource_table, resource_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.audit_log TO service_role;
REVOKE ALL ON public.audit_log FROM authenticated;
GRANT SELECT ON public.audit_log TO authenticated;

CREATE POLICY "Admins can read audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _resource_table text,
  _resource_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'log_audit_event requires an authenticated caller';
  END IF;

  INSERT INTO public.audit_log (actor_id, org, action, resource_table, resource_id, metadata)
  VALUES (auth.uid(), private.current_org(), _action, _resource_table, _resource_id, _metadata)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_hits_bucket_idx
  ON public.rate_limit_hits (bucket_key, created_at DESC);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.rate_limit_hits TO service_role;
REVOKE ALL ON public.rate_limit_hits FROM authenticated;

CREATE OR REPLACE FUNCTION public.prune_rate_limit_hits(_older_than interval DEFAULT interval '7 days')
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_hits WHERE created_at < now() - _older_than;
$$;

REVOKE EXECUTE ON FUNCTION public.prune_rate_limit_hits(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_rate_limit_hits(interval) TO service_role;

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx
  ON public.idempotency_keys (created_at DESC);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.idempotency_keys TO service_role;
REVOKE ALL ON public.idempotency_keys FROM authenticated;

CREATE OR REPLACE FUNCTION public.prune_idempotency_keys(_older_than interval DEFAULT interval '30 days')
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.idempotency_keys WHERE created_at < now() - _older_than;
$$;

REVOKE EXECUTE ON FUNCTION public.prune_idempotency_keys(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_idempotency_keys(interval) TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org text,
  feature text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text,
  correlation_id text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  retries integer NOT NULL DEFAULT 0,
  fallback_used boolean NOT NULL DEFAULT false,
  outcome text NOT NULL CHECK (outcome IN ('success', 'failure', 'timeout', 'rejected')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_events_created_at_idx ON public.ai_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_events_feature_idx ON public.ai_events (feature, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_events_user_idx ON public.ai_events (user_id, created_at DESC);

ALTER TABLE public.ai_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_events TO service_role;
REVOKE ALL ON public.ai_events FROM authenticated;
GRANT SELECT ON public.ai_events TO authenticated;

CREATE POLICY "Admins can read AI events" ON public.ai_events
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));