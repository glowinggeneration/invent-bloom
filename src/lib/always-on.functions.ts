import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./access";
import { logAuditEventAsCaller } from "./platform/audit-log.server";
import type { AlwaysOnPlanView, AlwaysOnPostView } from "./always-on-view";
import type { AlwaysOnFeed } from "./always-on-feed";

const generateSchema = z.object({
  date: z.string().min(8).optional(),
  accountIds: z.array(z.string().uuid()).optional(),
  campaignBrief: z.string().max(600).optional(),
});

const editSchema = z.object({
  postId: z.string().uuid(),
  content: z.string().min(1).max(280),
});

const idSchema = z.object({ postId: z.string().uuid() });

const toggleSchema = z.object({
  accountId: z.string().uuid(),
  alwaysOn: z.boolean(),
});

/** Builds (or rebuilds) today's always-on draft plan for configured accounts. */
export const generateAlwaysOnPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generateSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<AlwaysOnPlanView[]> => {
    assertAdmin(context as any);
    const { runDailyPlanning } = await import("./always-on-planner.server");
    return runDailyPlanning({
      userId: context.userId,
      replan: true,
      maxAccounts: 12,
      ...(data.date ? { date: data.date } : {}),
      ...(data.accountIds ? { accountIds: data.accountIds } : {}),
      ...(data.campaignBrief ? { campaignBrief: data.campaignBrief } : {}),
    });
  });

/** Reads the stored plan for a local day. */
export const listAlwaysOnPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ date: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }): Promise<AlwaysOnPlanView[]> => {
    assertAdmin(context as any);
    const { loadPlans } = await import("./always-on-planner.server");
    return loadPlans({ userId: context.userId, ...(data.date ? { date: data.date } : {}) });
  });

/** Reads everything published through the reviewed Always-On workflow. */
export const listAlwaysOnPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AlwaysOnFeed> => {
    assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("persona_daily_posts")
      .select(
        "id, account_id, category, topic, content, image_url, published_at, scheduled_at, result_tweet_id",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(data.limit ?? 200);
    if (error) throw new Error(error.message);

    const posts = rows ?? [];
    const accountIds = [...new Set(posts.map((p: any) => p.account_id))];
    const accountMap = new Map<
      string,
      { handle: string; displayName: string; avatarUrl: string | null; personaName: string }
    >();
    if (accountIds.length) {
      const { data: accounts } = await supabaseAdmin
        .from("x_accounts")
        .select("id, handle, display_name, avatar_url, persona_label")
        .in("id", accountIds);
      for (const a of accounts ?? []) {
        accountMap.set(a.id, {
          handle: a.handle,
          displayName: a.display_name ?? a.handle,
          avatarUrl: a.avatar_url ?? null,
          personaName: a.persona_label ?? "",
        });
      }
    }

    const items = posts.map((p: any) => {
      const acct = accountMap.get(p.account_id);
      const handle = acct?.handle ?? "";
      return {
        id: p.id as string,
        handle,
        displayName: acct?.displayName ?? handle,
        avatarUrl: acct?.avatarUrl ?? null,
        personaName: acct?.personaName ?? "",
        category: p.category as string,
        topic: (p.topic as string) ?? "",
        content: (p.content as string) ?? "",
        imageUrl: (p.image_url as string) ?? null,
        publishedAt: (p.published_at as string) ?? (p.scheduled_at as string),
        tweetId: (p.result_tweet_id as string) ?? null,
        tweetUrl:
          p.result_tweet_id && handle
            ? `https://x.com/${handle}/status/${p.result_tweet_id}`
            : null,
      };
    });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return {
      items,
      total: items.length,
      today: items.filter((i) => new Date(i.publishedAt).getTime() >= startOfDay.getTime()).length,
      accounts: new Set(items.map((i) => i.handle)).size,
      lastPublishedAt: items[0]?.publishedAt ?? null,
    };
  });

/** Edits a planned post; the edit is re-checked by the legal engine. */
export const editAlwaysOnPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => editSchema.parse(input))
  .handler(async ({ data, context }): Promise<AlwaysOnPostView> => {
    assertAdmin(context as any);
    const { updatePostContent } = await import("./always-on-planner.server");
    const result = await updatePostContent({ userId: context.userId, ...data });
    await logAuditEventAsCaller(context.supabase, {
      action: "content.edit",
      resourceTable: "persona_daily_posts",
      resourceId: data.postId,
    });
    return result;
  });

/** Marks a held post as approved for publishing after human review. */
export const approveAlwaysOnPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }): Promise<AlwaysOnPostView> => {
    assertAdmin(context as any);
    const { setPostStatus } = await import("./always-on-planner.server");
    const result = await setPostStatus({
      userId: context.userId,
      postId: data.postId,
      status: "scheduled",
    });
    await logAuditEventAsCaller(context.supabase, {
      action: "content.status_change",
      resourceTable: "persona_daily_posts",
      resourceId: data.postId,
      metadata: { status: "scheduled" },
    });
    return result;
  });

/** Skips a planned post for the day. */
export const skipAlwaysOnPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }): Promise<AlwaysOnPostView> => {
    assertAdmin(context as any);
    const { setPostStatus } = await import("./always-on-planner.server");
    const result = await setPostStatus({
      userId: context.userId,
      postId: data.postId,
      status: "skipped",
    });
    await logAuditEventAsCaller(context.supabase, {
      action: "content.status_change",
      resourceTable: "persona_daily_posts",
      resourceId: data.postId,
      metadata: { status: "skipped" },
    });
    return result;
  });

/**
 * Publishes exactly one reviewed planned post. Bulk/background publication is
 * disabled so editorial planning cannot silently become an activity simulator.
 */
export const publishDueAlwaysOnPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ published: number; failed: number }> => {
    assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: executionState, error: stateError } = await (supabaseAdmin as any)
      .from("workspace_execution_state")
      .select("paused, reason")
      .eq("singleton", true)
      .maybeSingle();
    if (stateError) throw new Error(stateError.message);
    if (executionState?.paused) {
      throw new Error(
        `Workspace execution is paused${executionState.reason ? `: ${executionState.reason}` : "."}`,
      );
    }

    const { publishDue } = await import("./always-on-planner.server");
    const result = await publishDue({ userId: context.userId, postId: data.postId });
    await logAuditEventAsCaller(context.supabase, {
      action: "ai.publish",
      resourceTable: "persona_daily_posts",
      resourceId: data.postId,
      metadata: result,
    });
    return result;
  });

/** Turns editorial planning on or off for one linked account. */
export const setAccountAlwaysOn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => toggleSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("x_accounts")
      .update({ always_on: data.alwaysOn })
      .eq("id", data.accountId);
    if (error) throw new Error(error.message);
    await logAuditEventAsCaller(context.supabase, {
      action: "config.change",
      resourceTable: "x_accounts",
      resourceId: data.accountId,
      metadata: { alwaysOn: data.alwaysOn },
    });
    return { ok: true };
  });
