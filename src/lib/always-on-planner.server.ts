/**
 * Always-On planner persistence and execution.
 *
 * Owns the database side of the daily rhythm: building and storing plans,
 * reading them back for the admin screen, editing/holding/approving posts, and
 * publishing the ones whose local time has arrived.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDailyPlan, type ContentCategory, type RecentPost } from "./always-on";
import { generatePlanContent } from "./always-on.server";
import type { AlwaysOnPlanView, AlwaysOnPostView } from "./always-on-view";
import { RISK_LEVEL_LABELS, transformText } from "./legal-risk";
import { PERSONAS, type Persona } from "./personas";

type Admin = SupabaseClient<any, any, any>;

/** East Africa Time - the personas' local day. */
function localDate(now = new Date()): string {
  const shifted = new Date(now.getTime() + 3 * 3_600_000);
  return shifted.toISOString().slice(0, 10);
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** Stable persona for an account: label match first, then a deterministic hash. */
export function personaForAccount(account: {
  id: string;
  handle: string;
  personaLabel?: string | null;
}): Persona {
  const label = (account.personaLabel ?? "").trim().toLowerCase();
  if (label) {
    const match = PERSONAS.find(
      (p) => p.name.toLowerCase() === label || p.id.toLowerCase() === label,
    );
    if (match) return match;
  }
  let hash = 0;
  for (const ch of account.handle) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return PERSONAS[hash % PERSONAS.length]!;
}

function toPostView(row: any): AlwaysOnPostView {
  const legal = (row.legal ?? null) as { level?: number; label?: string } | null;
  return {
    id: row.id,
    accountId: row.account_id,
    slotIndex: row.slot_index,
    category: row.category as ContentCategory,
    topic: row.topic ?? "",
    content: row.content ?? "",
    imageUrl: row.image_url ?? null,
    imageCreditName: row.image_credit_name ?? null,
    imageCreditUrl: row.image_credit_url ?? null,
    scheduledAt: row.scheduled_at,
    status: row.status,
    reviewNotes: row.review_notes ?? "",
    legalLabel: legal?.label ?? null,
    legalLevel: legal?.level ?? null,
    error: row.error ?? null,
    resultTweetId: row.result_tweet_id ?? null,
  };
}

async function readPlans(
  admin: Admin,
  userId: string,
  workspaceId: string,
  date: string,
): Promise<AlwaysOnPlanView[]> {
  const { data: plans, error } = await admin
    .from("persona_daily_plans")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("plan_date", date);
  if (error) throw new Error(error.message);
  if (!plans || plans.length === 0) return [];

  const { data: posts } = await admin
    .from("persona_daily_posts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in(
      "plan_id",
      plans.map((p: any) => p.id),
    )
    .order("scheduled_at");

  const { data: accounts } = await admin
    .from("x_accounts")
    .select("id, handle, display_name")
    .eq("workspace_id", workspaceId);
  const accountMap = new Map((accounts ?? []).map((a: any) => [a.id, a]));

  return plans
    .map((plan: any) => {
      const account = accountMap.get(plan.account_id);
      return {
        id: plan.id,
        accountId: plan.account_id,
        handle: account?.handle ?? "",
        displayName: account?.display_name ?? "",
        personaId: plan.persona_id,
        personaName: plan.persona_name ?? "",
        date: plan.plan_date,
        activityType: plan.activity_type,
        target: plan.target,
        campaignCount: plan.campaign_count,
        notes: plan.notes ?? "",
        posts: (posts ?? []).filter((p: any) => p.plan_id === plan.id).map(toPostView),
      };
    })
    .sort((a, b) => a.handle.localeCompare(b.handle));
}

export async function loadPlans(input: {
  userId: string;
  workspaceId: string;
  date?: string;
}): Promise<AlwaysOnPlanView[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return readPlans(
    supabaseAdmin as Admin,
    input.userId,
    input.workspaceId,
    input.date ?? localDate(),
  );
}

/** Recent published history for a persona, used for the cooldown checks. */
async function loadRecent(
  admin: Admin,
  userId: string,
  workspaceId: string,
  accountId: string,
): Promise<RecentPost[]> {
  const since = new Date(Date.now() - 21 * 24 * 3_600_000).toISOString();
  const { data } = await admin
    .from("persona_daily_posts")
    .select("content, topic, category, image_id, published_at")
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .eq("status", "published")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(60);
  return (data ?? []).map((r: any) => ({
    content: r.content,
    topic: r.topic ?? "",
    category: r.category as ContentCategory,
    imageId: r.image_id ?? null,
    publishedAt: r.published_at,
  }));
}

/**
 * Builds and stores a fresh daily plan for every always-on account.
 *
 * Planning costs one AI call per persona, so a single run cannot cover a
 * hundred accounts inside one request. Accounts that already have a plan for
 * the day are skipped and each invocation handles a bounded batch, so repeated
 * cron ticks keep going until every persona is planned - not just the first few.
 */
export async function runDailyPlanning(input: {
  userId: string;
  workspaceId: string;
  date?: string;
  accountIds?: string[];
  campaignBrief?: string;
  maxAccounts?: number;
  replan?: boolean;
}): Promise<AlwaysOnPlanView[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as Admin;
  const date = input.date ?? localDate();

  let query = admin
    .from("x_accounts")
    .select("id, handle, display_name, persona_label, always_on, is_active")
    .eq("workspace_id", input.workspaceId)
    .eq("is_active", true)
    .eq("suspended", false)
    .eq("always_on", true);
  if (input.accountIds?.length) query = query.in("id", input.accountIds);
  const { data: accounts, error } = await query;
  if (error) throw new Error(error.message);
  {
    const { recordSkippedAccounts } = await import("./skip-audit.server");
    await recordSkippedAccounts(
      admin,
      { userId: input.userId, workspaceId: input.workspaceId, source: "auto", runRef: date },
      input.accountIds?.length ? input.accountIds : undefined,
    );
  }
  if (!accounts || accounts.length === 0) {
    throw new Error("No always-on accounts. Turn the daily rhythm on for an account first.");
  }

  // Hand-picked accounts and explicit re-plans always rebuild; a routine run
  // only picks up personas that still have no plan for today.
  const explicit = Boolean(input.accountIds?.length) || input.replan === true;
  let pending = accounts as any[];
  if (!explicit) {
    const { data: planned } = await admin
      .from("persona_daily_plans")
      .select("account_id")
      .eq("workspace_id", input.workspaceId)
      .eq("plan_date", date);
    const done = new Set((planned ?? []).map((p: any) => String(p.account_id)));
    pending = pending.filter((a) => !done.has(String(a.id)));
  }
  const batch = pending.slice(0, Math.max(1, input.maxAccounts ?? 12));

  const campaignBrief = (input.campaignBrief ?? "").trim();
  const peerPosts: { content: string; personaId: string }[] = [];

  for (const account of batch) {
    const persona = personaForAccount({
      id: account.id,
      handle: account.handle,
      personaLabel: account.persona_label,
    });

    const { count: previousDayCount } = await admin
      .from("persona_daily_posts")
      .select("id", { count: "exact", head: true })

      .eq("account_id", account.id)
      .eq("status", "published")
      .gte("published_at", `${date}T00:00:00.000Z`);

    const plan = buildDailyPlan({
      persona,
      accountId: account.id,
      date,
      campaignRequests: campaignBrief ? 2 : 0,
      previousDayCount: previousDayCount ?? 0,
      isWeekend: isWeekend(date),
    });

    const recent = await loadRecent(admin, input.userId, input.workspaceId, account.id);
    const generated = await generatePlanContent({
      persona,
      plan,
      ...(campaignBrief ? { campaignBrief } : {}),
      recent,
      peerPosts,
      userId: input.userId,
    });
    for (const g of generated) {
      if (g.status === "scheduled") peerPosts.push({ content: g.content, personaId: persona.id });
    }

    // Replace any previous plan for the same account/day, keeping published posts.
    const { data: existing } = await admin
      .from("persona_daily_plans")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("account_id", account.id)
      .eq("plan_date", date)
      .maybeSingle();
    if (existing?.id) {
      await admin
        .from("persona_daily_posts")
        .delete()
        .eq("plan_id", existing.id)
        .neq("status", "published");
      await admin.from("persona_daily_plans").delete().eq("id", existing.id);
    }

    const { data: planRow, error: planErr } = await admin
      .from("persona_daily_plans")
      .insert({
        user_id: input.userId,
        workspace_id: input.workspaceId,
        account_id: account.id,
        persona_id: persona.id,
        persona_name: persona.name,
        plan_date: date,
        activity_type: plan.activityType,
        target: plan.target,
        campaign_count: plan.campaignCount,
        notes: `${plan.slots.length} slots planned for a ${plan.activityType} day.`,
        windows: plan.windows as unknown as Record<string, unknown>,
      })
      .select("id")
      .single();
    if (planErr) throw new Error(planErr.message);

    const rows = generated.map((g) => ({
      user_id: input.userId,
      workspace_id: input.workspaceId,
      plan_id: planRow!.id,
      account_id: account.id,
      persona_id: persona.id,
      slot_index: g.slotIndex,
      category: g.category,
      topic: g.topic,
      content: g.content,
      image_url: g.imageUrl,
      image_id: g.imageId,
      image_credit_name: g.imageCreditName,
      image_credit_url: g.imageCreditUrl,
      scheduled_at: g.scheduledAt,
      status: g.status,
      review_notes: g.reviewNotes,
      quality: g.quality as unknown as Record<string, unknown>,
      legal: (g.legal ?? {}) as unknown as Record<string, unknown>,
    }));
    if (rows.length) {
      const { error: postErr } = await admin.from("persona_daily_posts").insert(rows);
      if (postErr) throw new Error(postErr.message);

      // The persona should be visibly live straight away: the first scheduled
      // post of the day goes out on the next publish sweep instead of waiting
      // for its window.
      const firstScheduled = rows
        .filter((r) => r.status === "scheduled")
        .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))[0];
      if (firstScheduled && new Date(firstScheduled.scheduled_at).getTime() > Date.now()) {
        await admin
          .from("persona_daily_posts")
          .update({ scheduled_at: new Date().toISOString() })
          .eq("plan_id", planRow!.id)
          .eq("slot_index", firstScheduled.slot_index)
          .eq("status", "scheduled");
      }
    }
  }

  return readPlans(admin, input.userId, input.workspaceId, date);
}

/** Applies an admin edit and re-runs the deterministic legal check on it. */
export async function updatePostContent(input: {
  userId: string;
  workspaceId: string;
  postId: string;
  content: string;
}): Promise<AlwaysOnPostView> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as Admin;
  const verdict = transformText(input.content);
  const { data, error } = await admin
    .from("persona_daily_posts")
    .update({
      content: verdict.revisedText || input.content,
      status: verdict.autoPublishAllowed ? "scheduled" : "held",
      review_notes: verdict.autoPublishAllowed
        ? "Edited by reviewer."
        : `Held by legal review (${RISK_LEVEL_LABELS[verdict.riskLevel].toLowerCase()}).`,
      legal: {
        level: verdict.riskLevel,
        label: RISK_LEVEL_LABELS[verdict.riskLevel],
        rewritten: verdict.revisedText !== verdict.originalText,
        note: verdict.escalationNote || verdict.findings[0]?.reason || "",
      },
    })
    .eq("id", input.postId)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toPostView(data);
}

export async function setPostStatus(input: {
  userId: string;
  workspaceId: string;
  postId: string;
  status: "scheduled" | "skipped";
}): Promise<AlwaysOnPostView> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as Admin;
  const { data, error } = await admin
    .from("persona_daily_posts")
    .update({
      status: input.status,
      review_notes: input.status === "scheduled" ? "Approved by reviewer." : "Skipped for today.",
    })
    .eq("id", input.postId)
    .eq("workspace_id", input.workspaceId)
    .neq("status", "published")
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toPostView(data);
}

/** Publishes every scheduled post whose time has come (or one specific post). */
export async function publishDue(input: {
  userId: string;
  workspaceId: string;
  postId?: string;
  now?: Date;
}): Promise<{ published: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as Admin;
  const twitter = await import("./twitterapi.server");
  const now = input.now ?? new Date();

  let query = admin
    .from("persona_daily_posts")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("status", "scheduled")
    .order("scheduled_at");
  query = input.postId
    ? query.eq("id", input.postId)
    : query.lte("scheduled_at", now.toISOString());
  const { data: due, error } = await query;
  if (error) throw new Error(error.message);
  if (!due || due.length === 0) return { published: 0, failed: 0 };

  const { data: accounts } = await admin
    .from("x_accounts")
    .select("id, handle, auth_token, proxy, suspended, is_active")
    .eq("workspace_id", input.workspaceId);
  const accountMap = new Map((accounts ?? []).map((a: any) => [a.id, a]));

  let published = 0;
  let failed = 0;

  for (const post of due as any[]) {
    const account = accountMap.get(post.account_id);
    if (!account) {
      failed += 1;
      await admin
        .from("persona_daily_posts")
        .update({ status: "failed", error: "Linked account no longer exists." })
        .eq("id", post.id);
      continue;
    }
    if (account.suspended || !account.is_active) {
      failed += 1;
      await admin
        .from("persona_daily_posts")
        .update({
          status: "failed",
          error: account.suspended
            ? "Account is suspended on X - post skipped."
            : "Account is switched off - post skipped.",
        })
        .eq("id", post.id);
      continue;
    }

    // The legal gate runs again at publish time in case wording drifted.
    const verdict = transformText(post.content);
    if (!verdict.autoPublishAllowed) {
      failed += 1;
      await admin
        .from("persona_daily_posts")
        .update({
          status: "held",
          review_notes: `Held by legal review (${RISK_LEVEL_LABELS[verdict.riskLevel].toLowerCase()}).`,
        })
        .eq("id", post.id);
      continue;
    }

    const posting = {
      id: account.id,
      handle: account.handle,
      loginCookies: account.auth_token ?? null,
      proxy: account.proxy ?? null,
    };

    let mediaIds: string[] = [];
    if (post.image_url) {
      try {
        const res = await fetch(post.image_url);
        if (res.ok) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          const upload = await twitter.uploadMedia(posting, {
            bytes,
            name: `${post.id}.jpg`,
            contentType: res.headers.get("content-type") ?? "image/jpeg",
          });
          if (upload.ok) mediaIds = [upload.mediaId];
        }
      } catch {
        mediaIds = [];
      }
    }

    const result = await twitter.postTweet(posting, post.content, mediaIds);
    if (result.ok) {
      published += 1;
      await admin
        .from("persona_daily_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          result_tweet_id: result.tweetId,
          error: null,
        })
        .eq("id", post.id);
    } else {
      failed += 1;
      await admin
        .from("persona_daily_posts")
        .update({ status: "failed", error: result.error ?? "Publishing failed." })
        .eq("id", post.id);
    }
    await twitter.sleep(1500);
  }

  return { published, failed };
}
