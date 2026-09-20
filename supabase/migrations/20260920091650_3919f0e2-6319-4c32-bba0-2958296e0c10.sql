create or replace function public.add_profile_to_default_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values ('00000000-0000-0000-0000-000000000001', new.id, 'member')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_default_workspace on public.profiles;
create trigger profiles_default_workspace
after insert on public.profiles
for each row execute function public.add_profile_to_default_workspace();