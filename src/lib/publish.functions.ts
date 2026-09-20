import { createServerFn } from "@tanstack/react-start";
import { assertAdmin } from "./access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAuditEventAsCaller } from "./platform/audit-log.server";
import { resolveWorkspaceId } from "./workspace.server";
import { z } from "zod";
import { DEFAULT_INTENSITY, DEFAULT_TONE, PUBLISH_TONES } from "./voice-controls";
import { RISK_LEVEL_LABELS, transformText } from "./legal-risk";
import {
  accountInputSchema,
  appendLink,
  normalizeEngagementActions,
  normalizeEngagementTargets,
  publishInputSchema,
  type CampaignDetail,
  type PublishActionRow,
  type PublishJobResult,
  type PublishJobSummary,
  type PublishMode,
  type XAccount,
} from "./publish";

export const listXAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ scope: z.enum(["live", "all"]).default("live") })
      .default({ scope: "live" })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data: input }): Promise<XAccount[]> => {
    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin: pool } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (pool as any)
      .from("x_accounts")
      .select(
        "id, handle, display_name, persona_label, bio, is_verified, is_active, always_on, avatar_url, background_url, avatar_color, avatar_credit_name, avatar_credit_url, suspended, previous_handle, handle_synced_at",
      )
      .eq("workspace_id", workspaceId)
      .order("handle");
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tokens } = await (supabaseAdmin as any)
      .from("x_accounts")
      .select("id, auth_token")
      .eq("workspace_id", workspaceId);
    const tokenMap = new Map((tokens ?? []).map((t: any) => [t.id, Boolean(t.auth_token)]));

    // Last activity = most recent publish action or campaign reply per account.
    const lastActivity = new Map<string, string>();
    const note = (id: string | null, at: string | null) => {
      if (!id || !at) return;
      const prev = lastActivity.get(id);
      if (!prev || prev < at) lastActivity.set(id, at);
    };
    const [{ data: actions }, { data: replies }] = await Promise.all([
      context.supabase
        .from("publish_actions")
        .select("account_id, created_at")

        .order("created_at", { ascending: false })
        .limit(2000),
      context.supabase
        .from("campaign_replies")
        .select("account_id, created_at")

        .order("created_at", { ascending: false })
        .limit(2000),
    ]);
    for (const r of actions ?? []) note((r as any).account_id, (r as any).created_at);
    for (const r of replies ?? []) note((r as any).account_id, (r as any).created_at);

    const rows = (data ?? []).map((r: any) => ({
      id: r.id,
      handle: r.handle,
      displayName: r.display_name,
      personaLabel: r.persona_label,
      bio: r.bio ?? "",
      isVerified: r.is_verified ?? false,
      isActive: r.is_active,
      hasToken: tokenMap.get(r.id) ?? false,
      avatarUrl: r.avatar_url ?? null,
      backgroundUrl: r.background_url ?? null,
      avatarColor: r.avatar_color ?? null,
      avatarCreditName: r.avatar_credit_name ?? null,
      avatarCreditUrl: r.avatar_credit_url ?? null,
      alwaysOn: r.always_on ?? false,
      lastActivityAt: lastActivity.get(r.id) ?? null,
      suspended: r.suspended ?? false,
      previousHandle: r.previous_handle ?? null,
      handleSyncedAt: r.handle_synced_at ?? null,
    })) as XAccount[];

    // "Live" = can actually act on X right now: enabled, not suspended and
    // holding a valid session. Everything else stays hidden outside admin.
    if (input.scope === "all") return rows;
    return rows.filter((a) => a.isActive && !a.suspended && a.hasToken);
  });

/**
 * Read the live @username of every connected account from X, store any
 * renames and flag accounts X has suspended.
 */
export const syncAccountHandles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ checked: number; renamed: number; suspended: number }> => {
      assertAdmin(context as any);
      const workspaceId = await resolveWorkspaceId(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { syncHandles } = await import("./handle-sync.server");

      const { data, error } = await (supabaseAdmin as any)
        .from("x_accounts")
        .select("id, handle, display_name, persona_label")
        .eq("workspace_id", workspaceId)
        .order("handle");
      if (error) throw new Error(error.message);

      const rows = await syncHandles(
        (data ?? []).map((a: any) => ({
          id: a.id,
          handle: a.handle,
          displayName: a.display_name || a.persona_label || a.handle,
        })),
      );

      let renamed = 0;
      let suspended = 0;

      // Park renamed rows on a placeholder first so two accounts swapping
      // usernames don't collide on the unique handle constraint.
      for (const row of rows) {
        if (row.newHandle) {
          await supabaseAdmin
            .from("x_accounts")
            .update({ handle: `pending_${row.accountId}` } as never)
            .eq("id", row.accountId);
        }
      }

      for (const row of rows) {
        const patch: Record<string, unknown> = {
          suspended: row.suspended,
          is_verified: row.verified,
          handle_synced_at: new Date().toISOString(),
        };
        if (row.newHandle) {
          patch["handle"] = row.newHandle;
          patch["previous_handle"] = row.handle;
          renamed += 1;
        }
        if (row.suspended) suspended += 1;
        await supabaseAdmin
          .from("x_accounts")
          .update(patch as never)
          .eq("id", row.accountId);
      }

      await logAuditEventAsCaller(context.supabase, {
        action: "integration.change",
        resourceTable: "x_accounts",
        metadata: { checked: rows.length, renamed, suspended },
      });
      return { checked: rows.length, renamed, suspended };
    },
  );

export const getDefaultProxy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ configured: boolean }> => {
    return { configured: Boolean(process.env["DEFAULT_TWITTER_PROXY"]) };
  });

export const saveXAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => accountInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context as any);
    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row: Record<string, unknown> = {
      user_id: context.userId,
      workspace_id: workspaceId,
      handle: data.handle,
      display_name: data.displayName ?? "",
      persona_label: data.personaLabel ?? "",
    };
    if (data.authToken) row["auth_token"] = data.authToken;
    const { error } = await supabaseAdmin
      .from("x_accounts")
      .upsert(row as never, { onConflict: "user_id,handle" });
    if (error) throw new Error(error.message);
    await logAuditEventAsCaller(context.supabase, {
      action: "integration.change",
      resourceTable: "x_accounts",
      metadata: { handle: data.handle },
    });
    return { ok: true };
  });

export const loginAndAddXAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        handle: z.string().trim().min(1).max(30),
        displayName: z.string().trim().max(80).default(""),
        personaLabel: z.string().trim().max(80).default(""),
        proxy: z.string().trim().min(1).max(500),
        userName: z.string().trim().min(1).max(30),
        email: z.string().trim().max(200).default(""),
        password: z.string().trim().min(1).max(200),
        totpSecret: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context as any);
    const workspaceId = await resolveWorkspaceId(context);
    const { loginAccount } = await import("./twitterapi.server");
    const login = await loginAccount({
      userName: data.userName,
      email: data.email,
      password: data.password,
      proxy: data.proxy,
      ...(data.totpSecret ? { totpSecret: data.totpSecret } : {}),
    });
    if ("error" in login) throw new Error(login.error);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("x_accounts").insert({
      user_id: context.userId,
      workspace_id: workspaceId,
      handle: data.handle,
      display_name: data.displayName || login.handle,
      persona_label: data.personaLabel,
      auth_token: login.loginCookies,
      proxy: data.proxy,
    });
    if (error) throw new Error(error.message);
    await logAuditEventAsCaller(context.supabase, {
      action: "integration.change",
      resourceTable: "x_accounts",
      metadata: { handle: data.handle },
    });
    return { ok: true, handle: data.handle };
  });

export const bulkLoginXAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        defaultProxy: z.string().trim().max(500).default(""),
        accounts: z
          .array(
            z.object({
              handle: z.string().trim().min(1).max(30),
              email: z.string().trim().max(200).default(""),
              password: z.string().trim().min(1).max(200),
              proxy: z.string().trim().max(500).default(""),
              totpSecret: z.string().trim().max(200).default(""),
              personaLabel: z.string().trim().max(80).default(""),
            }),
          )
          .min(1)
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context as any);
    const workspaceId = await resolveWorkspaceId(context);
    const { loginAccount } = await import("./twitterapi.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const results: {
      handle: string;
      ok: boolean;
      error?: string;
      needsCode?: boolean;
    }[] = [];

    for (const acc of data.accounts) {
      // Use account proxy, then the UI default proxy, then the server-side secret default.
      const proxy = acc.proxy || data.defaultProxy || process.env["DEFAULT_TWITTER_PROXY"] || "";

      const login = await loginAccount({
        userName: acc.handle,
        email: acc.email,
        password: acc.password,
        proxy,
        ...(acc.totpSecret ? { totpSecret: acc.totpSecret } : {}),
      });
      if ("error" in login) {
        // Accounts that shipped a TOTP secret in the upload never need a manual
        // code - codes are generated from the secret - so surface the real error
        // instead of parking them in the verification queue.
        if (acc.totpSecret) {
          results.push({ handle: acc.handle, ok: false, error: login.error });
          continue;
        }
        // Park the credentials server-side for EVERY failure (auth errors are
        // usually X challenging the login) so the operator can retry with the
        // one-time code X sends to the account.
        await admin.from("x_login_attempts").upsert(
          {
            user_id: context.userId,
            workspace_id: workspaceId,
            handle: acc.handle,
            email: acc.email,
            password: acc.password,
            proxy,
            persona_label: acc.personaLabel,
            status: "pending_code",
            error: login.error,
          },
          { onConflict: "user_id,handle" },
        );
        results.push({
          handle: acc.handle,
          ok: false,
          error: login.error,
          needsCode: true,
        });
        continue;
      }

      const { error } = await supabaseAdmin.from("x_accounts").upsert(
        {
          user_id: context.userId,
          workspace_id: workspaceId,
          handle: acc.handle,
          display_name: login.handle || acc.handle,
          persona_label: acc.personaLabel,
          auth_token: login.loginCookies,
          proxy,
          is_active: true,
        } as never,
        { onConflict: "user_id,handle" },
      );
      if (!error) {
        await admin
          .from("x_login_attempts")
          .delete()
          .eq("handle", acc.handle)
          .eq("workspace_id", workspaceId);
      }
      results.push(
        error
          ? { handle: acc.handle, ok: false, error: error.message }
          : { handle: acc.handle, ok: true },
      );
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1500));
    }
    await logAuditEventAsCaller(context.supabase, {
      action: "integration.change",
      resourceTable: "x_accounts",
      metadata: { count: results.length, succeeded: results.filter((r) => r.ok).length },
    });
    return { results };
  });

export type PendingLogin = {
  id: string;
  handle: string;
  personaLabel: string;
  error: string | null;
  createdAt: string;
};

/** Accounts whose login was interrupted by an X verification code prompt. */
export const listPendingLogins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingLogin[]> => {
    assertAdmin(context as any);
    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("x_login_attempts")
      .select("id, handle, persona_label, error, created_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending_code")
      .order("created_at");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      handle: r.handle,
      personaLabel: r.persona_label ?? "",
      error: r.error,
      createdAt: r.created_at,
    }));
  });

/** Finish a parked login using the one-time code X sent to the account. */
export const submitLoginCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        code: z.string().trim().min(4).max(12),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    assertAdmin(context as any);
    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { checkRateLimit, createSupabaseRateLimitStore, RATE_LIMIT_PRESETS } =
      await import("./platform/rate-limit.server");
    const rate = await checkRateLimit(createSupabaseRateLimitStore(admin), {
      bucketKey: `otp-verify:user:${context.userId}`,
      ...RATE_LIMIT_PRESETS.otpVerify,
    });
    if (!rate.allowed) {
      return { ok: false, error: "Too many verification attempts. Try again in a few minutes." };
    }

    const { data: attempt, error: readErr } = await admin
      .from("x_login_attempts")
      .select("id, handle, email, password, proxy, persona_label")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!attempt) throw new Error("That pending login no longer exists.");

    const { loginAccount } = await import("./twitterapi.server");
    const login = await loginAccount({
      userName: attempt.handle,
      email: attempt.email,
      password: attempt.password,
      proxy: attempt.proxy || process.env["DEFAULT_TWITTER_PROXY"] || "",
      code: data.code,
    });

    if ("error" in login) {
      await admin.from("x_login_attempts").update({ error: login.error }).eq("id", attempt.id);
      return { ok: false, error: login.error };
    }

    const { error: upErr } = await supabaseAdmin.from("x_accounts").upsert(
      {
        user_id: context.userId,
        workspace_id: workspaceId,
        handle: attempt.handle,
        display_name: attempt.handle,
        persona_label: attempt.persona_label ?? "",
        auth_token: login.loginCookies,
        proxy: attempt.proxy,
        is_active: true,
      } as never,
      { onConflict: "user_id,handle" },
    );
    if (upErr) return { ok: false, error: upErr.message };

    await admin.from("x_login_attempts").delete().eq("id", attempt.id);
    await logAuditEventAsCaller(context.supabase, {
      action: "integration.change",
      resourceTable: "x_accounts",
      metadata: { handle: attempt.handle },
    });
    return { ok: true };
  });

/** Drop a parked login (and its stored credentials) without completing it. */
export const dismissPendingLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context as any);
    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("x_login_attempts")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteXAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context as any);
    const { error } = await context.supabase.from("x_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAuditEventAsCaller(context.supabase, {
      action: "data.delete",
      resourceTable: "x_accounts",
      resourceId: data.id,
    });
    return { ok: true };
  });

export const listPublishJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PublishJobSummary[]> => {
    const { data, error } = await context.supabase
      .from("publish_jobs")
      .select(
        "id, mode, tweet_text, comment_text, target_tweet_url, objective_mode, objective_text, status, created_at, engagement_actions, engagement_targets, publish_actions(status)",
      )

      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return (data ?? []).map((j: any) => {
      const actions = (j.publish_actions ?? []) as { status: string }[];
      return {
        id: j.id,
        mode: j.mode as PublishMode,
        tweetText: j.tweet_text,
        commentText: j.comment_text,
        targetTweetUrl: j.target_tweet_url,
        objectiveMode: Boolean(j.objective_mode),
        objectiveText: j.objective_text ?? "",
        status: j.status,
        createdAt: j.created_at,
        engagementActions: normalizeEngagementActions(j.engagement_actions),
        engagementTargets: normalizeEngagementTargets(j.engagement_targets),
        succeeded: actions.filter((a) => a.status === "success").length,
        failed: actions.filter((a) => a.status === "failed").length,
      };
    });
  });

export const getPublishCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<CampaignDetail> => {
    const { data: job, error } = await context.supabase
      .from("publish_jobs")
      .select(
        "id, mode, tweet_text, comment_text, target_tweet_url, objective_mode, objective_text, created_at, engagement_actions, engagement_targets, publish_actions(id, action_type, status, content, result_tweet_id, error, created_at, x_accounts(handle))",
      )
      .eq("id", data.jobId)

      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Campaign not found.");
    const j = job as any;
    const actions = ((j.publish_actions ?? []) as any[])
      .map((a) => {
        const handle = a.x_accounts?.handle ?? "";
        return {
          id: a.id as string,
          handle,
          actionType: a.action_type as string,
          status: a.status as string,
          content: (a.content ?? "") as string,
          tweetId: (a.result_tweet_id ?? null) as string | null,
          url: a.result_tweet_id
            ? `https://x.com/${handle || "i"}/status/${a.result_tweet_id}`
            : null,
          error: (a.error ?? null) as string | null,
          createdAt: a.created_at as string,
        };
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      id: j.id,
      mode: j.mode as PublishMode,
      tweetText: j.tweet_text ?? "",
      commentText: j.comment_text ?? "",
      targetTweetUrl: j.target_tweet_url ?? null,
      objectiveMode: Boolean(j.objective_mode),
      objectiveText: j.objective_text ?? "",
      createdAt: j.created_at,

      engagementActions: normalizeEngagementActions(j.engagement_actions),
      engagementTargets: normalizeEngagementTargets(j.engagement_targets),
      actions,
    };
  });

export const runPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => publishInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<PublishJobResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspaceId = await resolveWorkspaceId(context);

    const operation = async (): Promise<PublishJobResult> => {
      const twitter = await import("./twitterapi.server");

      const { data: accounts, error: accErr } = await (supabaseAdmin as any)
        .from("x_accounts")
        .select("id, handle, auth_token, proxy")
        .eq("workspace_id", workspaceId)
        .eq("suspended", false)
        .eq("is_active", true)
        .in("id", data.accountIds);
      if (accErr) throw new Error(accErr.message);
      {
        const { recordSkippedAccounts } = await import("./skip-audit.server");
        await recordSkippedAccounts(
          supabaseAdmin as any,
          { userId: context.userId, workspaceId, source: "post" },
          data.accountIds,
        );
      }
      if (!accounts || accounts.length === 0) throw new Error("No matching accounts found.");

      // Standing rules apply to EVERY linked account, not just the ones posting.
      const { loadActiveAccounts, loadWatchTargets, loadPeerLatestTargets } =
        await import("./engagement.server");
      const allAccounts = await loadActiveAccounts(supabaseAdmin, context.userId, workspaceId);
      const engagers = allAccounts.length > 0 ? allAccounts : (accounts as any[]);

      const targetId = data.targetTweetUrl ? twitter.extractTweetId(data.targetTweetUrl) : null;
      if (data.mode !== "tweet" && !targetId) {
        throw new Error("Could not read a tweet ID from that URL.");
      }

      const { data: job, error: jobErr } = await (supabaseAdmin as any)
        .from("publish_jobs")
        .insert({
          user_id: context.userId,
          workspace_id: workspaceId,
          mode: data.mode,
          tweet_text: data.tweetText,
          comment_text: data.commentText,
          target_tweet_url: data.targetTweetUrl || null,
          objective_mode: data.objectiveMode,
          objective_text: data.objectiveMode ? data.tweetText || data.commentText : "",
          link_url: data.linkUrl || null,
          image_urls: data.imageUrls,
          engagement_actions: data.actions,
          engagement_targets: data.targets,
          status: "running",
          ...(data.name?.trim() ? { name: data.name.trim(), name_is_custom: true } : {}),
        })
        .select("id")
        .single();
      if (jobErr || !job) throw new Error(jobErr?.message ?? "Could not create publish job.");

      // Persona voices: one random persona per account, same core message.
      const variationMap = new Map<
        string,
        { tweetText: string; commentText: string; personaName: string }
      >();
      if (data.variations.length > 0) {
        for (const v of data.variations) {
          variationMap.set(v.accountId, {
            tweetText: v.tweetText,
            commentText: v.commentText,
            personaName: v.personaName,
          });
        }
      } else if (data.varyByPersona) {
        const { buildPersonaVariations } = await import("./variations.server");
        const built = await buildPersonaVariations({
          accounts: accounts.map((a: any) => ({ id: a.id, handle: a.handle })),
          tweetText: data.tweetText,
          commentText: data.commentText,
          objectiveMode: data.objectiveMode,
          tone: data.tone,
          intensity: data.intensity,
          briefing: data.briefing,
          workspaceId,
        });
        for (const v of built) {
          variationMap.set(v.accountId, {
            tweetText: v.tweetText,
            commentText: v.commentText,
            personaName: v.personaName,
          });
        }
      }

      // Spread mode: nothing goes out now. Each persona action is queued with
      // its own run time so the fleet never posts in one burst.
      {
        const { runTimesFor } = await import("./spread");
        const { enqueueScheduledActions } = await import("./scheduler.server");
        const { logLegalReview: logReview } = await import("./legal-risk.server");

        type Unit = {
          acc: (typeof accounts)[number];
          type: "tweet" | "comment" | "like" | "retweet" | "bookmark" | "follow";
          content: string;
          personaName: string;
          targetTweetId?: string | null;
          targetHandle?: string | null;
        };
        const units: Unit[] = [];
        for (const acc of accounts) {
          const variant = variationMap.get(acc.id);
          const personaName = variant?.personaName ?? "";
          if (data.mode === "tweet" || data.mode === "both") {
            units.push({
              acc,
              type: "tweet",
              content: appendLink(variant?.tweetText || data.tweetText, data.linkUrl),
              personaName,
            });
          }
          if (data.mode === "comment" || data.mode === "both") {
            units.push({
              acc,
              type: "comment",
              content: variant?.commentText || data.commentText,
              personaName,
            });
            if (data.likeTarget && data.actions.like && data.targets.author)
              units.push({ acc, type: "like", content: "", personaName });
          }
          if (targetId && data.targets.author) {
            if (data.actions.retweet)
              units.push({ acc, type: "retweet", content: "", personaName });
            if (data.actions.bookmark)
              units.push({ acc, type: "bookmark", content: "", personaName });
          }
        }

        // Peer follows, watchlist engagement and peer-latest engagement are queued
        // too, so nothing is fired inside this request and every action gets a turn.
        if (engagers.length > 1 && data.actions.follow && data.targets.peer) {
          for (const acc of engagers) {
            for (const other of engagers) {
              if (other.id === acc.id) continue;
              units.push({
                acc: acc as (typeof accounts)[number],
                type: "follow",
                content: `follow @${other.handle.replace(/^@/, "")}`,
                personaName: "",
                targetHandle: other.handle.replace(/^@/, ""),
              });
            }
          }
        }

        const watchKinds = data.targets.watchlist
          ? (["like", "retweet", "bookmark"] as const).filter((k) => data.actions[k])
          : [];
        if (watchKinds.length > 0) {
          const watchTargets = await loadWatchTargets(twitter);
          for (const acc of engagers) {
            for (const target of watchTargets) {
              if (target.handle.toLowerCase() === acc.handle.replace(/^@/, "").toLowerCase())
                continue;
              for (const kind of watchKinds) {
                units.push({
                  acc: acc as (typeof accounts)[number],
                  type: kind,
                  content: `@${target.handle} · ${target.tweetId}`,
                  personaName: "",
                  targetTweetId: target.tweetId,
                });
              }
            }
          }
        }

        const peerKinds = data.targets.peer
          ? (["like", "retweet"] as const).filter((k) => data.actions[k])
          : [];
        if (peerKinds.length > 0) {
          const peerTargets = await loadPeerLatestTargets(twitter, engagers as any[]);
          for (const acc of engagers) {
            for (const target of peerTargets) {
              if (target.accountId === acc.id) continue;
              for (const kind of peerKinds) {
                units.push({
                  acc: acc as (typeof accounts)[number],
                  type: kind,
                  content: `peer @${target.handle} · ${target.tweetId}`,
                  personaName: "",
                  targetTweetId: target.tweetId,
                });
              }
            }
          }
        }

        const startAtMs = data.startAt ? Date.parse(data.startAt) : Number.NaN;
        const startFrom =
          Number.isFinite(startAtMs) && startAtMs > Date.now() ? startAtMs : Date.now();
        const times = runTimesFor(units.length, data.spreadHours, startFrom);
        const scheduledResults: PublishActionRow[] = [];
        let failedCount = 0;

        for (let i = 0; i < units.length; i += 1) {
          const unit = units[i]!;
          // Legal-Risk gate still runs up front so held wording never queues.
          if (unit.type === "tweet" || unit.type === "comment") {
            const verdict = transformText(unit.content);
            if (!verdict.autoPublishAllowed) {
              void logReview({
                workspaceId,
                record: verdict,
                surface: "publish_blocked",
                userId: context.userId,
                reference: unit.acc.handle,
              });
              const heldError = `Held by legal review (${RISK_LEVEL_LABELS[verdict.riskLevel].toLowerCase()}): ${verdict.escalationNote || verdict.findings[0]?.reason || "wording needs senior approval"}`;
              const { data: blocked } = await (supabaseAdmin as any)
                .from("publish_actions")
                .insert({
                  job_id: job.id,
                  user_id: context.userId,
                  workspace_id: workspaceId,
                  account_id: unit.acc.id,
                  action_type: unit.type,
                  content: unit.content,
                  status: "failed",
                  result_tweet_id: null,
                  error: heldError,
                })
                .select("id")
                .maybeSingle();
              failedCount += 1;
              scheduledResults.push({
                id: blocked?.id ?? `${unit.acc.id}-${unit.type}-held`,
                accountHandle: unit.acc.handle,
                actionType: unit.type,
                status: "failed",
                resultTweetId: null,
                error: heldError,
                content: unit.content,
                ...(unit.personaName ? { personaName: unit.personaName } : {}),
              });
              continue;
            }
          }

          const runAt = times[i]!;
          const { data: pendingRow } = await (supabaseAdmin as any)
            .from("publish_actions")
            .insert({
              job_id: job.id,
              user_id: context.userId,
              workspace_id: workspaceId,
              account_id: unit.acc.id,
              action_type: unit.type,
              content: unit.content,
              status: "pending",
              result_tweet_id: null,
              error: `Scheduled for ${new Date(runAt).toLocaleString()}`,
            })
            .select("id")
            .maybeSingle();

          await enqueueScheduledActions(supabaseAdmin as any, [
            {
              user_id: context.userId,
              workspace_id: workspaceId,
              source: "publish",
              job_id: job.id,
              publish_action_id: pendingRow?.id ?? null,
              account_id: unit.acc.id,
              handle: unit.acc.handle,
              persona_name: unit.personaName,
              action_type: unit.type,
              content: unit.content,
              target_tweet_id:
                unit.targetTweetId ??
                (unit.type === "tweet" || unit.type === "follow" ? null : targetId),
              target_handle: unit.targetHandle ?? null,
              media_urls: unit.type === "tweet" || unit.type === "comment" ? data.imageUrls : [],
              run_at: runAt,
            },
            // Reply campaigns deliberately send every chosen persona's reply to
            // the same target post.
          ], { allowMultiAccountTarget: true });

          scheduledResults.push({
            id: pendingRow?.id ?? `${unit.acc.id}-${unit.type}-${i}`,
            accountHandle: unit.acc.handle,
            actionType: unit.type,
            status: "pending",
            resultTweetId: null,
            error: `Scheduled for ${new Date(runAt).toLocaleString()}`,
            content: unit.content,
            ...(unit.personaName ? { personaName: unit.personaName } : {}),
          });
        }

        // The first persona goes out straight away; everything else stays queued
        // for its own run time so the fleet never posts in one burst.
        if (scheduledResults.length > 0) {
          try {
            const { runDueScheduledActions } = await import("./scheduler.server");
            await runDueScheduledActions({
              admin: supabaseAdmin as any,
              userId: context.userId,
              jobId: job.id,
              limit: 1,
            });
            const { data: firstRow } = await supabaseAdmin
              .from("publish_actions")
              .select("id, status, result_tweet_id, error")
              .eq("job_id", job.id)
              .in("status", ["success", "failed"])
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (firstRow) {
              const match = scheduledResults.find((r) => r.id === firstRow.id);
              if (match) {
                match.status = firstRow.status === "success" ? "success" : "failed";
                match.resultTweetId = firstRow.result_tweet_id ?? null;
                match.error = firstRow.error ?? null;
              }
            }
          } catch {
            /* the cron drain picks it up on the next tick */
          }
        }

        await (supabaseAdmin as any)
          .from("publish_jobs")
          .update({ status: "scheduled" })
          .eq("id", job.id)
          .eq("workspace_id", workspaceId);

        return {
          jobId: job.id,
          mode: data.mode,
          actions: scheduledResults,
          succeeded: scheduledResults.filter((r) => r.status === "success").length,
          failed: scheduledResults.filter((r) => r.status === "failed").length || failedCount,
        };
      }
    };

    if (!data.idempotencyKey) return operation();

    const { withIdempotencyKey, createSupabaseIdempotencyStore } =
      await import("./platform/idempotency.server");
    return withIdempotencyKey(
      createSupabaseIdempotencyStore(supabaseAdmin as any),
      {
        key: data.idempotencyKey,
        userId: context.userId,
        payload: {
          mode: data.mode,
          tweetText: data.tweetText,
          commentText: data.commentText,
          accountIds: data.accountIds,
          targetTweetUrl: data.targetTweetUrl,
          linkUrl: data.linkUrl,
        },
      },
      operation,
    );
  });

export const uploadPublishMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fileName: z.string().trim().min(1).max(200),
        dataUrl: z.string().max(20_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string; name: string; kind: string }> => {
    const match = /^data:([^;]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("Unsupported file.");
    const mime = match[1] ?? "application/octet-stream";
    if (!/^(image|video)\//.test(mime))
      throw new Error("Only images, GIFs and videos are allowed.");
    const bytes = Buffer.from(match[2] ?? "", "base64");
    if (bytes.byteLength > 15_000_000) throw new Error("File is larger than 15MB.");

    const workspaceId = await resolveWorkspaceId(context);
    const ext = data.fileName.split(".").pop()?.slice(0, 8) || mime.split("/")[1] || "bin";
    const path = `publish/${workspaceId}/${context.userId}/${crypto.randomUUID()}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("message-uploads")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(error.message);
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("message-uploads")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signError || !signed?.signedUrl)
      throw new Error(signError?.message ?? "Could not sign URL.");
    return {
      url: signed.signedUrl,
      name: data.fileName,
      kind: mime.startsWith("video/") ? "video" : mime === "image/gif" ? "gif" : "image",
    };
  });

export const previewPersonaVariations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        accountIds: z.array(z.string().uuid()).min(1).max(500),
        tweetText: z.string().max(1000).default(""),
        commentText: z.string().max(1000).default(""),
        briefing: z.string().max(800).default(""),
        objectiveMode: z.boolean().default(false),
        tone: z.enum(PUBLISH_TONES).default(DEFAULT_TONE),
        intensity: z.number().int().min(1).max(5).default(DEFAULT_INTENSITY),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveWorkspaceId(context);
    // Accounts live in the caller's workspace, so preview reads them with the
    // service client (same live filters as publishing) instead of per-user RLS.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: accounts, error } = await (supabaseAdmin as any)
      .from("x_accounts")
      .select("id, handle")
      .eq("workspace_id", workspaceId)
      .eq("suspended", false)
      .eq("is_active", true)
      .in("id", data.accountIds)
      .order("handle");
    if (error) throw new Error(error.message);
    if (!accounts || accounts.length === 0) throw new Error("No matching accounts found.");

    const { checkSpendLimit } = await import("./budget.server");
    await checkSpendLimit(supabaseAdmin as any, workspaceId);

    const { buildPersonaVariations } = await import("./variations.server");
    return buildPersonaVariations({
      accounts: accounts.map((a: any) => ({ id: a.id, handle: a.handle })),
      tweetText: data.tweetText,
      commentText: data.commentText,
      objectiveMode: data.objectiveMode,
      tone: data.tone,
      intensity: data.intensity,
      briefing: data.briefing,
      workspaceId,
      userId: context.userId,
    });
  });

/** Fetches the tweet behind a URL so the composer can show a live preview. */
export const getTweetPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().max(400) }).parse(input))
  .handler(async ({ data, context }) => {
    const { extractTweetId, fetchTweetMetrics } = await import("./twitterapi.server");
    const id = extractTweetId(data.url);
    if (!id) return { tweet: null, error: "Paste a full tweet link." };
    const { tweets, error } = await fetchTweetMetrics([id]);
    const t = tweets[0];
    if (!t) return { tweet: null, error: error ?? "Tweet not found." };
    return {
      tweet: {
        id: t.tweetId,
        text: t.text,
        authorHandle: t.authorHandle,
        authorName: t.authorName || t.authorHandle,
        createdAt: t.createdAt,
        likeCount: t.likeCount,
        retweetCount: t.retweetCount,
        replyCount: t.replyCount,
      },
      error: null as string | null,
    };
  });

/** Rename connected accounts (in-app label + the real X profile name). */
export const renameXAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        renames: z
          .array(
            z.object({
              accountId: z.string().uuid(),
              displayName: z.string().trim().min(1).max(50),
              personaLabel: z.string().trim().max(80).default(""),
              bio: z.string().trim().max(160).default(""),
              /** New @username - letters/underscore only, no digits. */
              username: z
                .string()
                .trim()
                .regex(/^[A-Za-z_]{4,15}$/)
                .optional(),
            }),
          )
          .min(1)
          .max(100),
        pushToX: z.boolean().default(true),
        location: z.string().trim().max(30).default("Kenya"),
      })

      .parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      results: {
        handle: string;
        displayName: string;
        ok: boolean;
        error: string | null;
        newHandle?: string;
        usernameError?: string | null;
      }[];
    }> => {
      assertAdmin(context as any);
      const workspaceId = await resolveWorkspaceId(context);

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const twitter = await import("./twitterapi.server");

      const ids = data.renames.map((r) => r.accountId);
      const { data: accounts, error } = await (supabaseAdmin as any)
        .from("x_accounts")
        .select("id, handle, auth_token, proxy")
        .eq("workspace_id", workspaceId)
        .in("id", ids);
      if (error) throw new Error(error.message);

      const byId = new Map<string, any>((accounts ?? []).map((a: any) => [a.id, a]));
      const results: {
        handle: string;
        displayName: string;
        ok: boolean;
        error: string | null;
        newHandle?: string;
        usernameError?: string | null;
      }[] = [];

      for (const rename of data.renames) {
        const acc = byId.get(rename.accountId);
        if (!acc) {
          results.push({
            handle: "unknown",
            displayName: rename.displayName,
            ok: false,
            error: "Account not found.",
          });
          continue;
        }

        let ok = true;
        let err: string | null = null;
        let newHandle: string | undefined;
        let usernameError: string | null = null;

        if (data.pushToX) {
          const posting = {
            id: acc.id,
            handle: acc.handle,
            loginCookies: acc.auth_token,
            proxy: acc.proxy,
          };
          const res = await twitter.updateProfileDisplayName(
            posting,
            rename.displayName,
            rename.bio || undefined,
            data.location || undefined,
          );

          ok = res.ok;
          err = res.error;
          await twitter.sleep(500 + Math.floor(Math.random() * 700));

          // @username change is best-effort: X can reject a taken handle
          // without that invalidating the name/bio update.
          const wanted = rename.username?.replace(/^@/, "");
          if (wanted && wanted.toLowerCase() !== acc.handle.replace(/^@/, "").toLowerCase()) {
            const uRes = await twitter.updateScreenName(posting, wanted);
            // updateScreenName falls back to X's suggested handle when the
            // requested one is taken, so save whatever was accepted.
            if (uRes.ok) newHandle = uRes.handle ?? wanted;
            else usernameError = uRes.error;

            await twitter.sleep(500 + Math.floor(Math.random() * 700));
          }
        } else if (rename.username) {
          newHandle = rename.username.replace(/^@/, "");
        }

        const { error: upErr } = await (supabaseAdmin as any)
          .from("x_accounts")
          .update({
            display_name: rename.displayName,
            ...(rename.personaLabel ? { persona_label: rename.personaLabel } : {}),
            ...(rename.bio ? { bio: rename.bio } : {}),
            ...(newHandle ? { handle: newHandle } : {}),
          })
          .eq("id", acc.id);
        if (upErr) {
          ok = false;
          err = upErr.message;
        }

        results.push({
          handle: newHandle ?? acc.handle,
          displayName: rename.displayName,
          ok,
          error: err,
          ...(newHandle ? { newHandle } : {}),
          ...(usernameError ? { usernameError } : {}),
        });
      }

      await logAuditEventAsCaller(context.supabase, {
        action: "integration.change",
        resourceTable: "x_accounts",
        metadata: { count: data.renames.length, pushToX: data.pushToX },
      });
      return { results };
    },
  );

/**
 * Run the standing engagement rules on demand: every linked account follows
 * every other, and all of them engage with the newest posts from the monitored
 * handles.
 */
export const runEngagementSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sweepEngagement } = await import("./engagement.server");
    return sweepEngagement(context.userId);
  });

/**
 * Every linked account likes, retweets and bookmarks one tweet the operator
 * shares - no posting involved.
 */
export const runEngageWithTweet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tweetUrl: z.string().trim().min(5) }).parse(input))
  .handler(async ({ data, context }) => {
    const { engageWithTweet } = await import("./engagement.server");
    return engageWithTweet(context.userId, data.tweetUrl);
  });

/**
 * Cross-follow pass in batches: every linked account follows every other one.
 * Call repeatedly with the returned `nextOffset` until it is null.
 */
export const runCrossFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ offset: z.number().int().min(0).default(0) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { crossFollowBatch } = await import("./engagement.server");
    return crossFollowBatch(context.userId, data.offset);
  });

/**
 * Batched cross-engagement: every linked account likes and retweets every
 * other account's latest tweet. Call repeatedly with `nextOffset` + `targets`
 * until `nextOffset` is null.
 */
export const runCrossEngageLatest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        offset: z.number().int().min(0).default(0),
        targets: z
          .array(
            z.object({
              handle: z.string(),
              tweetId: z.string(),
              accountId: z.string(),
            }),
          )
          .nullish(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { crossEngageLatestBatch } = await import("./engagement.server");
    return crossEngageLatestBatch(context.userId, data.offset, data.targets ?? null);
  });

/**
 * Batched follow of one specific handle by every linked account.
 */
export const runFollowHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        handle: z.string().trim().min(1),
        offset: z.number().int().min(0).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { followHandleBatch } = await import("./engagement.server");
    return followHandleBatch(context.userId, data.handle, data.offset);
  });
