-- Today's priorities: a personal, ordered shortlist (default limit 3,
-- configurable client-side per user - see today-priorities.ts) of what a
-- user has chosen to focus on, distinct from the full backlog (Decision
-- Log, Mentions, Campaign Manager) which stays fully accessible on its own
-- pages. Deliberately per-user, not shared workspace state - two teammates
-- can prioritise differently from the same backlog.

CREATE TABLE public.today_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'custom' covers a priority typed directly on Today with no linked
  -- record; every other type has item_id pointing at the real source row,
  -- so status/context always reflects that record, never a stale copy.
  item_type text NOT NULL CHECK (
    item_type IN ('decision', 'investigation', 'campaign', 'report', 'custom')
  ),
  item_id uuid,
  title text NOT NULL,
  -- The user's own note on why this matters right now - preserved across
  -- reorder/defer/complete, since that's the context "preserving context"
  -- actually refers to (the linked record's own data never changes here).
  note text NOT NULL DEFAULT '',
  href text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deferred', 'completed')),
  defer_reason text,
  defer_until date,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX today_priorities_user_idx
  ON public.today_priorities (workspace_id, user_id, status, position);

ALTER TABLE public.today_priorities ENABLE ROW LEVEL SECURITY;

-- Workspace-scoped AND owner-scoped: a priority is only ever visible to or
-- writable by the user who set it, even though it lives in a shared
-- workspace table (same combined pattern as x_accounts/threads elsewhere
-- in this schema).
CREATE POLICY today_priorities_owner_access ON public.today_priorities
  FOR ALL TO authenticated
  USING (private.can_access_workspace(workspace_id) AND user_id = auth.uid())
  WITH CHECK (private.can_access_workspace(workspace_id) AND user_id = auth.uid());

CREATE TRIGGER today_priorities_updated_at
  BEFORE UPDATE ON public.today_priorities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
