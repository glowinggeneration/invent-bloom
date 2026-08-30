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