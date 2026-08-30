-- Always-On persona content publishing: per-account daily plans and posts.

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