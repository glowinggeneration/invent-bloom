-- Knowledge Library: approved facts, product details, terminology, brand
-- positioning and previous statements. Entries are organisation-wide when
-- project_id is null, project-specific otherwise. Studio retrieves approved,
-- non-expired entries as authoritative context and flags drafts that appear
-- to conflict with them - AI-generated text is never itself treated as a
-- verified fact, only human approval moves an entry to 'approved'.

CREATE TABLE public.knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (
    category IN ('fact', 'product_detail', 'terminology', 'positioning', 'prior_statement')
  ),
  title text NOT NULL,
  content text NOT NULL,
  source text NOT NULL DEFAULT '',
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (
    approval_status IN ('pending', 'approved', 'rejected', 'superseded')
  ),
  version integer NOT NULL DEFAULT 1,
  review_date date,
  expiry_date date,
  -- Points at the newer entry that replaced this one, set when this row is
  -- marked 'superseded'. Never a delete, so old guidance stays auditable.
  superseded_by uuid REFERENCES public.knowledge_entries(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_entries_workspace_idx ON public.knowledge_entries (workspace_id);
CREATE INDEX knowledge_entries_project_idx ON public.knowledge_entries (project_id);
CREATE INDEX knowledge_entries_status_idx ON public.knowledge_entries (workspace_id, approval_status);

ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_entries_workspace_access ON public.knowledge_entries
  FOR ALL TO authenticated
  USING (private.can_access_workspace(workspace_id))
  WITH CHECK (private.can_access_workspace(workspace_id));

CREATE TRIGGER knowledge_entries_updated_at
  BEFORE UPDATE ON public.knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Immutable snapshot taken before every content/title/category edit, so
-- revision history survives even though the entry row itself is mutated in
-- place. Approval-status-only changes (approve/reject/supersede) do not
-- snapshot - only substantive content edits do.
CREATE TABLE public.knowledge_entry_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.knowledge_entries(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  approval_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_entry_versions_entry_idx
  ON public.knowledge_entry_versions (entry_id, version DESC);

ALTER TABLE public.knowledge_entry_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_entry_versions_workspace_access ON public.knowledge_entry_versions
  FOR ALL TO authenticated
  USING (private.can_access_workspace(workspace_id))
  WITH CHECK (private.can_access_workspace(workspace_id));
