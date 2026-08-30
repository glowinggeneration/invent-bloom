CREATE TABLE public.threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New test',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_threads_device ON public.threads(device_id, updated_at DESC);
CREATE INDEX idx_messages_thread ON public.messages(thread_id, created_at);

GRANT ALL ON public.threads TO service_role;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  org TEXT NOT NULL DEFAULT 'external',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_org()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org FROM public.profiles WHERE id = auth.uid()
$$;

CREATE POLICY "Own profile readable" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (org = 'fkf' AND org = public.current_org()));
CREATE POLICY "Own profile updatable" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Own roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, org)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN lower(split_part(NEW.email, '@', 2)) = 'footballkenya.org' THEN 'fkf' ELSE 'external' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Move threads/messages from device ownership to account ownership
DELETE FROM public.messages;
DELETE FROM public.threads;

ALTER TABLE public.threads
  DROP COLUMN device_id,
  ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN org TEXT NOT NULL DEFAULT 'external',
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.messages
  DROP COLUMN device_id,
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX threads_user_idx ON public.threads (user_id, updated_at DESC);
CREATE INDEX threads_shared_idx ON public.threads (org, visibility);

CREATE OR REPLACE FUNCTION public.can_read_thread(_thread_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = _thread_id
      AND (
        t.user_id = auth.uid()
        OR (t.visibility = 'workspace' AND t.org = 'fkf' AND public.current_org() = 'fkf')
      )
  )
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.threads TO authenticated;
GRANT ALL ON public.threads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

CREATE POLICY "Read own or shared threads" ON public.threads FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (visibility = 'workspace' AND org = 'fkf' AND public.current_org() = 'fkf'));
CREATE POLICY "Create own threads" ON public.threads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own threads" ON public.threads FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own threads" ON public.threads FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Read messages of readable threads" ON public.messages FOR SELECT TO authenticated
  USING (public.can_read_thread(thread_id));
CREATE POLICY "Insert messages into readable threads" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.can_read_thread(thread_id));

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_org() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_read_thread(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_thread(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE TABLE public.x_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  persona_label text NOT NULL DEFAULT '',
  auth_token text,
  proxy text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, handle)
);

GRANT SELECT (id, user_id, handle, display_name, persona_label, is_active, created_at, updated_at) ON public.x_accounts TO authenticated;
GRANT INSERT (user_id, handle, display_name, persona_label, auth_token, proxy, is_active) ON public.x_accounts TO authenticated;
GRANT UPDATE (handle, display_name, persona_label, auth_token, proxy, is_active) ON public.x_accounts TO authenticated;
GRANT DELETE ON public.x_accounts TO authenticated;
GRANT ALL ON public.x_accounts TO service_role;

ALTER TABLE public.x_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own x accounts readable" ON public.x_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own x accounts insertable" ON public.x_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own x accounts updatable" ON public.x_accounts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own x accounts deletable" ON public.x_accounts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER x_accounts_updated_at BEFORE UPDATE ON public.x_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'tweet',
  tweet_text text NOT NULL DEFAULT '',
  comment_text text NOT NULL DEFAULT '',
  target_tweet_url text,
  link_url text,
  image_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_jobs TO authenticated;
GRANT ALL ON public.publish_jobs TO service_role;

ALTER TABLE public.publish_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own publish jobs" ON public.publish_jobs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER publish_jobs_updated_at BEFORE UPDATE ON public.publish_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.publish_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.publish_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.x_accounts(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  result_tweet_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_actions TO authenticated;
GRANT ALL ON public.publish_actions TO service_role;

ALTER TABLE public.publish_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own publish actions" ON public.publish_actions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER publish_actions_updated_at BEFORE UPDATE ON public.publish_actions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.x_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL,
  email text NOT NULL DEFAULT '',
  password text NOT NULL,
  proxy text NOT NULL DEFAULT '',
  persona_label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_code',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, handle)
);

GRANT ALL ON public.x_login_attempts TO service_role;

ALTER TABLE public.x_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER x_login_attempts_updated_at
BEFORE UPDATE ON public.x_login_attempts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.persona_images (
  persona_id TEXT NOT NULL PRIMARY KEY,
  query TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL,
  background_url TEXT NOT NULL,
  color TEXT,
  photographer_name TEXT NOT NULL DEFAULT '',
  photographer_url TEXT NOT NULL DEFAULT '',
  unsplash_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.persona_images TO authenticated;
GRANT ALL ON public.persona_images TO service_role;
ALTER TABLE public.persona_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Persona images readable by signed-in users" ON public.persona_images FOR SELECT TO authenticated USING (true);
CREATE TRIGGER persona_images_updated_at BEFORE UPDATE ON public.persona_images FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.x_accounts
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS background_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_color TEXT,
  ADD COLUMN IF NOT EXISTS avatar_credit_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_credit_url TEXT;

ALTER TABLE public.x_accounts ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '';

ALTER TABLE public.publish_jobs
ADD COLUMN IF NOT EXISTS engagement_actions jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.publish_jobs
ADD COLUMN IF NOT EXISTS engagement_targets jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.tweet_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.x_accounts(id) ON DELETE SET NULL,
  handle text NOT NULL DEFAULT '',
  tweet_id text NOT NULL,
  kind text NOT NULL DEFAULT 'tweet',
  content text NOT NULL DEFAULT '',
  like_count integer NOT NULL DEFAULT 0,
  retweet_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  quote_count integer NOT NULL DEFAULT 0,
  bookmark_count integer NOT NULL DEFAULT 0,
  impression_count integer NOT NULL DEFAULT 0,
  tweeted_at timestamp with time zone,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, tweet_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tweet_metrics TO authenticated;
GRANT ALL ON public.tweet_metrics TO service_role;

ALTER TABLE public.tweet_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own tweet metrics" ON public.tweet_metrics
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER tweet_metrics_updated_at
  BEFORE UPDATE ON public.tweet_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX tweet_metrics_user_idx ON public.tweet_metrics (user_id, tweeted_at DESC);

CREATE TABLE public.persona_state (
  persona_id text PRIMARY KEY,
  adaptive jsonb NOT NULL DEFAULT '{}'::jsonb,
  learning_rate numeric NOT NULL DEFAULT 0.10,
  persona_version integer NOT NULL DEFAULT 1,
  drift_score numeric NOT NULL DEFAULT 0,
  frozen boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.persona_state TO authenticated;
GRANT ALL ON public.persona_state TO service_role;
ALTER TABLE public.persona_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read persona state"
  ON public.persona_state FOR SELECT TO authenticated USING (true);

CREATE TRIGGER persona_state_updated_at BEFORE UPDATE ON public.persona_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.persona_learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  outcome text NOT NULL,
  weight numeric NOT NULL,
  field text NOT NULL,
  delta numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX persona_learning_events_persona_idx ON public.persona_learning_events (persona_id, created_at DESC);

GRANT SELECT ON public.persona_learning_events TO authenticated;
GRANT ALL ON public.persona_learning_events TO service_role;
ALTER TABLE public.persona_learning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read learning events"
  ON public.persona_learning_events FOR SELECT TO authenticated USING (true);