-- Security reconciliation: converge on real per-workspace isolation
-- regardless of which prior migrations actually landed on this database.
--
-- Context: this migration's author (this session) never had live database
-- credentials and could only ever write migration files (20260909120000 -
-- 20260910150000, "Phase 1-4"), never run them. Separately, Lovable's own
-- agent (gpt-engineer-app[bot]) applied schema changes directly against the
-- live database on 2026-09-13 (20260913062400, 20260913062524) - including
-- one migration that reverts handle_new_user() and the profiles/threads RLS
-- policies to the old single-shared-workspace, org-based model, and
-- recreates workspace_settings with its old singleton-boolean primary key.
-- Whether Phase 1-4 were ever live, and what actually executed from the
-- 09-13 pair, is not knowable from static files - this migration does not
-- guess. Every statement below is written to be safe to run regardless of
-- which of those states the database is currently in, and converges it on
-- exactly one correct end state: every tenant-scoped table gated by
-- workspace_id membership (private.can_access_workspace()), with no
-- shared-workspace or org-literal fallback left reachable.
--
-- Every backfill UPDATE below is scoped to `WHERE workspace_id IS NULL`
-- (never unconditional) specifically so that re-running this migration can
-- never reassign a real self-serve tenant's rows back into the legacy
-- Workspace 1 - that would be a cross-tenant data corruption bug, not a fix.

-- =========================================================================
-- PART A: core tenancy tables (workspaces, workspace_members) - create only
-- if genuinely absent; every clause after this is idempotent regardless.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  slug text UNIQUE,
  plan_tier text NOT NULL DEFAULT 'free',
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspaces FROM anon, authenticated;
GRANT ALL ON public.workspaces TO service_role;

DROP TRIGGER IF EXISTS workspaces_updated_at ON public.workspaces;
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_role') THEN
    CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON public.workspace_members (user_id);
CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx ON public.workspace_members (workspace_id);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;

DROP POLICY IF EXISTS "Own membership rows readable" ON public.workspace_members;
CREATE POLICY "Own membership rows readable" ON public.workspace_members
FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "workspace_members_no_client_insert" ON public.workspace_members;
CREATE POLICY "workspace_members_no_client_insert" ON public.workspace_members
FOR INSERT TO authenticated, anon WITH CHECK (false);
DROP POLICY IF EXISTS "workspace_members_no_client_update" ON public.workspace_members;
CREATE POLICY "workspace_members_no_client_update" ON public.workspace_members
FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "workspace_members_no_client_delete" ON public.workspace_members;
CREATE POLICY "workspace_members_no_client_delete" ON public.workspace_members
FOR DELETE TO authenticated, anon USING (false);
REVOKE INSERT, UPDATE, DELETE ON public.workspace_members FROM authenticated, anon;

-- Legacy single-tenant "Workspace 1" row. No-ops on conflict if it already
-- exists under either this session's Phase 1 or the bot's near-duplicate.
INSERT INTO public.workspaces (id, name, slug, plan_tier, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Workspace 1', 'workspace-1', 'free', 'active')
ON CONFLICT (id) DO NOTHING;

-- Only enrolls users with zero existing workspace memberships - never
-- sweeps a self-serve tenant owner (who already has their own workspace
-- from handle_new_user()) into Workspace 1 as a side effect of a rerun.
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  CASE WHEN lower(p.email) = 'ledimothabo@gmail.com' THEN 'owner'::public.workspace_role
       ELSE 'member'::public.workspace_role END
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.user_id = p.id)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

UPDATE public.workspaces
SET owner_user_id = (SELECT id FROM public.profiles WHERE lower(email) = 'ledimothabo@gmail.com' LIMIT 1)
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND owner_user_id IS NULL;

-- =========================================================================
-- PART B: workspace_id column present, backfilled (NULL rows only), indexed
-- and NOT NULL on every tenant-scoped table.
-- =========================================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles','threads','messages','x_accounts','publish_jobs','publish_actions',
    'x_login_attempts','persona_images','tweet_metrics','persona_state',
    'persona_learning_events','persona_daily_plans','persona_daily_posts',
    'legal_reviews','listening_campaigns','campaign_replies','campaign_skip_audit',
    'brand_profiles','external_profiles','mention_keywords','x_mentions',
    'overview_intel','news_articles','apify_mentions','apify_profiles',
    'apify_source_status','reports','managed_reports','scheduled_actions',
    'monitoring_watchlist','decision_log','audit_log','rate_limit_hits',
    'idempotency_keys','ai_events'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE',
      t
    );
    EXECUTE format(
      'UPDATE public.%I SET workspace_id = %L WHERE workspace_id IS NULL',
      t, '00000000-0000-0000-0000-000000000001'
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (workspace_id)',
      t || '_workspace_idx', t
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN workspace_id SET NOT NULL',
      t
    );
  END LOOP;
END $$;

-- =========================================================================
-- PART C: workspace_settings / workspace_execution_state - converge on
-- workspace_id as the primary key, whatever shape (old singleton PK, new
-- workspace_id PK, or a fresh bot-recreated singleton table) is currently
-- live.
-- =========================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['workspace_settings', 'workspace_execution_state'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'workspace_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE',
        tbl
      );
    END IF;

    EXECUTE format(
      'UPDATE public.%I SET workspace_id = %L WHERE workspace_id IS NULL',
      tbl, '00000000-0000-0000-0000-000000000001'
    );

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'singleton'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP COLUMN singleton CASCADE', tbl);
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET NOT NULL', tbl);

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = format('public.%I', tbl)::regclass AND contype = 'p'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY (workspace_id)', tbl);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_settings FROM anon, authenticated;
GRANT ALL ON public.workspace_settings TO service_role;
ALTER TABLE public.workspace_execution_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_execution_state FROM anon, authenticated;
GRANT ALL ON public.workspace_execution_state TO service_role;

-- =========================================================================
-- PART D: workspace-resolution primitives (Phase 2a) - CREATE OR REPLACE is
-- already idempotent.
-- =========================================================================

CREATE OR REPLACE FUNCTION private.current_workspace_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.can_access_workspace(_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = auth.uid() AND workspace_id = _workspace_id
  )
$$;

GRANT EXECUTE ON FUNCTION private.current_workspace_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_workspace(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Members can read their workspace" ON public.workspaces;
CREATE POLICY "Members can read their workspace" ON public.workspaces
FOR SELECT TO authenticated USING (private.can_access_workspace(id));

-- =========================================================================
-- PART E: profiles / threads RLS + can_read_thread() - reassert the
-- workspace-scoped versions, replacing whichever variant (mine or the
-- bot's org-based revert) is currently live. Same policy names either way,
-- so DROP POLICY IF EXISTS covers both.
-- =========================================================================

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

-- =========================================================================
-- PART F: every other workspace-scoped table's RLS (Phase 2b), reasserted
-- verbatim. Drops both the pre-multi-tenant policy names ("Shared
-- workspace ...", "Signed-in users can read ...", "Owners can ... their X
-- accounts", "Admins can read ...") and the correct current names, so this
-- converges regardless of which set is currently live.
-- =========================================================================

DROP POLICY IF EXISTS "Owners can read their X accounts" ON public.x_accounts;
DROP POLICY IF EXISTS "Owners can create their X accounts" ON public.x_accounts;
DROP POLICY IF EXISTS "Owners can update their X accounts" ON public.x_accounts;
DROP POLICY IF EXISTS "Owners can delete their X accounts" ON public.x_accounts;
DROP POLICY IF EXISTS "Workspace members can read X accounts" ON public.x_accounts;
DROP POLICY IF EXISTS "Workspace members can create X accounts" ON public.x_accounts;
DROP POLICY IF EXISTS "Workspace members can update X accounts" ON public.x_accounts;
DROP POLICY IF EXISTS "Workspace members can delete X accounts" ON public.x_accounts;
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

DROP POLICY IF EXISTS "Shared workspace brand profiles" ON public.brand_profiles;
DROP POLICY IF EXISTS "Workspace members manage brand profiles" ON public.brand_profiles;
CREATE POLICY "Workspace members manage brand profiles" ON public.brand_profiles
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace campaigns" ON public.listening_campaigns;
DROP POLICY IF EXISTS "Workspace members manage campaigns" ON public.listening_campaigns;
CREATE POLICY "Workspace members manage campaigns" ON public.listening_campaigns
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace publish jobs" ON public.publish_jobs;
DROP POLICY IF EXISTS "Workspace members manage publish jobs" ON public.publish_jobs;
CREATE POLICY "Workspace members manage publish jobs" ON public.publish_jobs
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace campaign replies" ON public.campaign_replies;
DROP POLICY IF EXISTS "Workspace members manage campaign replies" ON public.campaign_replies;
CREATE POLICY "Workspace members manage campaign replies" ON public.campaign_replies
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace publish actions" ON public.publish_actions;
DROP POLICY IF EXISTS "Workspace members manage publish actions" ON public.publish_actions;
CREATE POLICY "Workspace members manage publish actions" ON public.publish_actions
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace scheduled actions" ON public.scheduled_actions;
DROP POLICY IF EXISTS "Workspace members manage scheduled actions" ON public.scheduled_actions;
CREATE POLICY "Workspace members manage scheduled actions" ON public.scheduled_actions
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace persona plans" ON public.persona_daily_plans;
DROP POLICY IF EXISTS "Workspace members manage persona plans" ON public.persona_daily_plans;
CREATE POLICY "Workspace members manage persona plans" ON public.persona_daily_plans
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace persona posts" ON public.persona_daily_posts;
DROP POLICY IF EXISTS "Workspace members manage persona posts" ON public.persona_daily_posts;
CREATE POLICY "Workspace members manage persona posts" ON public.persona_daily_posts
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Shared workspace tweet metrics" ON public.tweet_metrics;
DROP POLICY IF EXISTS "Workspace members manage tweet metrics" ON public.tweet_metrics;
CREATE POLICY "Workspace members manage tweet metrics" ON public.tweet_metrics
FOR ALL TO authenticated USING (private.can_access_workspace(workspace_id)) WITH CHECK (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Persona images readable by signed-in users" ON public.persona_images;
DROP POLICY IF EXISTS "Workspace members can read persona images" ON public.persona_images;
CREATE POLICY "Workspace members can read persona images" ON public.persona_images
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read persona state" ON public.persona_state;
DROP POLICY IF EXISTS "Workspace members can read persona state" ON public.persona_state;
CREATE POLICY "Workspace members can read persona state" ON public.persona_state
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read learning events" ON public.persona_learning_events;
DROP POLICY IF EXISTS "Workspace members can read learning events" ON public.persona_learning_events;
CREATE POLICY "Workspace members can read learning events" ON public.persona_learning_events
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read collected mentions" ON public.apify_mentions;
DROP POLICY IF EXISTS "Workspace members can read collected mentions" ON public.apify_mentions;
CREATE POLICY "Workspace members can read collected mentions" ON public.apify_mentions
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read collected profiles" ON public.apify_profiles;
DROP POLICY IF EXISTS "Workspace members can read collected profiles" ON public.apify_profiles;
CREATE POLICY "Workspace members can read collected profiles" ON public.apify_profiles
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read source status" ON public.apify_source_status;
DROP POLICY IF EXISTS "Workspace members can read source status" ON public.apify_source_status;
CREATE POLICY "Workspace members can read source status" ON public.apify_source_status
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read X mentions" ON public.x_mentions;
DROP POLICY IF EXISTS "Workspace members can read X mentions" ON public.x_mentions;
CREATE POLICY "Workspace members can read X mentions" ON public.x_mentions
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read overview intelligence" ON public.overview_intel;
DROP POLICY IF EXISTS "Workspace members can read overview intelligence" ON public.overview_intel;
CREATE POLICY "Workspace members can read overview intelligence" ON public.overview_intel
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read listening keywords" ON public.mention_keywords;
DROP POLICY IF EXISTS "Workspace members can read listening keywords" ON public.mention_keywords;
CREATE POLICY "Workspace members can read listening keywords" ON public.mention_keywords
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read news" ON public.news_articles;
DROP POLICY IF EXISTS "Workspace members can read news" ON public.news_articles;
CREATE POLICY "Workspace members can read news" ON public.news_articles
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users can read reports" ON public.reports;
DROP POLICY IF EXISTS "Workspace members can read reports" ON public.reports;
CREATE POLICY "Workspace members can read reports" ON public.reports
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Signed-in users read published managed reports" ON public.managed_reports;
DROP POLICY IF EXISTS "Workspace members read published managed reports" ON public.managed_reports;
CREATE POLICY "Workspace members read published managed reports" ON public.managed_reports
FOR SELECT TO authenticated
USING (
  private.can_access_workspace(workspace_id)
  AND (status = 'published' OR (auth.jwt() ->> 'email') = 'ledimothabo@gmail.com')
);

DROP POLICY IF EXISTS "Admins can read audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Workspace members can read audit log" ON public.audit_log;
CREATE POLICY "Workspace members can read audit log" ON public.audit_log
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Admins can read AI events" ON public.ai_events;
DROP POLICY IF EXISTS "Workspace members can read AI events" ON public.ai_events;
CREATE POLICY "Workspace members can read AI events" ON public.ai_events
FOR SELECT TO authenticated USING (private.can_access_workspace(workspace_id));

-- =========================================================================
-- PART G: handle_new_user() - reassert the self-serve, workspace-per-signup
-- version (Phase 3), replacing the bot's org/email-domain revert which also
-- referenced workspace_settings.singleton - a column Part C guarantees no
-- longer exists, so the reverted version would hard-error on every signup
-- if it were still live.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_workspace_id uuid;
  display_name text;
BEGIN
  display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.workspaces (name, owner_user_id)
  VALUES (display_name || '''s workspace', NEW.id)
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  INSERT INTO public.profiles (id, email, full_name, org, workspace_id)
  VALUES (NEW.id, NEW.email, display_name, 'team', new_workspace_id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
