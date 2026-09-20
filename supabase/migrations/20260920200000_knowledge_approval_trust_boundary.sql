-- Closes a real gap found auditing this session's own work: RLS on
-- knowledge_entries is FOR ALL (needed so any workspace member can draft an
-- entry), which also means, on its own, any workspace member could change
-- approval_status or superseded_by directly via the client SDK - bypassing
-- the assertAdmin() check in setKnowledgeApprovalStatus/
-- supersedeKnowledgeEntry entirely, since that check only guards those two
-- server functions, not the table itself.
--
-- decision_log and managed_reports avoid this by being entirely
-- service-role-only tables (no member ever writes to them at all). That
-- shape doesn't fit here - drafting must stay open to any member, and
-- updateKnowledgeEntry (open to any member) legitimately demotes an edited
-- entry from 'approved' back to 'pending' as a safety measure, using the
-- RLS-scoped client. So the boundary enforced here is specifically about
-- *elevating* trust, not touching the field at all: any member may move an
-- entry TO 'pending' (always a safe demotion), but only the service-role
-- connection (supabaseAdmin, used only by the now-admin-gated
-- setKnowledgeApprovalStatus/supersedeKnowledgeEntry) may set it to
-- 'approved'/'rejected'/'superseded', or touch superseded_by at all.

CREATE OR REPLACE FUNCTION private.enforce_knowledge_approval_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.superseded_by IS DISTINCT FROM OLD.superseded_by THEN
      RAISE EXCEPTION 'Only an authorised reviewer can supersede a knowledge entry.';
    END IF;
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
       AND NEW.approval_status <> 'pending' THEN
      RAISE EXCEPTION 'Only an authorised reviewer can approve, reject or supersede a knowledge entry.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER knowledge_entries_approval_admin_only
  BEFORE UPDATE ON public.knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION private.enforce_knowledge_approval_admin_only();
