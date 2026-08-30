CREATE TABLE public.legal_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  surface TEXT NOT NULL,
  user_id UUID,
  persona_id TEXT,
  reference TEXT,
  original_text TEXT NOT NULL,
  revised_text TEXT NOT NULL DEFAULT '',
  risk_level SMALLINT NOT NULL DEFAULT 0,
  risk_categories TEXT[] NOT NULL DEFAULT '{}',
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  function_preserved BOOLEAN NOT NULL DEFAULT true,
  persona_preserved BOOLEAN NOT NULL DEFAULT true,
  facts_changed BOOLEAN NOT NULL DEFAULT false,
  approval_required TEXT NOT NULL DEFAULT 'none',
  confidence NUMERIC NOT NULL DEFAULT 0,
  escalation_note TEXT,
  auto_publish_allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.legal_reviews TO authenticated;
GRANT ALL ON public.legal_reviews TO service_role;

ALTER TABLE public.legal_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read the legal audit trail"
ON public.legal_reviews FOR SELECT TO authenticated USING (true);

CREATE INDEX legal_reviews_created_at_idx ON public.legal_reviews (created_at DESC);
CREATE INDEX legal_reviews_risk_level_idx ON public.legal_reviews (risk_level DESC);

ALTER TABLE public.x_accounts
  ADD COLUMN IF NOT EXISTS always_on boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.persona_daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.x_accounts(id) ON DELETE CASCADE,
  persona_id text NOT NULL,
  persona_name text NOT NULL DEFAULT '',
  plan_date date NOT NULL,
  activity_type text NOT NULL DEFAULT 'moderate',
  target integer NOT NULL DEFAULT 3,
  campaign_count integer NOT NULL DEFAULT 0,
  windows jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, plan_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persona_daily_plans TO authenticated;
GRANT ALL ON public.persona_daily_plans TO service_role;
ALTER TABLE public.persona_daily_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their persona plans"
  ON public.persona_daily_plans FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER persona_daily_plans_updated_at
  BEFORE UPDATE ON public.persona_daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.persona_daily_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.persona_daily_plans(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.x_accounts(id) ON DELETE CASCADE,
  persona_id text NOT NULL,
  slot_index integer NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'personal_observation',
  topic text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  image_url text,
  image_id text,
  image_credit_name text,
  image_credit_url text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'scheduled',
  quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  legal jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_notes text NOT NULL DEFAULT '',
  result_tweet_id text,
  error text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persona_daily_posts TO authenticated;
GRANT ALL ON public.persona_daily_posts TO service_role;
ALTER TABLE public.persona_daily_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their persona posts"
  ON public.persona_daily_posts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER persona_daily_posts_updated_at
  BEFORE UPDATE ON public.persona_daily_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS persona_daily_posts_account_sched_idx
  ON public.persona_daily_posts (account_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS persona_daily_posts_status_idx
  ON public.persona_daily_posts (status, scheduled_at);

CREATE TABLE public.listening_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  core_message TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'en',
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_replies_per_run INTEGER NOT NULL DEFAULT 5,
  like_target BOOLEAN NOT NULL DEFAULT true,
  follow_author BOOLEAN NOT NULL DEFAULT false,
  account_ids UUID[] NOT NULL DEFAULT '{}',
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listening_campaigns TO authenticated;
GRANT ALL ON public.listening_campaigns TO service_role;
ALTER TABLE public.listening_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own listening campaigns"
  ON public.listening_campaigns FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER listening_campaigns_updated_at
  BEFORE UPDATE ON public.listening_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.campaign_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.listening_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  account_id UUID,
  handle TEXT NOT NULL DEFAULT '',
  persona_name TEXT NOT NULL DEFAULT '',
  tweet_id TEXT NOT NULL,
  tweet_url TEXT,
  author_handle TEXT NOT NULL DEFAULT '',
  tweet_text TEXT NOT NULL DEFAULT '',
  reply_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  result_tweet_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX campaign_replies_unique_tweet ON public.campaign_replies (campaign_id, tweet_id);
CREATE INDEX campaign_replies_campaign_idx ON public.campaign_replies (campaign_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_replies TO authenticated;
GRANT ALL ON public.campaign_replies TO service_role;
ALTER TABLE public.campaign_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own campaign replies"
  ON public.campaign_replies FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.x_login_attempts ADD COLUMN IF NOT EXISTS totp_secret text NOT NULL DEFAULT '';

ALTER TABLE public.publish_jobs
  ADD COLUMN IF NOT EXISTS objective_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS objective_text text NOT NULL DEFAULT '';

CREATE TABLE public.scheduled_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('publish','campaign','queue')),
  job_id uuid REFERENCES public.publish_jobs(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.listening_campaigns(id) ON DELETE CASCADE,
  publish_action_id uuid REFERENCES public.publish_actions(id) ON DELETE CASCADE,
  campaign_reply_id uuid REFERENCES public.campaign_replies(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.x_accounts(id) ON DELETE CASCADE,
  handle text NOT NULL DEFAULT '',
  persona_name text NOT NULL DEFAULT '',
  action_type text NOT NULL CHECK (action_type IN ('tweet','comment','like','retweet','bookmark','follow')),
  content text NOT NULL DEFAULT '',
  target_tweet_id text,
  target_handle text,
  media_urls text[] NOT NULL DEFAULT '{}',
  run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','success','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  error text,
  result_tweet_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_actions TO authenticated;
GRANT ALL ON public.scheduled_actions TO service_role;

ALTER TABLE public.scheduled_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their scheduled actions"
ON public.scheduled_actions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX scheduled_actions_due_idx ON public.scheduled_actions (status, run_at);
CREATE INDEX scheduled_actions_user_idx ON public.scheduled_actions (user_id, created_at DESC);

CREATE TRIGGER scheduled_actions_updated_at
BEFORE UPDATE ON public.scheduled_actions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.listening_campaigns
  ADD COLUMN IF NOT EXISTS spread_hours integer NOT NULL DEFAULT 0;