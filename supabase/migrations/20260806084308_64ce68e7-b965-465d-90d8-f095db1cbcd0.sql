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