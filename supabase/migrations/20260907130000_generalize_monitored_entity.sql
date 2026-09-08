-- Stage 2 of the SMAIT rebrand: replace the hardcoded "FKF / its president"
-- monitored subject with a workspace-configurable one, and rename the
-- tenant-scoping value from the literal 'fkf' to a neutral 'team'.
--
-- 'team' (not 'workspace') is used deliberately: public.threads.visibility
-- already uses the literal 'workspace' to mean "shared within the team", so
-- reusing that word for the org value would read as
-- `visibility = 'workspace' AND org = 'workspace'` - two different columns
-- coincidentally equal to the same string. 'team' keeps the two concepts
-- visually distinct.

-- 1. Workspace-wide monitored-entity configuration (singleton row, same
-- pattern as public.workspace_execution_state). Empty by default - the
-- platform ships generic/unconfigured until an admin fills this in via
-- setup or governance.
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

INSERT INTO public.workspace_settings (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

-- 2. Rename the tenant value on existing rows. This only affects rows that
-- were seeded/assigned under the old hardcoded-domain rule; it does not
-- change who is a member, just what the membership value is called.
UPDATE public.profiles SET org = 'team' WHERE org = 'fkf';
UPDATE public.threads SET org = 'team' WHERE org = 'fkf';

-- 3. handle_new_user() no longer hardcodes a domain. It reads the
-- configured workspace_email_domain and only auto-assigns 'team' when one
-- is set and matches. With no domain configured (the default), every new
-- signup is 'external' until an admin promotes them - same fail-closed
-- default as before, just not pointed at a specific domain.
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

-- 4. Re-point the three RLS policies that compared org to the literal
-- 'fkf' at 'team' instead. private.current_org()/private.can_read_thread()
-- themselves have no hardcoded value (they just read/compare the org
-- column), so only the policies need updating.
DROP POLICY "Own profile readable" ON public.profiles;
CREATE POLICY "Own profile readable" ON public.profiles FOR SELECT TO authenticated
USING ((id = auth.uid()) OR (org = 'team' AND org = private.current_org()));

DROP POLICY "Read own or shared threads" ON public.threads;
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
