CREATE OR REPLACE FUNCTION private.can_access_workspace(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = _workspace_id
        AND wm.user_id = auth.uid()
    );
$$;
REVOKE ALL ON FUNCTION private.can_access_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_access_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_workspace(uuid) TO service_role;