
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
