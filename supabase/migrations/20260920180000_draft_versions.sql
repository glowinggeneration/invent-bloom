-- Named draft versions for Studio: saving a version never overwrites or
-- deletes an earlier one - this table is append-only by design (no UPDATE
-- or DELETE policy is granted; see draft-versions.functions.ts, which only
-- ever lists and inserts). "Restoring" a version is a client-side action
-- that loads its content back into the active edit box - nothing here is
-- mutated to do that, so history is preserved by construction, not by
-- convention alone.

CREATE TABLE public.draft_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  name text NOT NULL,
  content text NOT NULL,
  note text NOT NULL DEFAULT '',
  -- Which assistant message / suggestion this version came from, if any -
  -- lets a restored version still be traced back to the persona-test
  -- evidence that shaped it, without duplicating that analysis here.
  source_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  suggestion_index integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX draft_versions_thread_idx ON public.draft_versions (thread_id, created_at DESC);

ALTER TABLE public.draft_versions ENABLE ROW LEVEL SECURITY;

-- Workspace-scoped, not owner-scoped: a draft thread shared with the
-- workspace (threads.visibility = 'workspace') should let any member with
-- access version it, matching how project_references/knowledge_entries are
-- shared workspace content rather than personal state like today_priorities.
CREATE POLICY draft_versions_workspace_read ON public.draft_versions
  FOR SELECT TO authenticated
  USING (private.can_access_workspace(workspace_id));

CREATE POLICY draft_versions_workspace_insert ON public.draft_versions
  FOR INSERT TO authenticated
  WITH CHECK (private.can_access_workspace(workspace_id));
