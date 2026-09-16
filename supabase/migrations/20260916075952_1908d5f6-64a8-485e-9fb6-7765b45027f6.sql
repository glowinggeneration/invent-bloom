ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS org_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS org_website text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS org_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS org_profile_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS org_profile_name text NOT NULL DEFAULT '';