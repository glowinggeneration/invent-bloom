-- Same audit, one more gap in the same table: deleteKnowledgeEntry's
-- ".in('approval_status', ['pending','rejected'])" guard is only a WHERE
-- clause in application code - RLS's FOR ALL policy doesn't restrict
-- DELETE by approval_status at all, so a workspace member could delete an
-- approved or superseded entry directly via the client SDK, bypassing that
-- guard entirely. Same fix shape as the UPDATE/superseded_by boundary:
-- reject the delete at the database layer unless it's the service role.

CREATE OR REPLACE FUNCTION private.enforce_knowledge_delete_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND OLD.approval_status NOT IN ('pending', 'rejected') THEN
    RAISE EXCEPTION 'Only an authorised reviewer can delete an approved or superseded knowledge entry.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER knowledge_entries_delete_admin_only
  BEFORE DELETE ON public.knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION private.enforce_knowledge_delete_admin_only();
