INSERT INTO public.scheduled_actions (user_id, source, account_id, handle, action_type, target_tweet_id, run_at)
SELECT a.user_id, 'queue', a.id, a.handle, k.kind, t.tweet_id, now()
FROM public.x_accounts a
CROSS JOIN (VALUES ('like'),('retweet'),('bookmark')) AS k(kind)
CROSS JOIN (VALUES
  ('2088675376738205732'),
  ('2088683462043619382'),
  ('2088329279629095327'),
  ('2088258276920025241'),
  ('2087879198324953437'),
  ('2087900129625866664')
) AS t(tweet_id)
WHERE a.is_active AND NOT a.suspended AND coalesce(a.auth_token,'') <> '';