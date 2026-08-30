CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_org()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT org FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION private.can_read_thread(_thread_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = _thread_id
      AND (
        t.user_id = auth.uid()
        OR (t.visibility = 'workspace' AND t.org = 'fkf' AND private.current_org() = 'fkf')
      )
  )
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

GRANT EXECUTE ON FUNCTION private.current_org(), private.can_read_thread(uuid), private.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY "Own profile readable" ON public.profiles;
CREATE POLICY "Own profile readable" ON public.profiles FOR SELECT TO authenticated
USING ((id = auth.uid()) OR (org = 'fkf' AND org = private.current_org()));

DROP POLICY "Read own or shared threads" ON public.threads;
CREATE POLICY "Read own or shared threads" ON public.threads FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR (visibility = 'workspace' AND org = 'fkf' AND private.current_org() = 'fkf'));

DROP POLICY "Read messages of readable threads" ON public.messages;
CREATE POLICY "Read messages of readable threads" ON public.messages FOR SELECT TO authenticated
USING (private.can_read_thread(thread_id));

DROP POLICY "Insert messages into readable threads" ON public.messages;
CREATE POLICY "Insert messages into readable threads" ON public.messages FOR INSERT TO authenticated
WITH CHECK (private.can_read_thread(thread_id));

DROP FUNCTION IF EXISTS public.can_read_thread(uuid);
DROP FUNCTION IF EXISTS public.current_org();
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);