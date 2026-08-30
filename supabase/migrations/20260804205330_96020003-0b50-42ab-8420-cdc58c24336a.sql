ALTER TABLE public.publish_jobs
ADD COLUMN IF NOT EXISTS engagement_targets jsonb NOT NULL DEFAULT '{}'::jsonb;