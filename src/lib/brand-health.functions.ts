import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeBrandHealth,
  daysInRange,
  emptyBrandHealth,
  type BrandHealthRange,
  type BrandHealthSentItem,
  type BrandHealthSummary,
} from "./brand-health";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export const getBrandHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown): BrandHealthRange => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const from =
      typeof raw["from"] === "string" && DAY_RE.test(raw["from"]) ? raw["from"] : undefined;
    const to = typeof raw["to"] === "string" && DAY_RE.test(raw["to"]) ? raw["to"] : undefined;
    if (from && to && from > to) return { from: to, to: from };
    return { from, to };
  })
  .handler(async ({ context, data }): Promise<BrandHealthSummary> => {
    const supabase = context.supabase;
    const userId = context.userId;
    const out = emptyBrandHealth();

    const range: BrandHealthRange = data ?? {};
    const startISO = range.from ? `${range.from}T00:00:00.000Z` : null;
    const endISO = range.to ? `${range.to}T23:59:59.999Z` : null;
    const bucketDays = daysInRange(range);

    /** Applies the selected window to a query on the given timestamp column. */
    const windowed = (query: any, column: string) => {
      let q = query;
      if (startISO) q = q.gte(column, startISO);
      if (endISO) q = q.lte(column, endISO);
      return q;
    };

    const [
      threadsRes,
      accountsRes,
      actionsRes,
      repliesRes,
      alwaysOnRes,
      metricsRes,
      jobsRes,
      queueRes,
      campaignsRes,
    ] = await Promise.all([
      windowed(
        supabase
          .from("threads")
          .select("id, title, updated_at, visibility")

          .order("updated_at", { ascending: false })
          .limit(200),
        "updated_at",
      ),
      supabase.from("x_accounts").select("id, is_active"),
      windowed(
        supabase
          .from("publish_actions")
          .select(
            "id, action_type, status, content, result_tweet_id, created_at, x_accounts(handle)",
          )

          .order("created_at", { ascending: false })
          .limit(300),
        "created_at",
      ),
      windowed(
        supabase
          .from("campaign_replies")
          .select("id, campaign_id, handle, reply_text, status, result_tweet_id, created_at")

          .order("created_at", { ascending: false })
          .limit(300),
        "created_at",
      ),
      windowed(
        supabase
          .from("persona_daily_posts")
          .select(
            "id, content, status, result_tweet_id, published_at, created_at, x_accounts(handle)",
          )

          .order("created_at", { ascending: false })
          .limit(300),
        "created_at",
      ),
      windowed(
        supabase
          .from("tweet_metrics")
          .select(
            "handle, like_count, retweet_count, reply_count, quote_count, bookmark_count, impression_count, tweeted_at, fetched_at",
          )

          .order("tweeted_at", { ascending: false })
          .limit(500),
        "tweeted_at",
      ),
      windowed(
        supabase
          .from("publish_jobs")
          .select(
            "id, mode, tweet_text, comment_text, objective_mode, objective_text, status, created_at",
          )

          .order("created_at", { ascending: false })
          .limit(200),
        "created_at",
      ),
      supabase
        .from("scheduled_actions")
        .select("id, run_at, source")

        .eq("status", "pending")
        .order("run_at", { ascending: true })
        .limit(500),
      supabase.from("listening_campaigns").select("id, name, keywords, hashtags, is_active"),
    ]);

    // ---- Tests -------------------------------------------------------------
    const threads = (threadsRes.data ?? []) as any[];
    const ids = threads.map((t) => t.id as string);
    const confidence: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: analyses } = await supabase
        .from("messages")
        .select("thread_id, analysis")
        .in("thread_id", ids)
        .eq("role", "assistant");
      for (const row of (analyses ?? []) as any[]) {
        const value = row.analysis?.confidence;
        if (typeof value === "number") confidence[row.thread_id] = Math.round(value);
      }
    }

    const tests = threads.map((t) => ({
      id: t.id as string,
      title: (t.title as string) ?? "Untitled test",
      confidence: confidence[t.id] ?? null,
      updatedAt: t.updated_at as string,
    }));
    const scored = tests.filter((t) => typeof t.confidence === "number");
    out.tests.total = tests.length;
    out.tests.scored = scored.length;
    out.tests.average = scored.length
      ? Math.round(scored.reduce((s, t) => s + (t.confidence ?? 0), 0) / scored.length)
      : null;
    out.tests.strong = scored.filter((t) => (t.confidence ?? 0) >= 75).length;
    out.tests.weak = scored.filter((t) => (t.confidence ?? 0) < 60).length;
    out.tests.shared = threads.filter((t) => t.visibility === "workspace").length;
    out.tests.recent = tests.slice(0, 6);

    const trendBuckets = new Map<string, { total: number; count: number }>();
    for (const t of scored) {
      const key = dayKey(t.updatedAt);
      const b = trendBuckets.get(key) ?? { total: 0, count: 0 };
      b.total += t.confidence ?? 0;
      b.count += 1;
      trendBuckets.set(key, b);
    }
    out.tests.trend = [...trendBuckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-bucketDays.length)
      .map(([date, b]) => ({
        date,
        confidence: Math.round(b.total / b.count),
        tests: b.count,
      }));

    // ---- Outbound ----------------------------------------------------------
    const accounts = (accountsRes.data ?? []) as any[];
    out.outbound.accounts = accounts.length;
    out.outbound.activeAccounts = accounts.filter((a) => a.is_active).length;

    const sent: BrandHealthSentItem[] = [];
    let failed = 0;
    let held = 0;

    for (const a of (actionsRes.data ?? []) as any[]) {
      if (a.action_type !== "tweet" && a.action_type !== "comment") continue;
      const handle = a.x_accounts?.handle ?? "";
      if (a.status === "failed") failed += 1;
      if (a.status !== "success") continue;
      sent.push({
        id: a.id,
        source: "publish",
        handle,
        content: a.content ?? "",
        status: a.status,
        url: a.result_tweet_id
          ? `https://x.com/${handle || "i"}/status/${a.result_tweet_id}`
          : null,
        createdAt: a.created_at,
      });
    }

    for (const r of (repliesRes.data ?? []) as any[]) {
      if (r.status === "failed") failed += 1;
      if (r.status === "held") held += 1;
      if (r.status !== "success") continue;
      sent.push({
        id: r.id,
        source: "campaign",
        handle: r.handle ?? "",
        content: r.reply_text ?? "",
        status: r.status,
        url: r.result_tweet_id
          ? `https://x.com/${r.handle || "i"}/status/${r.result_tweet_id}`
          : null,
        createdAt: r.created_at,
      });
    }

    for (const p of (alwaysOnRes.data ?? []) as any[]) {
      const handle = p.x_accounts?.handle ?? "";
      if (p.status === "failed") failed += 1;
      if (p.status === "held") held += 1;
      if (p.status !== "published") continue;
      sent.push({
        id: p.id,
        source: "always-on",
        handle,
        content: p.content ?? "",
        status: p.status,
        url: p.result_tweet_id
          ? `https://x.com/${handle || "i"}/status/${p.result_tweet_id}`
          : null,
        createdAt: p.published_at ?? p.created_at,
      });
    }

    sent.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    out.outbound.posts = sent.filter((s) => s.source !== "campaign").length;
    out.outbound.replies = sent.filter((s) => s.source === "campaign").length;
    out.outbound.alwaysOnPosts = sent.filter((s) => s.source === "always-on").length;
    out.outbound.failed = failed;
    out.outbound.held = held;
    out.outbound.recent = sent.slice(0, 8);
    out.outbound.bySource = [
      { source: "Publish", count: sent.filter((s) => s.source === "publish").length },
      { source: "Campaigns", count: sent.filter((s) => s.source === "campaign").length },
      { source: "Always-on", count: sent.filter((s) => s.source === "always-on").length },
    ].filter((s) => s.count > 0);

    const sentDays = new Map<string, number>(bucketDays.map((d) => [d, 0]));
    for (const s of sent) {
      const key = dayKey(s.createdAt);
      if (sentDays.has(key)) sentDays.set(key, (sentDays.get(key) ?? 0) + 1);
    }
    out.outbound.byDay = [...sentDays.entries()].map(([date, count]) => ({ date, sent: count }));

    // ---- Publish -----------------------------------------------------------
    const jobs = (jobsRes.data ?? []) as any[];
    const publishActions = (actionsRes.data ?? []) as any[];
    const queue = (queueRes.data ?? []) as any[];
    out.publish.jobs = jobs.length;
    out.publish.objectiveJobs = jobs.filter((j) => j.objective_mode).length;
    out.publish.posts = publishActions.filter(
      (a) => a.action_type === "tweet" && a.status === "success",
    ).length;
    out.publish.comments = publishActions.filter(
      (a) => a.action_type === "comment" && a.status === "success",
    ).length;
    out.publish.queued = queue.length;
    out.publish.nextRunAt = queue[0]?.run_at ?? null;
    const lastJob = jobs[0];
    out.publish.lastRunAt = lastJob?.created_at ?? null;
    out.publish.lastObjective = lastJob?.objective_mode
      ? (lastJob.objective_text ?? null) || null
      : null;
    out.publish.lastMessage = lastJob ? lastJob.tweet_text || lastJob.comment_text || null : null;

    // ---- Campaigns ---------------------------------------------------------
    const campaignRows = (campaignsRes.data ?? []) as any[];
    const replyRows = (repliesRes.data ?? []) as any[];
    out.campaigns.total = campaignRows.length;
    out.campaigns.active = campaignRows.filter((c) => c.is_active).length;
    out.campaigns.keywords = campaignRows.reduce(
      (n, c) => n + (c.keywords?.length ?? 0) + (c.hashtags?.length ?? 0),
      0,
    );
    out.campaigns.replies = replyRows.filter((r) => r.status === "success").length;
    out.campaigns.held = replyRows.filter((r) => r.status === "held").length;
    out.campaigns.failed = replyRows.filter((r) => r.status === "failed").length;

    const perCampaign = new Map<
      string,
      { replies: number; handles: Set<string>; lastReplyAt: string | null }
    >();
    for (const r of replyRows) {
      if (r.status !== "success" || !r.campaign_id) continue;
      const c = perCampaign.get(r.campaign_id) ?? {
        replies: 0,
        handles: new Set<string>(),
        lastReplyAt: null as string | null,
      };
      c.replies += 1;
      if (r.handle) c.handles.add(r.handle);
      if (!c.lastReplyAt || r.created_at > c.lastReplyAt) c.lastReplyAt = r.created_at;
      perCampaign.set(r.campaign_id, c);
    }
    out.campaigns.top = [...perCampaign.entries()]
      .map(([id, v]) => ({
        id,
        name: campaignRows.find((c) => c.id === id)?.name ?? "Campaign",
        replies: v.replies,
        accounts: v.handles.size,
        lastReplyAt: v.lastReplyAt,
      }))
      .sort((a, b) => b.replies - a.replies)
      .slice(0, 5);

    // ---- Reach -------------------------------------------------------------
    const metrics = (metricsRes.data ?? []) as any[];
    const reachDays = new Map<string, { impressions: number; engagements: number; reach: number }>(
      bucketDays.map((d) => [d, { impressions: 0, engagements: 0, reach: 0 }]),
    );
    const byAccount = new Map<string, { posts: number; reach: number; engagements: number }>();
    let lastRefreshed: string | null = null;

    for (const m of metrics) {
      const engagements =
        (m.like_count ?? 0) +
        (m.retweet_count ?? 0) +
        (m.reply_count ?? 0) +
        (m.quote_count ?? 0) +
        (m.bookmark_count ?? 0);
      const impressions = m.impression_count ?? 0;
      const reach =
        impressions > 0 ? impressions : ((m.retweet_count ?? 0) + (m.quote_count ?? 0)) * 120;

      out.reach.impressions += impressions;
      out.reach.engagements += engagements;
      out.reach.reach += reach;

      const key = dayKey(m.tweeted_at ?? m.fetched_at);
      const bucket = reachDays.get(key);
      if (bucket) {
        bucket.impressions += impressions;
        bucket.engagements += engagements;
        bucket.reach += reach;
      }

      const handle = m.handle ?? "";
      const acc = byAccount.get(handle) ?? { posts: 0, reach: 0, engagements: 0 };
      acc.posts += 1;
      acc.reach += reach;
      acc.engagements += engagements;
      byAccount.set(handle, acc);

      if (!lastRefreshed || (m.fetched_at ?? "") > lastRefreshed) lastRefreshed = m.fetched_at;
    }

    out.reach.engagementRate = out.reach.impressions
      ? Math.round((out.reach.engagements / out.reach.impressions) * 1000) / 10
      : 0;
    out.reach.byDay = [...reachDays.entries()].map(([date, v]) => ({ date, ...v }));
    out.reach.topAccounts = [...byAccount.entries()]
      .map(([handle, v]) => ({ handle, ...v }))
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 5);
    out.reach.lastRefreshed = lastRefreshed;

    const health = computeBrandHealth({
      averageConfidence: out.tests.average,
      sent: sent.length,
      failed,
      engagementRate: out.reach.engagementRate,
    });
    out.score = health.score;
    out.scoreParts = health.parts;

    return out;
  });
