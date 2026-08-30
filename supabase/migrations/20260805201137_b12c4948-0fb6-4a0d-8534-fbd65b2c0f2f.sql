ALTER TABLE public.publish_jobs
  ADD COLUMN IF NOT EXISTS objective_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS objective_text text NOT NULL DEFAULT '';