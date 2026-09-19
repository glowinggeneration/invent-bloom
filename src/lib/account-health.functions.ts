import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkAccountHealth, type AccountHealthResult } from "./x-compliance.server";

export type { AccountHealthResult, AccountHealthActionStatus } from "./x-compliance.server";

const ACTION_TYPES = ["tweet", "comment", "like", "retweet", "bookmark"] as const;

const inputSchema = z.object({
  accountIds: z.array(z.string().uuid()).min(1).max(200),
  actionTypes: z.array(z.enum(ACTION_TYPES)).min(1),
});

/**
 * Proactive account-health preflight for the campaign planner UIs. Reads the
 * same rolling-24h budgets `planCompliantSchedule` enforces at enqueue time,
 * so an operator can see remaining daily budget, cooldowns, and
 * suspended/no-session accounts before they submit a campaign.
 *
 * This never mutates anything and is not itself an enforcement point —
 * `planCompliantSchedule` (src/lib/x-compliance.server.ts, called from
 * `enqueueScheduledActions`) remains the final, authoritative gate.
 */
export const getAccountHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AccountHealthResult[]> => {
    return checkAccountHealth(context.supabase, {
      accountIds: data.accountIds,
      actionTypes: data.actionTypes,
    });
  });
