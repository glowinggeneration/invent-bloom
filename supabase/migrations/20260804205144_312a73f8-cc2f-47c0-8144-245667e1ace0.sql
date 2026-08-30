ALTER TABLE public.publish_jobs
ADD COLUMN IF NOT EXISTS engagement_actions jsonb NOT NULL DEFAULT '{}'::jsonb;