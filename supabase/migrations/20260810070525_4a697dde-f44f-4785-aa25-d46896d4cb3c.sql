ALTER TABLE public.x_accounts
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_handle text,
  ADD COLUMN IF NOT EXISTS handle_synced_at timestamptz;