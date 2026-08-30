ALTER TABLE public.publish_jobs
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS name_is_custom boolean NOT NULL DEFAULT false;

ALTER TABLE public.listening_campaigns
  ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '';