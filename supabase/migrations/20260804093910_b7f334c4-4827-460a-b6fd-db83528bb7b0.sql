
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
