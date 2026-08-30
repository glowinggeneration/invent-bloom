CREATE TABLE public.brand_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  avatar_url text,
  banner_url text,
  followers integer NOT NULL DEFAULT 0,
  following integer NOT NULL DEFAULT 0,
  tweet_count integer NOT NULL DEFAULT 0,
  media_count integer NOT NULL DEFAULT 0,
  favourites_count integer NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT false,
  profile_created_at timestamp with time zone,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, handle)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_profiles TO authenticated;
GRANT ALL ON public.brand_profiles TO service_role;

ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own brand profiles"
ON public.brand_profiles FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER brand_profiles_updated_at
BEFORE UPDATE ON public.brand_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.external_profiles (
  handle text PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  avatar_url text,
  followers integer NOT NULL DEFAULT 0,
  following integer NOT NULL DEFAULT 0,
  tweet_count integer NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT false,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.external_profiles TO authenticated;
GRANT ALL ON public.external_profiles TO service_role;
ALTER TABLE public.external_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read cached external profiles"
  ON public.external_profiles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.mention_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  source text NOT NULL DEFAULT 'ai',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_refreshed_at timestamptz
);

CREATE UNIQUE INDEX mention_keywords_term_key ON public.mention_keywords (lower(term));

GRANT SELECT ON public.mention_keywords TO authenticated;
GRANT ALL ON public.mention_keywords TO service_role;

ALTER TABLE public.mention_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read listening keywords"
ON public.mention_keywords FOR SELECT TO authenticated USING (true);

INSERT INTO public.mention_keywords (term, source) VALUES
  ('Football Kenya Federation', 'seed'),
  ('FKF', 'seed'),
  ('Harambee Stars', 'seed'),
  ('Harambee Starlets', 'seed'),
  ('FKF Premier League', 'seed'),
  ('Kenyan football', 'seed'),
  ('Hussein Mohammed FKF', 'seed'),
  ('FKF president', 'seed'),
  ('Kenya national team football', 'seed'),
  ('FKF elections', 'seed');

CREATE TABLE public.news_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  pub_date TIMESTAMP WITH TIME ZONE,
  source_id TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  category TEXT[] NOT NULL DEFAULT '{}',
  matched_query TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX news_articles_pub_date_idx ON public.news_articles (pub_date DESC NULLS LAST);

GRANT SELECT ON public.news_articles TO authenticated;
GRANT ALL ON public.news_articles TO service_role;

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read news"
ON public.news_articles FOR SELECT TO authenticated USING (true);

ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'NewsData',
  ADD COLUMN IF NOT EXISTS title_key TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS news_articles_title_key_idx ON public.news_articles (title_key);
CREATE INDEX IF NOT EXISTS news_articles_provider_idx ON public.news_articles (provider);

ALTER TABLE public.x_accounts
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_handle text,
  ADD COLUMN IF NOT EXISTS handle_synced_at timestamptz;

ALTER TABLE public.x_accounts ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

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

ALTER TABLE public.scheduled_actions DROP CONSTRAINT IF EXISTS scheduled_actions_status_check;
ALTER TABLE public.scheduled_actions ADD CONSTRAINT scheduled_actions_status_check CHECK (status = ANY (ARRAY['pending','running','success','failed','cancelled','paused']));

ALTER TABLE public.publish_jobs
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS name_is_custom boolean NOT NULL DEFAULT false;

ALTER TABLE public.listening_campaigns
  ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.campaign_action_stats()
RETURNS TABLE (
  source text,
  campaign_id uuid,
  kind text,
  status text,
  n integer,
  last_at timestamptz,
  next_run timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 'publish'::text, a.job_id, a.action_type::text, a.status::text, count(*)::int,
         max(a.updated_at), NULL::timestamptz
  FROM public.publish_actions a
  WHERE a.user_id = auth.uid()
  GROUP BY 1, 2, 3, 4
  UNION ALL
  SELECT 'publish'::text, s.job_id, s.action_type::text, s.status::text, count(*)::int,
         max(s.updated_at), min(s.run_at)
  FROM public.scheduled_actions s
  WHERE s.user_id = auth.uid() AND s.job_id IS NOT NULL AND s.publish_action_id IS NULL
  GROUP BY 1, 2, 3, 4
  UNION ALL
  SELECT 'listen'::text, r.campaign_id, 'comment'::text, r.status::text, count(*)::int,
         max(r.created_at), NULL::timestamptz
  FROM public.campaign_replies r
  WHERE r.user_id = auth.uid()
  GROUP BY 1, 2, 3, 4
  UNION ALL
  SELECT 'listen'::text, s.campaign_id, s.action_type::text, s.status::text, count(*)::int,
         max(s.updated_at), min(s.run_at)
  FROM public.scheduled_actions s
  WHERE s.user_id = auth.uid() AND s.campaign_id IS NOT NULL AND s.campaign_reply_id IS NULL
  GROUP BY 1, 2, 3, 4
$$;

GRANT EXECUTE ON FUNCTION public.campaign_action_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_action_stats() TO service_role;