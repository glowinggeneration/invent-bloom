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

create table if not exists public.monitoring_watchlist (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('account','publication','journalist','official','influencer','competitor','organisation','keyword')),
  label text not null,
  value text not null,
  platform text,
  priority text not null default 'standard' check (priority in ('critical','high','standard')),
  notes text not null default '',
  alert_enabled boolean not null default true,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, value)
);

alter table public.monitoring_watchlist enable row level security;
revoke all on public.monitoring_watchlist from anon, authenticated;
grant all on public.monitoring_watchlist to service_role;

create index if not exists monitoring_watchlist_active_idx
  on public.monitoring_watchlist (is_active, priority, created_at desc);

create table if not exists public.decision_log (
  id uuid primary key default gen_random_uuid(),
  insight text not null,
  decision text not null,
  owner text not null default '',
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  result text not null default '',
  source_url text,
  due_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.decision_log enable row level security;
revoke all on public.decision_log from anon, authenticated;
grant all on public.decision_log to service_role;

create index if not exists decision_log_status_idx
  on public.decision_log (status, created_at desc);

create table if not exists public.workspace_execution_state (
  singleton boolean primary key default true check (singleton),
  paused boolean not null default false,
  reason text not null default '',
  paused_by uuid,
  paused_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.workspace_execution_state enable row level security;
revoke all on public.workspace_execution_state from anon, authenticated;
grant all on public.workspace_execution_state to service_role;

insert into public.workspace_execution_state (singleton, paused)
values (true, false)
on conflict (singleton) do nothing;

update public.listening_campaigns set is_active = false where is_active = true;

ALTER TABLE public.scheduled_actions ADD COLUMN IF NOT EXISTS reassignments integer NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "Shared workspace x accounts" ON public.x_accounts;

CREATE POLICY "Owners can read their X accounts"
ON public.x_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Owners can create their X accounts"
ON public.x_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update their X accounts"
ON public.x_accounts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete their X accounts"
ON public.x_accounts FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_roles_no_client_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_no_client_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_no_client_delete" ON public.user_roles;
CREATE POLICY "user_roles_no_client_insert" ON public.user_roles FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "user_roles_no_client_update" ON public.user_roles FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "user_roles_no_client_delete" ON public.user_roles FOR DELETE TO authenticated, anon USING (false);
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;
GRANT ALL ON public.user_roles TO service_role;

REVOKE ALL ON public.x_login_attempts FROM authenticated, anon;
GRANT ALL ON public.x_login_attempts TO service_role;
ALTER TABLE public.x_login_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "x_login_attempts_no_client_access" ON public.x_login_attempts;
CREATE POLICY "x_login_attempts_no_client_access" ON public.x_login_attempts FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Shared workspace skip audit readable" ON public.campaign_skip_audit;
DROP POLICY IF EXISTS "campaign_skip_audit_select" ON public.campaign_skip_audit;
CREATE POLICY "campaign_skip_audit_select" ON public.campaign_skip_audit FOR SELECT TO authenticated USING (user_id = auth.uid());