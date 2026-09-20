-- Adds the minimum real schema for AI spend tracking. No AI/LLM cost concept
-- existed anywhere in this codebase before this migration - only Twitter/X
-- action credits (a separate provider, see src/lib/action-cost.ts) and soft,
-- unenforced plan_limits call counts.
--
-- NOTE: this migration originally also tried to CREATE TABLE
-- idempotency_keys, on the mistaken understanding (from research at the
-- time) that the scaffold in src/lib/platform/idempotency.server.ts had
-- never been given a table. That was wrong - idempotency_keys has existed
-- since 20260830190000_platform_scaffolding.sql, including workspace_id
-- (added 20260909120000, set NOT NULL 20260909123000). The duplicate
-- CREATE TABLE was removed before this migration ever shipped to a real
-- database; createSupabaseIdempotencyStore was fixed to write workspace_id
-- so it satisfies that pre-existing NOT NULL constraint - see
-- src/lib/platform/idempotency.server.ts.

-- Per-workspace AI spend limit and warning threshold. Nullable - absence
-- means "no limit set", not "zero budget". Distinct from plan_limits
-- (tier-wide call-count caps, already soft-enforced) - this is a real
-- monetary ceiling a workspace admin opts into.
CREATE TABLE public.workspace_budgets (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  spend_limit_usd numeric(10, 2),
  warning_threshold_usd numeric(10, 2),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_budgets_workspace_access ON public.workspace_budgets
  FOR ALL TO authenticated
  USING (private.can_access_workspace(workspace_id))
  WITH CHECK (private.can_access_workspace(workspace_id));

CREATE TRIGGER workspace_budgets_updated_at
  BEFORE UPDATE ON public.workspace_budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Estimated cost of one AI gateway call, computed from this codebase's own
-- published-pricing table (src/lib/ai-pricing.ts) at the moment the event is
-- recorded - never a figure confirmed by the provider. Nullable: events
-- recorded before this column existed, or for a model with no pricing entry,
-- have no estimate rather than a fabricated one.
ALTER TABLE public.ai_events ADD COLUMN estimated_cost_usd numeric(10, 4);

COMMENT ON COLUMN public.ai_events.estimated_cost_usd IS
  'Our own estimate from ai-pricing.ts token rates - never a confirmed provider charge. NULL when the model has no pricing entry.';
