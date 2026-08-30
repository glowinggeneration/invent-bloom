-- Platform scaffolding for Application Build Master Rules adoption.
--
-- This migration adds four tables that back src/lib/platform/*: audit
-- logging, rate limiting, idempotency keys and AI observability. None of
-- them are wired into any existing feature yet — they exist so the next
-- feature that needs one of these controls doesn't have to invent the
-- schema from scratch. See docs/build-standards/EXCEPTION_REGISTER.md for
-- what still needs wiring, and src/lib/platform/README.md for how to use
-- each table.
--
-- Written against this project's existing conventions: public.has_role()
-- for role checks, public.current_org() for tenant scoping, RLS default
-- deny with explicit grants. Review before applying to production, per
-- Master Rules §7.1 — this is a proposed migration, not an instruction to
-- modify the database directly.

-- ---------------------------------------------------------------------
-- 1. Audit log (Master Rules §11.2): append-only, no UPDATE/DELETE grant
--    to any application role.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org text,
  action text NOT NULL,              -- e.g. 'role.grant', 'export.create', 'campaign.publish'
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

-- Only the service role writes and reads audit rows directly. App code
-- writes through log_audit_event() so a compromised user session can
-- still be logged even though it can't INSERT into the table itself.
GRANT ALL ON public.audit_log TO service_role;
REVOKE ALL ON public.audit_log FROM authenticated;
GRANT SELECT ON public.audit_log TO authenticated;

CREATE POLICY "Admins can read audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

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
  VALUES (auth.uid(), public.current_org(), _action, _resource_table, _resource_id, _metadata)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------
-- 2. Rate limiting (Master Rules §6.5): a shared hit-counter table so
--    limits survive across server instances and deploys, unlike an
--    in-memory Map.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_key text NOT NULL,      -- e.g. 'login:ip:1.2.3.4' or 'ai.generate:user:<uuid>'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_hits_bucket_idx
  ON public.rate_limit_hits (bucket_key, created_at DESC);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- Service role only: rate-limit accounting is an internal control, not
-- user-readable data.
GRANT ALL ON public.rate_limit_hits TO service_role;
REVOKE ALL ON public.rate_limit_hits FROM authenticated;

-- Old hits are cheap to keep briefly for debugging but should not grow
-- forever; callers are expected to prune via this function on a schedule
-- (e.g. a daily cron) rather than on every request.
CREATE OR REPLACE FUNCTION public.prune_rate_limit_hits(_older_than interval DEFAULT interval '7 days')
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_hits WHERE created_at < now() - _older_than;
$$;

GRANT EXECUTE ON FUNCTION public.prune_rate_limit_hits(interval) TO service_role;

-- ---------------------------------------------------------------------
-- 3. Idempotency keys (Master Rules §8.1): dedupe retried state-changing
--    requests (campaign sends, scheduled actions, exports).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_fingerprint text NOT NULL,  -- hash of the request payload, to detect a reused key with a different body
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

GRANT EXECUTE ON FUNCTION public.prune_idempotency_keys(interval) TO service_role;

-- ---------------------------------------------------------------------
-- 4. AI observability (Master Rules §9.8): one row per AI call.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org text,
  feature text NOT NULL,           -- e.g. 'campaign.draft_reply', 'smait.chat'
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
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
