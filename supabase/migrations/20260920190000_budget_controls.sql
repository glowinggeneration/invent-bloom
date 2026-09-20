-- Wires up the idempotency scaffold (src/lib/platform/idempotency.server.ts)
-- that has existed unused since Master Rules §8.1 adoption, and adds the
-- minimum real schema for AI spend tracking. No AI/LLM cost concept existed
-- anywhere in this codebase before this migration - only Twitter/X action
-- credits (a separate provider, see src/lib/action-cost.ts) and soft,
-- unenforced plan_limits call counts.

CREATE TABLE public.idempotency_keys (
  key text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idempotency_keys_created_idx ON public.idempotency_keys (created_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- No client policy at all: only the service-role client
-- (createSupabaseIdempotencyStore, called from server functions with
-- supabaseAdmin) ever touches this table. A workspace member has no reason
-- to read or write idempotency bookkeeping directly.

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
