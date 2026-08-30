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