CREATE TABLE public.external_profiles (
  handle text PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  avatar_url text,
  followers integer NOT NULL DEFAULT 0,
  following integer NOT NULL DEFAULT 0,
  tweet_count integer NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT false,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.external_profiles TO authenticated;
GRANT ALL ON public.external_profiles TO service_role;
ALTER TABLE public.external_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read cached external profiles"
  ON public.external_profiles FOR SELECT TO authenticated USING (true);