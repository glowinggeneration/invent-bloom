-- Same bug class as knowledge_entries, found by auditing every table this
-- session gave a FOR ALL RLS policy against every function that also calls
-- assertAdmin: workspace_budgets' RLS let any workspace member write
-- directly via the client SDK, regardless of setWorkspaceBudget's
-- assertAdmin() check - that check only ever protected the one server
-- function, never the table itself.
--
-- Unlike knowledge_entries, this table has no legitimate member-write case
-- at all (nobody but an authorised reviewer should ever set a spend limit),
-- so the fix is simpler: narrow the policy to read-only for members (needed
-- so getBudgetSummary's context.supabase read still works) and drop write
-- access entirely - with no INSERT/UPDATE/DELETE policy left, RLS denies
-- those by default for the `authenticated` role. setWorkspaceBudget moves
-- to the service-role client, which RLS never restricts.

DROP POLICY IF EXISTS workspace_budgets_workspace_access ON public.workspace_budgets;

CREATE POLICY workspace_budgets_workspace_read ON public.workspace_budgets
  FOR SELECT TO authenticated
  USING (private.can_access_workspace(workspace_id));
