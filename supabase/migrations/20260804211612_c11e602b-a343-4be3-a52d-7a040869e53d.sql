CREATE TABLE public.tweet_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.x_accounts(id) ON DELETE SET NULL,
  handle text NOT NULL DEFAULT '',
  tweet_id text NOT NULL,
  kind text NOT NULL DEFAULT 'tweet',
  content text NOT NULL DEFAULT '',
  like_count integer NOT NULL DEFAULT 0,
  retweet_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  quote_count integer NOT NULL DEFAULT 0,
  bookmark_count integer NOT NULL DEFAULT 0,
  impression_count integer NOT NULL DEFAULT 0,
  tweeted_at timestamp with time zone,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, tweet_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tweet_metrics TO authenticated;
GRANT ALL ON public.tweet_metrics TO service_role;

ALTER TABLE public.tweet_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own tweet metrics" ON public.tweet_metrics
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER tweet_metrics_updated_at
  BEFORE UPDATE ON public.tweet_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX tweet_metrics_user_idx ON public.tweet_metrics (user_id, tweeted_at DESC);