ALTER TABLE public.x_accounts
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS background_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_color TEXT,
  ADD COLUMN IF NOT EXISTS avatar_credit_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_credit_url TEXT;