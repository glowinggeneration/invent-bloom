ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS team text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand_handle text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_skipped_at timestamptz;