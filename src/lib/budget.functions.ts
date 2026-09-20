import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveWorkspaceId } from "./workspace.server";
import { assertAdmin } from "./access";

const MONTH_START = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

export type BudgetSummary = {
  /** Sum of ai_events.estimated_cost_usd for successful calls this month -
   *  our own estimate, never a confirmed provider invoice. */
  estimatedSpendUsd: number;
  /** Count of ai_events rows with no cost estimate at all (no pricing entry
   *  for that model) - excluded from estimatedSpendUsd rather than
   *  silently treated as $0. */
  callsWithoutPricing: number;
  spendLimitUsd: number | null;
  warningThresholdUsd: number | null;
  /** Timestamp of the most recent ai_events row counted above - when this
   *  data was last reconciled, not when the page was loaded. */
  lastReconciledAt: string | null;
  currency: "USD";
};

export const getBudgetSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BudgetSummary> => {
    const workspaceId = await resolveWorkspaceId(context);
    const supabase = context.supabase as any;

    const { data: budget } = await supabase
      .from("workspace_budgets")
      .select("spend_limit_usd, warning_threshold_usd")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const { data: rows, error } = await supabase
      .from("ai_events")
      .select("estimated_cost_usd, created_at")
      .eq("workspace_id", workspaceId)
      .eq("outcome", "success")
      .gte("created_at", MONTH_START())
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as { estimated_cost_usd: number | null; created_at: string }[];
    let estimatedSpendUsd = 0;
    let callsWithoutPricing = 0;
    for (const r of list) {
      if (r.estimated_cost_usd === null) callsWithoutPricing += 1;
      else estimatedSpendUsd += r.estimated_cost_usd;
    }

    return {
      estimatedSpendUsd: Number(estimatedSpendUsd.toFixed(4)),
      callsWithoutPricing,
      spendLimitUsd: budget?.spend_limit_usd ?? null,
      warningThresholdUsd: budget?.warning_threshold_usd ?? null,
      lastReconciledAt: list[0]?.created_at ?? null,
      currency: "USD",
    };
  });

const setBudgetSchema = z.object({
  spendLimitUsd: z.number().min(0).max(1_000_000).nullable(),
  warningThresholdUsd: z.number().min(0).max(1_000_000).nullable(),
});

/**
 * Admin-gated with the same `assertAdmin` check already used for
 * comparable administrative settings elsewhere in this codebase
 * (saveDecisionLogItem, saveXAccount, syncAccountHandles). An earlier
 * version of this function claimed no such server-side check existed
 * anywhere in the app - that was wrong; assertAdmin was already an
 * established, real pattern this function should have used from the start.
 *
 * Writes through the service-role client, not context.supabase:
 * workspace_budgets' RLS is read-only for the "authenticated" role (see
 * 20260920210000_workspace_budgets_trust_boundary.sql) precisely so
 * assertAdmin can't be bypassed by a member calling the client SDK
 * directly - the real boundary is the database, this check is just the
 * friendly error before hitting it.
 */
export const setWorkspaceBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setBudgetSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    assertAdmin(context as any);
    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("workspace_budgets").upsert(
      {
        workspace_id: workspaceId,
        spend_limit_usd: data.spendLimitUsd,
        warning_threshold_usd: data.warningThresholdUsd,
        updated_by: context.userId,
      },
      { onConflict: "workspace_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
