import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACTION_KIND_LABELS,
  campaignTypeFrom,
  durationBetween,
  progressOf,
  type ActionBreakdown,
  type CampaignActionKind,
  type CampaignReport,
  type CampaignStatus,
  type ManagedCampaign,
} from "./campaign-manager";

const KINDS = Object.keys(ACTION_KIND_LABELS) as CampaignActionKind[];

type StatRow = {
  kind: CampaignActionKind;
  status: string;
  n: number;
  lastAt: string | null;
  nextRun: string | null;
};

/** What the campaign was set up to do, used before any action has run. */
function intendedKinds(mode: string | null, engagement: any): CampaignActionKind[] {
  const kinds: CampaignActionKind[] = [];
  if (mode === "tweet" || mode === "both") kinds.push("tweet");
  if (mode === "comment" || mode === "both") kinds.push("comment");
  const flags = engagement && typeof engagement === "object" ? engagement : {};
  for (const k of ["like", "retweet", "bookmark", "follow"] as CampaignActionKind[]) {
    if (flags[k]) kinds.push(k);
  }
  if (kinds.length === 0 && mode === "engagement") kinds.push("like");
  return kinds;
}

function summarise(rows: StatRow[]) {
  const per = new Map<CampaignActionKind, ActionBreakdown>();
  let planned = 0;
  let completed = 0;
  let failed = 0;
  let pending = 0;
  let paused = 0;
  let nextRunAt: string | null = null;
  let lastAt: string | null = null;

  for (const r of rows) {
    const entry = per.get(r.kind) ?? { kind: r.kind, planned: 0, completed: 0, failed: 0 };
    entry.planned += r.n;
    planned += r.n;
    if (r.status === "success") {
      entry.completed += r.n;
      completed += r.n;
    } else if (r.status === "failed") {
      entry.failed += r.n;
      failed += r.n;
    } else if (r.status === "paused") {
      paused += r.n;
    } else if (r.status === "pending" || r.status === "running") {
      pending += r.n;
      if (r.nextRun && (!nextRunAt || r.nextRun < nextRunAt)) nextRunAt = r.nextRun;
    }
    if (
      (r.status === "success" || r.status === "failed") &&
      r.lastAt &&
      (!lastAt || r.lastAt > lastAt)
    ) {
      lastAt = r.lastAt;
    }
    per.set(r.kind, entry);
  }

  const breakdown = [...per.values()].sort((a, b) => b.planned - a.planned);
  return { planned, completed, failed, pending, paused, nextRunAt, lastAt, breakdown };
}

function statusFrom(s: {
  planned: number;
  completed: number;
  failed: number;
  pending: number;
  paused: number;
  nextRunAt: string | null;
}): CampaignStatus {
  if (s.pending === 0 && s.paused > 0) return "paused";
  if (s.pending > 0) {
    const notStarted = s.completed === 0 && s.failed === 0;
    if (notStarted && s.nextRunAt && new Date(s.nextRunAt).getTime() > Date.now())
      return "scheduled";
    return "running";
  }
  return "completed";
}

function jobName(job: any) {
  const text: string =
    job.objective_text || job.tweet_text || job.comment_text || job.target_tweet_url || "";
  const trimmed = String(text).trim().replace(/\s+/g, " ");
  if (!trimmed) return "Campaign";
  return trimmed.length > 70 ? `${trimmed.slice(0, 69)}…` : trimmed;
}

/** Loads every campaign for the signed-in user with progress and controls. */
async function loadCampaigns(supabase: any, userId: string): Promise<ManagedCampaign[]> {
  const [{ data: jobs }, { data: listens }] = await Promise.all([
    supabase
      .from("publish_jobs")
      .select(
        "id, mode, engagement_actions, name, summary, name_is_custom, tweet_text, comment_text, objective_text, target_tweet_url, status, created_at",
      )

      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("listening_campaigns")
      .select(
        "id, name, summary, keywords, hashtags, core_message, is_active, created_at, last_run_at",
      )

      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const jobIds = (jobs ?? []).map((j: any) => j.id);
  const listenIds = (listens ?? []).map((c: any) => c.id);

  // One grouped read covers every action row: campaigns run tens of thousands
  // of actions, far more than a row-by-row fetch could return.
  const { data: stats } = await supabase.rpc("campaign_action_stats");

  const byJob = new Map<string, StatRow[]>();
  const byListen = new Map<string, StatRow[]>();
  for (const s of (stats ?? []) as any[]) {
    if (!s.campaign_id) continue;
    const row: StatRow = {
      kind: KINDS.includes(s.kind) ? s.kind : "tweet",
      status: String(s.status),
      n: Number(s.n) || 0,
      lastAt: s.last_at ?? null,
      nextRun: s.next_run ?? null,
    };
    const map = s.source === "listen" ? byListen : byJob;
    const list = map.get(s.campaign_id) ?? [];
    list.push(row);
    map.set(s.campaign_id, list);
  }

  const out: ManagedCampaign[] = [];

  for (const job of (jobs ?? []) as any[]) {
    const rows = byJob.get(job.id) ?? [];
    const s = summarise(rows);
    const done = s.completed + s.failed;
    const status = statusFrom(s);
    const kinds = s.breakdown.length
      ? s.breakdown.map((b) => b.kind)
      : intendedKinds(job.mode, job.engagement_actions);
    out.push({
      key: `publish:${job.id}`,
      source: "publish",
      id: job.id,
      name: job.name?.trim() || jobName(job),
      summary: job.summary?.trim() || "",
      hasExecution: s.planned > 0,
      type: campaignTypeFrom(kinds),
      kinds,
      status,
      startedAt: job.created_at,
      completedAt: status === "completed" ? (s.lastAt ?? job.created_at) : null,
      planned: s.planned,
      completed: s.completed,
      failed: s.failed,
      remaining: s.pending + s.paused,
      progress: s.planned === 0 ? 0 : status === "completed" ? 100 : progressOf(s.planned, done),
      nextRunAt: s.nextRunAt,
      breakdown: s.breakdown,
    });
  }

  for (const c of (listens ?? []) as any[]) {
    const rows = byListen.get(c.id) ?? [];
    const s = summarise(rows);
    const done = s.completed + s.failed;
    let status = statusFrom(s);
    if (!c.is_active) status = s.pending > 0 ? "paused" : status === "running" ? "paused" : status;
    else if (status === "completed" && s.planned === 0) status = "scheduled";
    else if (status === "completed") status = "running"; // a live rule keeps listening
    out.push({
      key: `listen:${c.id}`,
      source: "listen",
      id: c.id,
      name: c.name || "Listening campaign",
      summary:
        c.summary?.trim() ||
        [...(c.keywords ?? []), ...(c.hashtags ?? [])].slice(0, 5).join(", ") ||
        String(c.core_message ?? "").slice(0, 110),
      hasExecution: s.planned > 0,
      type: "Intercept campaign",
      kinds: s.breakdown.length ? s.breakdown.map((b) => b.kind) : ["comment"],
      status,
      startedAt: c.created_at,
      completedAt: status === "completed" ? (s.lastAt ?? c.last_run_at) : null,
      planned: s.planned,
      completed: s.completed,
      failed: s.failed,
      remaining: s.pending + s.paused,
      progress: s.planned === 0 ? 0 : status === "completed" ? 100 : progressOf(s.planned, done),
      nextRunAt: s.nextRunAt,
      breakdown: s.breakdown,
    });
  }

  return out.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

/** Every campaign with live progress, newest first. */
export const listManagedCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedCampaign[]> =>
    loadCampaigns(context.supabase as any, context.userId),
  );

const keySchema = z.object({
  source: z.enum(["publish", "listen"]),
  id: z.string().uuid(),
});

/** Stops remaining queued activity without deleting progress. */
export const pauseManagedCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => keySchema.parse(input))
  .handler(async ({ data, context }): Promise<{ paused: number }> => {
    const column = data.source === "publish" ? "job_id" : "campaign_id";
    const { data: rows, error } = await (context.supabase as any)
      .from("scheduled_actions")
      .update({ status: "paused" })

      .eq(column, data.id)
      .eq("status", "pending")
      .select("id");
    if (error) throw new Error(error.message);
    if (data.source === "listen") {
      await (context.supabase as any)
        .from("listening_campaigns")
        .update({ is_active: false })
        .eq("id", data.id);
    }
    return { paused: (rows ?? []).length };
  });

/** Puts paused activity back in the queue. */
export const resumeManagedCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => keySchema.parse(input))
  .handler(async ({ data, context }): Promise<{ resumed: number }> => {
    const column = data.source === "publish" ? "job_id" : "campaign_id";
    const { data: rows, error } = await (context.supabase as any)
      .from("scheduled_actions")
      .update({ status: "pending" })

      .eq(column, data.id)
      .eq("status", "paused")
      .select("id");
    if (error) throw new Error(error.message);
    if (data.source === "listen") {
      await (context.supabase as any)
        .from("listening_campaigns")
        .update({ is_active: true })
        .eq("id", data.id);
    }
    return { resumed: (rows ?? []).length };
  });

/** Full report for one campaign: execution, activity mix and results. */
export const getCampaignReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => keySchema.parse(input))
  .handler(async ({ data, context }): Promise<CampaignReport | null> => {
    const supabase = context.supabase as any;
    const all = await loadCampaigns(supabase, context.userId);
    const campaign = all.find((c) => c.source === data.source && c.id === data.id);
    if (!campaign) return null;

    // Every tweet this campaign produced, from both the direct and queued paths.
    const tweetIds = new Set<string>();
    /** tweet id -> what the campaign actually said, and who said it. */
    const said = new Map<string, { text: string; handle: string }>();
    const actionsByHandle = new Map<string, number>();
    const collect = (rows: any[] | null | undefined) => {
      for (const r of rows ?? []) {
        const handle = String(r.handle ?? r.x_accounts?.handle ?? "");
        if (handle && (r.status === "success" || r.result_tweet_id)) {
          actionsByHandle.set(handle, (actionsByHandle.get(handle) ?? 0) + 1);
        }
        if (!r.result_tweet_id) continue;
        const id = String(r.result_tweet_id);
        tweetIds.add(id);
        said.set(id, { text: String(r.content ?? r.reply_text ?? ""), handle });
      }
    };
    if (data.source === "publish") {
      const { data: rows } = await supabase
        .from("publish_actions")
        .select("result_tweet_id, content, status, x_accounts(handle)")
        .eq("job_id", data.id)
        .limit(20000);
      collect(rows);
      const { data: queued } = await supabase
        .from("scheduled_actions")
        .select("result_tweet_id, content, status, handle")
        .eq("job_id", data.id)
        .limit(20000);
      collect(queued);
    } else {
      const { data: rows } = await supabase
        .from("campaign_replies")
        .select("result_tweet_id, reply_text, status, handle")
        .eq("campaign_id", data.id)
        .limit(20000);
      collect(rows);
      const { data: queued } = await supabase
        .from("scheduled_actions")
        .select("result_tweet_id, content, status, handle")
        .eq("campaign_id", data.id)
        .limit(20000);
      collect(queued);
    }

    // What this campaign acted on: the tweet engaged with, or the followed handles.
    let target: CampaignReport["target"] = null;
    if (data.source === "publish") {
      const { data: job } = await supabase
        .from("publish_jobs")
        .select("target_tweet_url")
        .eq("id", data.id)

        .maybeSingle();
      const handles = new Set<string>();
      const { data: follows } = await supabase
        .from("publish_actions")
        .select("content")
        .eq("job_id", data.id)
        .eq("action_type", "follow")
        .limit(500);
      for (const r of (follows ?? []) as any[]) {
        const h = String(r.content ?? "")
          .replace(/^@/, "")
          .trim();
        if (h) handles.add(h);
      }
      const { data: queuedFollows } = await supabase
        .from("scheduled_actions")
        .select("target_handle, content")
        .eq("job_id", data.id)
        .eq("action_type", "follow")
        .limit(500);
      for (const r of (queuedFollows ?? []) as any[]) {
        const h = String(r.target_handle ?? r.content ?? "")
          .replace(/^@/, "")
          .trim();
        if (h) handles.add(h);
      }
      const tweetUrl = (job?.target_tweet_url as string | null) ?? null;
      if (tweetUrl || handles.size > 0) {
        target = {
          tweetUrl: handles.size > 0 ? null : tweetUrl,
          handles: [...handles].slice(0, 25),
        };
      }
    }

    const ids = [...tweetIds].slice(0, 1000);
    const { data: metrics } = ids.length
      ? await supabase
          .from("tweet_metrics")
          .select(
            "tweet_id, handle, like_count, retweet_count, reply_count, quote_count, bookmark_count, impression_count, tweeted_at, fetched_at",
          )

          .in("tweet_id", ids)
          .limit(1000)
      : { data: [] };

    const performance = {
      posts: 0,
      impressions: 0,
      reach: 0,
      engagements: 0,
      engagementRate: 0,
      likes: 0,
      retweets: 0,
      repliesReceived: 0,
      bookmarks: 0,
      quotes: 0,
    };
    const days = new Map<string, { impressions: number; engagements: number; reach: number }>();
    const accounts = new Map<
      string,
      { posts: number; actions: number; impressions: number; engagements: number; reach: number }
    >();
    const content: CampaignReport["content"] = [];

    for (const m of (metrics ?? []) as any[]) {
      const likes = m.like_count ?? 0;
      const retweets = m.retweet_count ?? 0;
      const replies = m.reply_count ?? 0;
      const quotes = m.quote_count ?? 0;
      const bookmarks = m.bookmark_count ?? 0;
      const impressions = m.impression_count ?? 0;
      const engagements = likes + retweets + replies + quotes + bookmarks;
      const reach = impressions + retweets * 50 + quotes * 50;

      performance.posts += 1;
      performance.likes += likes;
      performance.retweets += retweets;
      performance.repliesReceived += replies;
      performance.quotes += quotes;
      performance.bookmarks += bookmarks;
      performance.impressions += impressions;
      performance.engagements += engagements;
      performance.reach += reach;

      const day = String(m.tweeted_at ?? m.fetched_at ?? "").slice(0, 10);
      if (day) {
        const d = days.get(day) ?? { impressions: 0, engagements: 0, reach: 0 };
        d.impressions += impressions;
        d.engagements += engagements;
        d.reach += reach;
        days.set(day, d);
      }
      const handle = m.handle ?? "";
      const acc = accounts.get(handle) ?? {
        posts: 0,
        actions: 0,
        impressions: 0,
        engagements: 0,
        reach: 0,
      };
      acc.posts += 1;
      acc.impressions += impressions;
      acc.engagements += engagements;
      acc.reach += reach;
      accounts.set(handle, acc);

      const tweetId = String(m.tweet_id);
      const meta = said.get(tweetId);
      content.push({
        tweetId,
        handle: handle || meta?.handle || "",
        text: meta?.text ?? "",
        url: `https://x.com/${handle || meta?.handle || "i"}/status/${tweetId}`,
        publishedAt: m.tweeted_at ?? null,
        likes,
        retweets,
        replies,
        bookmarks,
        impressions,
        engagements,
      });
    }

    performance.engagementRate = performance.impressions
      ? Number(((performance.engagements / performance.impressions) * 100).toFixed(2))
      : 0;

    return {
      campaign,
      duration: durationBetween(campaign.startedAt, campaign.completedAt),
      performance,
      byDay: [...days.entries()]
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30),
      byAccount: [...accounts.entries()]
        .map(([handle, v]) => ({
          handle,
          ...v,
          actions: Math.max(v.actions, actionsByHandle.get(handle) ?? 0, v.posts),
        }))
        .sort((a, b) => b.engagements - a.engagements)
        .slice(0, 12),
      content: content.sort((a, b) => b.engagements - a.engagements).slice(0, 60),
      sentiment: null,
      target,
    };
  });

/**
 * Gives descriptive AI titles to campaigns that still carry a placeholder name.
 * Runs in small batches so the manager stays responsive; user-renamed
 * campaigns are never touched.
 */
export const generateCampaignNames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ named: number }> => {
    const supabase = context.supabase as any;
    const { generateCampaignName, isGenericName } = await import("./campaign-naming.server");

    const { data: jobs } = await supabase
      .from("publish_jobs")
      .select(
        "id, mode, name, name_is_custom, tweet_text, comment_text, objective_text, target_tweet_url, engagement_actions, engagement_targets",
      )

      .eq("name_is_custom", false)
      .order("created_at", { ascending: false })
      .limit(40);

    const pending = ((jobs ?? []) as any[]).filter((j) => isGenericName(j.name)).slice(0, 8);
    let named = 0;

    for (const job of pending) {
      const { name, summary } = await generateCampaignName({
        actionType: String(job.mode ?? "campaign"),
        objective: job.objective_text || null,
        content: job.tweet_text || job.comment_text || null,
        targetUrl: job.target_tweet_url || null,
        handles: Array.isArray(job.engagement_targets)
          ? job.engagement_targets.map((t: any) => String(t?.handle ?? t)).slice(0, 10)
          : [],
      });
      const { error } = await supabase
        .from("publish_jobs")
        .update({ name, summary })
        .eq("id", job.id);
      if (!error) named += 1;
    }

    const { data: listens } = await supabase
      .from("listening_campaigns")
      .select("id, name, summary, keywords, hashtags, core_message")

      .eq("summary", "")
      .limit(8);

    for (const c of (listens ?? []) as any[]) {
      const { name, summary } = await generateCampaignName({
        actionType: "intercept",
        objective: c.core_message || null,
        keywords: c.keywords ?? [],
        hashtags: c.hashtags ?? [],
      });
      await supabase
        .from("listening_campaigns")
        .update({
          summary: summary || String(c.core_message ?? "").slice(0, 110),
          ...(isGenericName(c.name) ? { name } : {}),
        })
        .eq("id", c.id);
      named += 1;
    }

    return { named };
  });

/** Manual rename. Marks the campaign so automatic naming leaves it alone. */
export const renameManagedCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => keySchema.extend({ name: z.string() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const name = data.name.trim().slice(0, 70);
    if (!name) throw new Error("Give the campaign a name.");
    const table = data.source === "publish" ? "publish_jobs" : "listening_campaigns";
    const patch = data.source === "publish" ? { name, name_is_custom: true } : { name };
    const { error } = await (context.supabase as any).from(table).update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
