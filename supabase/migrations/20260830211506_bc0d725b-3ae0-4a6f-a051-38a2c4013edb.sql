CREATE TABLE public.apify_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  content_type text NOT NULL,
  source_label text NOT NULL,
  external_id text NOT NULL,
  author_name text,
  author_handle text,
  author_avatar text,
  title text,
  content text,
  url text NOT NULL,
  thumbnail_url text,
  published_at timestamptz,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  entities text[] NOT NULL DEFAULT '{}',
  matched_keywords text[] NOT NULL DEFAULT '{}',
  sentiment text NOT NULL DEFAULT 'neutral',
  sentiment_score numeric NOT NULL DEFAULT 0,
  sentiment_reason text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);
CREATE UNIQUE INDEX apify_mentions_url_key ON public.apify_mentions (url);
CREATE INDEX apify_mentions_published_idx ON public.apify_mentions (published_at DESC NULLS LAST);

GRANT SELECT ON public.apify_mentions TO authenticated;
GRANT ALL ON public.apify_mentions TO service_role;
ALTER TABLE public.apify_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read collected mentions"
  ON public.apify_mentions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.apify_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  handle text NOT NULL,
  display_name text,
  description text,
  avatar_url text,
  banner_url text,
  profile_url text NOT NULL,
  followers bigint,
  following bigint,
  posts_count bigint,
  likes_count bigint,
  is_verified boolean NOT NULL DEFAULT false,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, handle)
);
GRANT SELECT ON public.apify_profiles TO authenticated;
GRANT ALL ON public.apify_profiles TO service_role;
ALTER TABLE public.apify_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read collected profiles"
  ON public.apify_profiles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.apify_source_status (
  source_key text PRIMARY KEY,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'idle',
  message text,
  items_last_run integer NOT NULL DEFAULT 0,
  stored_last_run integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.apify_source_status TO authenticated;
GRANT ALL ON public.apify_source_status TO service_role;
ALTER TABLE public.apify_source_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read source status"
  ON public.apify_source_status FOR SELECT TO authenticated USING (true);

CREATE TABLE public.x_mentions (
  tweet_id text PRIMARY KEY,
  text text NOT NULL DEFAULT '',
  author_handle text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT '',
  author_verified boolean NOT NULL DEFAULT false,
  url text NOT NULL DEFAULT '',
  posted_at timestamptz,
  like_count bigint NOT NULL DEFAULT 0,
  view_count bigint NOT NULL DEFAULT 0,
  sentiment text NOT NULL DEFAULT 'neutral',
  sentiment_score numeric NOT NULL DEFAULT 0,
  sentiment_reason text NOT NULL DEFAULT '',
  reply_to_brand boolean NOT NULL DEFAULT false,
  mentions_federation boolean NOT NULL DEFAULT false,
  mentions_president boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'mention',
  matched_keyword text NOT NULL DEFAULT '',
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX x_mentions_posted_idx ON public.x_mentions (posted_at DESC NULLS LAST);
CREATE INDEX x_mentions_sentiment_idx ON public.x_mentions (sentiment);

GRANT SELECT ON public.x_mentions TO authenticated;
GRANT ALL ON public.x_mentions TO service_role;

ALTER TABLE public.x_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read X mentions"
ON public.x_mentions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.overview_intel (
  key text PRIMARY KEY,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.overview_intel TO authenticated;
GRANT ALL ON public.overview_intel TO service_role;

ALTER TABLE public.overview_intel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read overview intelligence"
ON public.overview_intel FOR SELECT TO authenticated USING (true);

CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL DEFAULT 'daily',
  report_date date NOT NULL,
  label text NOT NULL DEFAULT '',
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  status text NOT NULL DEFAULT 'generating',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversation jsonb NOT NULL DEFAULT '{}'::jsonb,
  campaigns jsonb NOT NULL DEFAULT '{}'::jsonb,
  personas jsonb NOT NULL DEFAULT '{}'::jsonb,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX reports_kind_period_idx
  ON public.reports (kind, report_date, period_start, period_end);
CREATE INDEX reports_date_idx ON public.reports (report_date DESC);

GRANT SELECT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read reports"
  ON public.reports FOR SELECT TO authenticated USING (true);

CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

DROP POLICY IF EXISTS "Own x accounts readable" ON public.x_accounts;
DROP POLICY IF EXISTS "Own x accounts insertable" ON public.x_accounts;
DROP POLICY IF EXISTS "Own x accounts updatable" ON public.x_accounts;
DROP POLICY IF EXISTS "Own x accounts deletable" ON public.x_accounts;
CREATE POLICY "Shared workspace x accounts" ON public.x_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage their own brand profiles" ON public.brand_profiles;
CREATE POLICY "Shared workspace brand profiles" ON public.brand_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage their own listening campaigns" ON public.listening_campaigns;
CREATE POLICY "Shared workspace campaigns" ON public.listening_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Own publish jobs" ON public.publish_jobs;
CREATE POLICY "Shared workspace publish jobs" ON public.publish_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage their own campaign replies" ON public.campaign_replies;
CREATE POLICY "Shared workspace campaign replies" ON public.campaign_replies FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Own publish actions" ON public.publish_actions;
CREATE POLICY "Shared workspace publish actions" ON public.publish_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owners manage their scheduled actions" ON public.scheduled_actions;
CREATE POLICY "Shared workspace scheduled actions" ON public.scheduled_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owners manage their persona plans" ON public.persona_daily_plans;
CREATE POLICY "Shared workspace persona plans" ON public.persona_daily_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owners manage their persona posts" ON public.persona_daily_posts;
CREATE POLICY "Shared workspace persona posts" ON public.persona_daily_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Own tweet metrics" ON public.tweet_metrics;
CREATE POLICY "Shared workspace tweet metrics" ON public.tweet_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users read their own skip audit" ON public.campaign_skip_audit;
CREATE POLICY "Shared workspace skip audit readable" ON public.campaign_skip_audit FOR SELECT TO authenticated USING (true);