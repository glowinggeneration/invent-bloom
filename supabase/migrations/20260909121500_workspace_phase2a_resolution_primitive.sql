-- Multi-tenant SaaS conversion, Phase 2a: workspace-resolution primitive.
--
-- private.current_workspace_id() mirrors private.current_org()'s exact
-- convention (SQL, STABLE, SECURITY DEFINER, SET search_path, private
-- schema). It resolves to the single workspace the calling user belongs to,
-- which is correct for this app's current scope - every signup owns exactly
-- one workspace, there is no invite/multi-workspace-membership or
-- workspace-switcher feature yet. workspace_members' shape (a join table,
-- not a single column on profiles) already allows a user to belong to more
-- than one workspace in the future; if a multi-workspace feature ships
-- later, this function's LIMIT 1 (arbitrary tie-break) needs to become a
-- real "active workspace" selection instead, and RLS policies that need to
-- check membership rather than resolve one value should use
-- private.can_access_workspace() below, not this function.
--
-- private.can_access_workspace() checks membership existence directly and
-- is what workspace_id-scoped RLS policies use going forward (Phase 2b) -
-- it naturally supports a user belonging to multiple workspaces without any
-- "which one wins" ambiguity, unlike a single resolved value.

CREATE OR REPLACE FUNCTION private.current_workspace_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.can_access_workspace(_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = auth.uid() AND workspace_id = _workspace_id
  )
$$;

GRANT EXECUTE ON FUNCTION private.current_workspace_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_workspace(uuid) TO authenticated, service_role;

-- Read policies deferred from Phase 1: a member can read their own
-- workspace row and their own membership rows (already had the latter from
-- Phase 1 via "Own membership rows readable" - this adds the workspaces
-- table's read policy now that can_access_workspace() exists to express it
-- without duplicating the membership-lookup subquery inline).
CREATE POLICY "Members can read their workspace" ON public.workspaces
FOR SELECT TO authenticated USING (private.can_access_workspace(id));
