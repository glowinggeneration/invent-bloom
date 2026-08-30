import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "./access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { spreadTimes } from "./spread";

export type ScheduledActionView = {
  id: string;
  source: string;
  handle: string;
  personaName: string;
  actionType: string;
  content: string;
  targetTweetId: string | null;
  targetHandle: string | null;
  runAt: string;
  status: string;
  attempts: number;
  error: string | null;
};

function toView(row: any): ScheduledActionView {
  return {
    id: row.id,
    source: row.source,
    handle: row.handle ?? "",
    personaName: row.persona_name ?? "",
    actionType: row.action_type,
    content: row.content ?? "",
    targetTweetId: row.target_tweet_id ?? null,
    targetHandle: row.target_handle ?? null,
    runAt: row.run_at,
    status: row.status,
    attempts: row.attempts ?? 0,
    error: row.error ?? null,
  };
}

/** Everything still waiting to run, soonest first. */
export const listScheduledActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScheduledActionView[]> => {
    assertAdmin(context as any);
    const { data, error } = await (context.supabase as any)
      .from("scheduled_actions")
      .select("*")
      .in("status", ["pending", "running"])
      .order("run_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map(toView);
  });

/** Cancels one queued action, or everything still pending. */
export const cancelScheduledActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().optional(), all: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ cancelled: number }> => {
    assertAdmin(context as any);
    let query = (context.supabase as any)
      .from("scheduled_actions")
      .update({ status: "cancelled" })
      .eq("status", "pending");
    if (!data.all && data.id) query = query.eq("id", data.id);
    const { data: rows, error } = await query.select("id");
    if (error) throw new Error(error.message);
    return { cancelled: (rows ?? []).length };
  });

/** Manual drain, for when someone does not want to wait for the next tick. */
export const runScheduledNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runDueScheduledActions } = await import("./scheduler.server");
    return runDueScheduledActions({ admin: supabaseAdmin as any, userId: context.userId });
  });

/**
 * Link queue with a human spread: every active persona likes / retweets /
 * bookmarks each pasted tweet, scattered across the chosen window.
 */
export const scheduleLinkQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tweetIds: z.array(z.string().trim().min(1).max(40)).min(1).max(100),
        spreadHours: z.number().int().min(1).max(48),
        actions: z
          .object({
            like: z.boolean().default(true),
            retweet: z.boolean().default(true),
            bookmark: z.boolean().default(true),
          })
          .default({ like: true, retweet: true, bookmark: true }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ scheduled: number }> => {
    assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enqueueScheduledActions } = await import("./scheduler.server");

    const { data: accounts, error } = await supabaseAdmin
      .from("x_accounts")
      .select("id, handle")
      .eq("is_active", true)
      .eq("suspended", false);
    if (error) throw new Error(error.message);
    const list = (accounts ?? []) as { id: string; handle: string }[];
    {
      const { recordSkippedAccounts } = await import("./skip-audit.server");
      await recordSkippedAccounts(supabaseAdmin as any, { userId: context.userId, source: "like" });
    }
    if (!list.length) throw new Error("No active accounts to schedule.");

    const kinds = (["like", "retweet", "bookmark"] as const).filter((k) => data.actions[k]);
    if (!kinds.length) throw new Error("Choose at least one action.");

    const units: { accountId: string; handle: string; kind: string; tweetId: string }[] = [];
    for (const tweetId of data.tweetIds) {
      for (const acc of list) {
        for (const kind of kinds) {
          units.push({ accountId: acc.id, handle: acc.handle, kind, tweetId });
        }
      }
    }
    const times = spreadTimes(units.length, data.spreadHours);
    const rows = units.map((u, i) => ({
      user_id: context.userId,
      source: "queue" as const,
      account_id: u.accountId,
      handle: u.handle,
      action_type: u.kind as "like" | "retweet" | "bookmark",
      target_tweet_id: u.tweetId,
      run_at: times[i]!,
    }));
    await enqueueScheduledActions(supabaseAdmin as any, rows);
    return { scheduled: rows.length };
  });
