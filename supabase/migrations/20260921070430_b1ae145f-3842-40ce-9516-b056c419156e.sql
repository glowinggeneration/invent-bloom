-- Projects: a workspace-scoped grouping entity that keeps a communications
-- objective/brief, reference material, investigations, message tests,
-- campaigns and reports together, without duplicating the content of any
-- existing record.
--
-- Design (see docs/build-standards/EXCEPTION_REGISTER.md for the research
-- this was based on):
--   - `objective`/`brief` are the project's OWN text fields, not a link to
--     the separate computed "Executive Brief" page (that page has no
--     stable row - it's a live query, nothing to link to).
--   - Existing linkable records (threads, publish_jobs, listening_campaigns,
--     reports, managed_reports) get a nullable `project_id` column, matching
--     Phase 1's own precedent of adding nullable tenancy columns onto
--     existing tables rather than a polymorphic join table - this keeps a
--     real FK/referential-integrity guarantee per record type. ON DELETE
--     SET NULL (not CASCADE): deleting or archiving a project must never
--     delete historical work - "Historical work should remain accessible
--     without requiring a project" is a hard requirement, not a preference.
--   - `investigations` did not exist as a server table before this
--     migration (saved investigations were client-only localStorage) -
--     created here because the next stage (project-linked investigations)
--     needs a stable server-side id to link, and localStorage ids aren't
--     linkable across devices or by other workspace members.
--   - `project_references` is new: reference material a project keeps for
--     (a note, a link, a pasted brief attachment) with an `excluded` flag
--     so the context panel can let a user turn a reference off for a task
--     without deleting it.

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text NOT NULL DEFAULT '',
  brief text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_workspace_idx ON public.projects (workspace_id);
CREATE INDEX projects_workspace_status_idx ON public.projects (workspace_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members manage projects" ON public.projects
FOR ALL TO authenticated
USING (private.can_access_workspace(workspace_id))
WITH CHECK (private.can_access_workspace(workspace_id));

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reference material: a note, a pasted brief, or a link a project keeps for
-- context. `excluded` lets a user turn one off for a task (the context
-- panel) without deleting it - editing/excluding are both non-destructive.
CREATE TABLE public.project_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  url text,
  excluded boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_references_project_idx ON public.project_references (project_id);
CREATE INDEX project_references_workspace_idx ON public.project_references (workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_references TO authenticated;
GRANT ALL ON public.project_references TO service_role;
ALTER TABLE public.project_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members manage project references" ON public.project_references
FOR ALL TO authenticated
USING (private.can_access_workspace(workspace_id))
WITH CHECK (private.can_access_workspace(workspace_id));

CREATE TRIGGER project_references_updated_at BEFORE UPDATE ON public.project_references
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Investigations: promoted from client-only localStorage (see
-- src/components/saved-investigations.tsx) to a real, workspace-scoped,
-- optionally project-linked row. project_id is nullable - an investigation
-- started outside any project remains valid and later linkable.
CREATE TABLE public.investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  topic text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investigations_workspace_idx ON public.investigations (workspace_id);
CREATE INDEX investigations_project_idx ON public.investigations (project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investigations TO authenticated;
GRANT ALL ON public.investigations TO service_role;
ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members manage investigations" ON public.investigations
FOR ALL TO authenticated
USING (private.can_access_workspace(workspace_id))
WITH CHECK (private.can_access_workspace(workspace_id));

CREATE TRIGGER investigations_updated_at BEFORE UPDATE ON public.investigations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link existing records rather than duplicating their contents: nullable
-- project_id on each linkable table. ON DELETE SET NULL throughout, so a
-- deleted/archived project never takes historical work down with it.

ALTER TABLE public.threads
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX threads_project_idx ON public.threads (project_id);

ALTER TABLE public.publish_jobs
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX publish_jobs_project_idx ON public.publish_jobs (project_id);

ALTER TABLE public.listening_campaigns
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX listening_campaigns_project_idx ON public.listening_campaigns (project_id);

ALTER TABLE public.reports
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX reports_project_idx ON public.reports (project_id);

ALTER TABLE public.managed_reports
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX managed_reports_project_idx ON public.managed_reports (project_id);