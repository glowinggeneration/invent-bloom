-- SMAIT mobile app: push notifications for critical negative mentions.
--
-- device_push_tokens holds Expo push tokens registered by the mobile app on
-- sign-in, scoped to the owning user/workspace with the same
-- private.can_access_workspace() convention as every other Phase 2b policy.
--
-- The trigger fires on every new x_mentions row and pushes to every device
-- registered for that row's workspace when the mention meets the exact same
-- "critical" bar the web app already uses (src/lib/notifications.ts's
-- isCriticalMention()) - one definition of alert-worthy, not two drifting
-- rule sets between web and mobile.
--
-- Requires the pg_net extension (enabled below, idempotent) to make an
-- async HTTP call to Expo's push API from inside Postgres without blocking
-- the mention insert.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, expo_push_token)
);

CREATE INDEX device_push_tokens_workspace_idx ON public.device_push_tokens (workspace_id);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;
GRANT ALL ON public.device_push_tokens TO service_role;

CREATE POLICY "Users manage their own push tokens" ON public.device_push_tokens
FOR ALL TO authenticated
USING (user_id = auth.uid() AND private.can_access_workspace(workspace_id))
WITH CHECK (user_id = auth.uid() AND private.can_access_workspace(workspace_id));

CREATE TRIGGER device_push_tokens_updated_at
  BEFORE UPDATE ON public.device_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.notify_critical_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_critical boolean;
  token_row record;
  notif_title text;
  notif_body text;
BEGIN
  is_critical := NEW.sentiment = 'negative' AND (
    NEW.sentiment_score <= -4
    OR (
      NEW.sentiment_score <= -2
      AND (NEW.view_count >= 2000 OR NEW.like_count >= 30 OR NEW.author_verified OR NEW.reply_to_brand)
    )
  );
  IF NOT is_critical THEN
    RETURN NEW;
  END IF;

  notif_title := 'Critical mention flagged';
  notif_body := left(coalesce(NEW.author_name, '@' || NEW.author_handle) || ': ' || NEW.text, 160);

  FOR token_row IN
    SELECT DISTINCT expo_push_token
    FROM public.device_push_tokens
    WHERE workspace_id = NEW.workspace_id
  LOOP
    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := jsonb_build_object(
        'to', token_row.expo_push_token,
        'title', notif_title,
        'body', notif_body,
        'data', jsonb_build_object('tweetId', NEW.tweet_id, 'kind', 'critical_mention')
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER x_mentions_notify_critical
  AFTER INSERT ON public.x_mentions
  FOR EACH ROW EXECUTE FUNCTION public.notify_critical_mention();
