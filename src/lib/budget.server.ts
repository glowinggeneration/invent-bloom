/**
 * Server-only spend-limit enforcement. Only wired into the one AI call site
 * already instrumented with ai-observability (smait.server.ts's persona
 * panel/synthesis, the highest-cost feature in this app) - the other seven
 * direct-fetch AI call sites remain unenforced, matching the existing §9.8
 * partial-instrumentation gap already on record in EXCEPTION_REGISTER.md.
 */

const MONTH_START = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

export class SpendLimitExceededError extends Error {
  constructor(spentUsd: number, limitUsd: number) {
    super(
      `This workspace has spent an estimated $${spentUsd.toFixed(2)} on AI this month, at or over its $${limitUsd.toFixed(2)} limit. Raise the limit in Plan & usage to continue.`,
    );
    this.name = "SpendLimitExceededError";
  }
}

/**
 * Refuses a new AI call once this month's estimated spend has already
 * reached the workspace's limit. This is post-hoc gating on cumulative
 * spend, not a per-request pre-flight estimate - the gateway gives no way
 * to know a call's cost before it completes, so blocking happens on the
 * running total, not on a prediction for the call about to be made.
 */
export async function checkSpendLimit(
  supabase: { from: (table: string) => any },
  workspaceId: string,
): Promise<void> {
  const { data: budget } = await supabase
    .from("workspace_budgets")
    .select("spend_limit_usd")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const limit = budget?.spend_limit_usd;
  if (limit === null || limit === undefined) return;

  const { data: rows, error } = await supabase
    .from("ai_events")
    .select("estimated_cost_usd")
    .eq("workspace_id", workspaceId)
    .eq("outcome", "success")
    .gte("created_at", MONTH_START());
  if (error) throw new Error(error.message);

  const spent = ((rows ?? []) as { estimated_cost_usd: number | null }[]).reduce(
    (sum, r) => sum + (r.estimated_cost_usd ?? 0),
    0,
  );
  if (spent >= Number(limit)) {
    throw new SpendLimitExceededError(spent, Number(limit));
  }
}
