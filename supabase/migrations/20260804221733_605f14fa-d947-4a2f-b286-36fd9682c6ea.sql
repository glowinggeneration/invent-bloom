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