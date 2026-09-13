CREATE TABLE public.workspaces (
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

CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX workspace_members_user_idx ON public.workspace_members (user_id);
CREATE INDEX workspace_members_workspace_idx ON public.workspace_members (workspace_id);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;

CREATE POLICY "Own membership rows readable" ON public.workspace_members
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "workspace_members_no_client_insert" ON public.workspace_members
FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "workspace_members_no_client_update" ON public.workspace_members
FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "workspace_members_no_client_delete" ON public.workspace_members
FOR DELETE TO authenticated, anon USING (false);
REVOKE INSERT, UPDATE, DELETE ON public.workspace_members FROM authenticated, anon;

INSERT INTO public.workspaces (id, name, slug, plan_tier, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Workspace 1', 'workspace-1', 'free', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT
  '00000000-0000-0000-0000-000000000001',
  id,
  CASE WHEN lower(email) = 'ledimothabo@gmail.com' THEN 'owner'::public.workspace_role
       ELSE 'member'::public.workspace_role END
FROM public.profiles
ON CONFLICT (workspace_id, user_id) DO NOTHING;

UPDATE public.workspaces
SET owner_user_id = (SELECT id FROM public.profiles WHERE lower(email) = 'ledimothabo@gmail.com' LIMIT 1)
WHERE id = '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.profiles ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.profiles SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX profiles_workspace_idx ON public.profiles (workspace_id);

ALTER TABLE public.threads ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.threads SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX threads_workspace_idx ON public.threads (workspace_id);

ALTER TABLE public.messages ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.messages SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX messages_workspace_idx ON public.messages (workspace_id);

ALTER TABLE public.x_accounts ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.x_accounts SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX x_accounts_workspace_idx ON public.x_accounts (workspace_id);

ALTER TABLE public.publish_jobs ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.publish_jobs SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX publish_jobs_workspace_idx ON public.publish_jobs (workspace_id);

ALTER TABLE public.publish_actions ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.publish_actions SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX publish_actions_workspace_idx ON public.publish_actions (workspace_id);

ALTER TABLE public.x_login_attempts ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.x_login_attempts SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX x_login_attempts_workspace_idx ON public.x_login_attempts (workspace_id);

ALTER TABLE public.persona_images ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.persona_images SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX persona_images_workspace_idx ON public.persona_images (workspace_id);

ALTER TABLE public.tweet_metrics ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.tweet_metrics SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX tweet_metrics_workspace_idx ON public.tweet_metrics (workspace_id);

ALTER TABLE public.persona_state ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.persona_state SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX persona_state_workspace_idx ON public.persona_state (workspace_id);

ALTER TABLE public.persona_learning_events ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.persona_learning_events SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX persona_learning_events_workspace_idx ON public.persona_learning_events (workspace_id);

ALTER TABLE public.persona_daily_plans ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.persona_daily_plans SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX persona_daily_plans_workspace_idx ON public.persona_daily_plans (workspace_id);

ALTER TABLE public.persona_daily_posts ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.persona_daily_posts SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX persona_daily_posts_workspace_idx ON public.persona_daily_posts (workspace_id);

ALTER TABLE public.legal_reviews ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.legal_reviews SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX legal_reviews_workspace_idx ON public.legal_reviews (workspace_id);

ALTER TABLE public.listening_campaigns ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.listening_campaigns SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX listening_campaigns_workspace_idx ON public.listening_campaigns (workspace_id);

ALTER TABLE public.campaign_replies ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.campaign_replies SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX campaign_replies_workspace_idx ON public.campaign_replies (workspace_id);

ALTER TABLE public.campaign_skip_audit ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.campaign_skip_audit SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX campaign_skip_audit_workspace_idx ON public.campaign_skip_audit (workspace_id);

ALTER TABLE public.brand_profiles ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.brand_profiles SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX brand_profiles_workspace_idx ON public.brand_profiles (workspace_id);

ALTER TABLE public.external_profiles ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.external_profiles SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX external_profiles_workspace_idx ON public.external_profiles (workspace_id);

ALTER TABLE public.mention_keywords ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.mention_keywords SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX mention_keywords_workspace_idx ON public.mention_keywords (workspace_id);

ALTER TABLE public.x_mentions ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.x_mentions SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX x_mentions_workspace_idx ON public.x_mentions (workspace_id);

ALTER TABLE public.overview_intel ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.overview_intel SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX overview_intel_workspace_idx ON public.overview_intel (workspace_id);

ALTER TABLE public.news_articles ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.news_articles SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX news_articles_workspace_idx ON public.news_articles (workspace_id);

ALTER TABLE public.apify_mentions ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.apify_mentions SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX apify_mentions_workspace_idx ON public.apify_mentions (workspace_id);

ALTER TABLE public.apify_profiles ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.apify_profiles SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX apify_profiles_workspace_idx ON public.apify_profiles (workspace_id);

ALTER TABLE public.apify_source_status ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.apify_source_status SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX apify_source_status_workspace_idx ON public.apify_source_status (workspace_id);

ALTER TABLE public.reports ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.reports SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX reports_workspace_idx ON public.reports (workspace_id);

ALTER TABLE public.managed_reports ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.managed_reports SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX managed_reports_workspace_idx ON public.managed_reports (workspace_id);

ALTER TABLE public.scheduled_actions ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.scheduled_actions SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX scheduled_actions_workspace_idx ON public.scheduled_actions (workspace_id);

ALTER TABLE public.monitoring_watchlist ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.monitoring_watchlist SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX monitoring_watchlist_workspace_idx ON public.monitoring_watchlist (workspace_id);

ALTER TABLE public.decision_log ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.decision_log SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX decision_log_workspace_idx ON public.decision_log (workspace_id);

ALTER TABLE public.workspace_settings ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.workspace_settings SET workspace_id = '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.workspace_execution_state ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.workspace_execution_state SET workspace_id = '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.audit_log ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.audit_log SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX audit_log_workspace_idx ON public.audit_log (workspace_id);

ALTER TABLE public.rate_limit_hits ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.rate_limit_hits SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX rate_limit_hits_workspace_idx ON public.rate_limit_hits (workspace_id);

ALTER TABLE public.idempotency_keys ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.idempotency_keys SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX idempotency_keys_workspace_idx ON public.idempotency_keys (workspace_id);

ALTER TABLE public.ai_events ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.ai_events SET workspace_id = '00000000-0000-0000-0000-000000000001';
CREATE INDEX ai_events_workspace_idx ON public.ai_events (workspace_id);