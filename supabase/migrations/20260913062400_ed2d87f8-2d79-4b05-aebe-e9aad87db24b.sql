DELETE FROM public.mention_keywords
WHERE source = 'seed'
  AND lower(term) IN (
    'football kenya federation','fkf','harambee stars','harambee starlets','fkf premier league',
    'kenyan football','hussein mohammed fkf','fkf president','kenya national team football','fkf elections'
  );

DELETE FROM public.apify_profiles WHERE platform = 'tiktok' AND handle = 'footballkenya';

CREATE TABLE public.workspace_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  org_name text NOT NULL DEFAULT '',
  org_aliases text[] NOT NULL DEFAULT '{}',
  org_handle text NOT NULL DEFAULT '',
  key_figures text[] NOT NULL DEFAULT '{}',
  context_terms text[] NOT NULL DEFAULT '{}',
  workspace_email_domain text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_settings FROM anon, authenticated;
GRANT ALL ON public.workspace_settings TO service_role;

CREATE TRIGGER workspace_settings_updated_at BEFORE UPDATE ON public.workspace_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.workspace_settings (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;

UPDATE public.profiles SET org = 'team' WHERE org = 'fkf';
UPDATE public.threads SET org = 'team' WHERE org = 'fkf';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  configured_domain text;
BEGIN
  SELECT workspace_email_domain INTO configured_domain
  FROM public.workspace_settings WHERE singleton = true;

  INSERT INTO public.profiles (id, email, full_name, org)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    CASE
      WHEN configured_domain IS NOT NULL
        AND configured_domain <> ''
        AND lower(split_part(NEW.email, '@', 2)) = lower(configured_domain)
      THEN 'team'
      ELSE 'external'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Own profile readable" ON public.profiles;
CREATE POLICY "Own profile readable" ON public.profiles FOR SELECT TO authenticated
USING ((id = auth.uid()) OR (org = 'team' AND org = private.current_org()));

DROP POLICY IF EXISTS "Read own or shared threads" ON public.threads;
CREATE POLICY "Read own or shared threads" ON public.threads FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR (visibility = 'workspace' AND org = 'team' AND private.current_org() = 'team'));

CREATE OR REPLACE FUNCTION private.can_read_thread(_thread_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = _thread_id
      AND (
        t.user_id = auth.uid()
        OR (t.visibility = 'workspace' AND t.org = 'team' AND private.current_org() = 'team')
      )
  )
$$;