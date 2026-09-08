-- Multi-tenant SaaS conversion, Phase 2b: RLS rewrite + singleton -> PK.
--
-- Replaces every current RLS pattern (strict user_id = auth.uid(), the
-- fully-open "Shared workspace ..." USING (true) policies, the read-only
-- "Signed-in users can read ..." USING (true) cache policies, and the
-- org = 'team' literal comparisons baked into profiles/threads/
-- can_read_thread()) with one consistent shape:
-- private.can_access_workspace(workspace_id). Done against the existing
-- single tenant (Workspace 1, backfilled by Phase 1) before any second
-- workspace can exist, so a mistake here is a bug, not a live leak.
--
-- Exact policy names below were confirmed by reading the actual current-
-- state migrations (20260830210804, 20260830211506, 20260830211556,
-- 20260830211640, 20260907130000), not summarized from memory.

-- 1. workspace_settings / workspace_execution_state: singleton -> PK.
-- DROP COLUMN cascades the singleton column's own PRIMARY KEY and CHECK
-- constraints (both are single-column constraints on the column being
-- dropped). workspace_id was already backfilled to Workspace 1 by Phase 1.

ALTER TABLE public.workspace_settings DROP COLUMN singleton CASCADE;
ALTER TABLE public.workspace_settings ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.workspace_settings ADD PRIMARY KEY (workspace_id);

ALTER TABLE public.workspace_execution_state DROP COLUMN singleton CASCADE;
ALTER TABLE public.workspace_execution_state ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.workspace_execution_state ADD PRIMARY KEY (workspace_id);

-- Both tables remain client-inaccessible (no CREATE POLICY for
-- authenticated - REVOKE ALL FROM anon, authenticated already applies from
-- their original migrations and is unaffected by this column change).
-- Application code reads/writes them via the service-role client with an
-- explicit workspace_id filter, wired in Phase 2c.

-- 2. profiles / threads / messages: replace the org = 'team' literal
-- comparison with workspace membership.

CREATE OR REPLACE FUNCTION private.can_read_thread(_thread_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = _thread_id
      AND (
        t.user_id = auth.uid()
        OR (t.visibility = 'workspace' AND private.can_access_workspace(t.workspace_id))
      )
  )
$$;

DROP POLICY IF EXISTS "Own profile readable" ON public.profiles;
CREATE POLICY "Own profile readable" ON public.profiles FOR SELECT TO authenticated
USING ((id = auth.uid()) OR private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Read own or shared threads" ON public.threads;
CREATE POLICY "Read own or shared threads" ON public.threads FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR (visibility = 'workspace' AND private.can_access_workspace(workspace_id)));

-- profiles.org / threads.org and workspace_settings.workspace_email_domain
-- are deliberately left in place (not dropped) - this is the "migrate" step
-- of expand -> migrate -> contract, not the "contract" step. Removing the
-- now-unused org column is a later cleanup once this phase is verified live.

-- 3. Strict-per-user tables -> workspace-scoped, still owner-write-checked
-- where the original policy checked user_id on write.

DROP POLICY IF EXISTS "Owners can read their X accounts" ON public.x_accounts;
DROP POLICY IF EXISTS "Owners can create their X accounts" ON public.x_accounts;
DROP POLICY IF EXISTS "Owners can update their X accounts" ON public.x_accounts;
DROP POLICY IF EXISTS "Owners can delete their X accounts" ON public.x_accounts;
CREATE POLICY "Workspace members can read X accounts" ON public.x_accounts
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));
CREATE POLICY "Workspace members can create X accounts" ON public.x_accounts
FOR INSERT TO authenticated WITH CHECK (private.can_access_workspace(workspace_id));
CREATE POLICY "Workspace members can update X accounts" ON public.x_accounts
FOR UPDATE TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));
CREATE POLICY "Workspace members can delete X accounts" ON public.x_accounts
FOR DELETE TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "campaign_skip_audit_select" ON public.campaign_skip_audit;
CREATE POLICY "campaign_skip_audit_select" ON public.campaign_skip_audit
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

-- 4. Previously "Shared workspace ..." (USING (true) WITH CHECK (true))
-- tables -> real workspace scoping instead of "every authenticated user,
-- full stop."

DROP POLICY IF EXISTS "Shared workspace brand profiles" ON public.brand_profiles;
CREATE POLICY "Workspace members manage brand profiles" ON public.brand_profiles
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace campaigns" ON public.listening_campaigns;
CREATE POLICY "Workspace members manage campaigns" ON public.listening_campaigns
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace publish jobs" ON public.publish_jobs;
CREATE POLICY "Workspace members manage publish jobs" ON public.publish_jobs
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace campaign replies" ON public.campaign_replies;
CREATE POLICY "Workspace members manage campaign replies" ON public.campaign_replies
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace publish actions" ON public.publish_actions;
CREATE POLICY "Workspace members manage publish actions" ON public.publish_actions
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace scheduled actions" ON public.scheduled_actions;
CREATE POLICY "Workspace members manage scheduled actions" ON public.scheduled_actions
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace persona plans" ON public.persona_daily_plans;
CREATE POLICY "Workspace members manage persona plans" ON public.persona_daily_plans
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace persona posts" ON public.persona_daily_posts;
CREATE POLICY "Workspace members manage persona posts" ON public.persona_daily_posts
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace tweet metrics" ON public.tweet_metrics;
CREATE POLICY "Workspace members manage tweet metrics" ON public.tweet_metrics
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

-- 5. Previously global read-only caches (USING (true), SELECT only) ->
-- workspace-scoped reads. Writes to all of these already only ever come
-- from server-side/service-role code, unaffected by this change.

DROP POLICY IF EXISTS "Persona images readable by signed-in users" ON public.persona_images;
CREATE POLICY "Workspace members can read persona images" ON public.persona_images
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read persona state" ON public.persona_state;
CREATE POLICY "Workspace members can read persona state" ON public.persona_state
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read learning events" ON public.persona_learning_events;
CREATE POLICY "Workspace members can read learning events" ON public.persona_learning_events
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read collected mentions" ON public.apify_mentions;
CREATE POLICY "Workspace members can read collected mentions" ON public.apify_mentions
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read collected profiles" ON public.apify_profiles;
CREATE POLICY "Workspace members can read collected profiles" ON public.apify_profiles
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read source status" ON public.apify_source_status;
CREATE POLICY "Workspace members can read source status" ON public.apify_source_status
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read X mentions" ON public.x_mentions;
CREATE POLICY "Workspace members can read X mentions" ON public.x_mentions
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read overview intelligence" ON public.overview_intel;
CREATE POLICY "Workspace members can read overview intelligence" ON public.overview_intel
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read listening keywords" ON public.mention_keywords;
CREATE POLICY "Workspace members can read listening keywords" ON public.mention_keywords
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read news" ON public.news_articles;
CREATE POLICY "Workspace members can read news" ON public.news_articles
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read reports" ON public.reports;
CREATE POLICY "Workspace members can read reports" ON public.reports
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

-- managed_reports keeps its published/admin-email condition, but a
-- published report in one workspace must not be readable by a member of a
-- different workspace - workspace membership is now required either way.
DROP POLICY IF EXISTS "Signed-in users read published managed reports" ON public.managed_reports;
CREATE POLICY "Workspace members read published managed reports" ON public.managed_reports
FOR SELECT TO authenticated
USING (
  private.can_access_workspace(workspace_id)
  AND (status = 'published' OR (auth.jwt() ->> 'email') = 'ledimothabo@gmail.com')
);

-- 6. audit_log / ai_events: were gated on the (unused - see
-- EXCEPTION_REGISTER.md, user_roles has no populated rows in this app)
-- global admin role. Real admin visibility happens through the service-role
-- client with assertAdmin() already; this client-facing policy now lets any
-- workspace member read their own workspace's log instead of nobody being
-- able to (the role check was effectively unreachable). Tighter
-- owner/admin-only visibility can be layered in Phase 4 if wanted.

DROP POLICY IF EXISTS "Admins can read audit log" ON public.audit_log;
CREATE POLICY "Workspace members can read audit log" ON public.audit_log
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Admins can read AI events" ON public.ai_events;
CREATE POLICY "Workspace members can read AI events" ON public.ai_events
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

-- 7. NOT touched by this migration, deliberately:
-- - monitoring_watchlist, decision_log, rate_limit_hits, idempotency_keys:
--   already had zero client policies (service-role only); Phase 2c adds the
--   manual workspace_id filter in application code, RLS stays deny-all.
-- - x_login_attempts: explicit deny-all policy is correct regardless of
--   workspace and is left as-is.
-- - user_roles: unused identity scaffold, not tenant data - out of scope.

-- 8. Enforce workspace_id going forward on every table this phase touched
-- (Phase 1 already backfilled every existing row, so this is safe).

ALTER TABLE public.profiles ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.threads ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.messages ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.x_accounts ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.publish_jobs ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.publish_actions ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.x_login_attempts ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.persona_images ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tweet_metrics ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.persona_state ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.persona_learning_events ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.persona_daily_plans ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.persona_daily_posts ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.legal_reviews ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.listening_campaigns ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.campaign_replies ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.campaign_skip_audit ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.brand_profiles ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.external_profiles ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.mention_keywords ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.x_mentions ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.overview_intel ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.news_articles ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.apify_mentions ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.apify_profiles ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.apify_source_status ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.reports ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.managed_reports ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.scheduled_actions ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.monitoring_watchlist ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.decision_log ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.audit_log ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.rate_limit_hits ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.idempotency_keys ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.ai_events ALTER COLUMN workspace_id SET NOT NULL;
