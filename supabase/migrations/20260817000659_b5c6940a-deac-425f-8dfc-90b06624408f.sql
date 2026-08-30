-- Platform control surfaces used by the Watchlist, Decision Log and emergency stop.
-- These tables are only accessed through authenticated server functions. RLS stays
-- enabled with no direct client policies so browser code cannot mutate them.

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

insert into public.workspace_execution_state (singleton, paused)
values (true, false)
on conflict (singleton) do nothing;

-- The Monitoring Watchlist intentionally starts clean. Legacy campaign-network
-- handles are not migrated into intelligence priorities. Administrators add
-- real journalists, publications, officials, organisations, accounts and
-- keywords through the Watchlist UI after deployment.