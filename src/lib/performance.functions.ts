import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  emptySummary,
  engagementsOf,
  isReachEstimated,
  reachOf,
  type PerformanceRow,
  type PerformanceSummary,
} from "./performance";

export const getPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PerformanceSummary> => {
    const data: any[] = [];
    const PAGE = 1000;
    for (let page = 0; page < 10; page += 1) {
      const { data: pageRows, error } = await context.supabase
        .from("tweet_metrics")
        .select(
          "tweet_id, handle, kind, content, like_count, retweet_count, reply_count, quote_count, bookmark_count, impression_count, tweeted_at, fetched_at",
        )

        .order("tweeted_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw new Error(error.message);
      data.push(...(pageRows ?? []));
      if ((pageRows ?? []).length < PAGE) break;
    }

    // Map each tweet back to the listening campaign that produced it, so
    // Performance can group campaign replies by campaign.
    const { data: replyRows } = await context.supabase
      .from("campaign_replies")
      .select("campaign_id, result_tweet_id, author_handle, created_at, listening_campaigns(name)")

      .eq("status", "success")
      .not("result_tweet_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(2000);
    const campaignByTweet = new Map<
      string,
      { id: string; name: string; targetHandle: string | null; createdAt: string }
    >();
    for (const r of (replyRows ?? []) as any[]) {
      const tweetId = String(r.result_tweet_id ?? "");
      if (!tweetId || campaignByTweet.has(tweetId)) continue;
      campaignByTweet.set(tweetId, {
        id: String(r.campaign_id),
        name: r.listening_campaigns?.name ?? "Campaign",
        targetHandle: r.author_handle ?? null,
        createdAt: r.created_at,
      });
    }

    const rows: PerformanceRow[] = ((data ?? []) as any[]).map((r) => {
      const base = {
        likes: r.like_count ?? 0,
        retweets: r.retweet_count ?? 0,
        replies: r.reply_count ?? 0,
        quotes: r.quote_count ?? 0,
        bookmarks: r.bookmark_count ?? 0,
      };
      const impressions = r.impression_count ?? 0;
      return {
        tweetId: r.tweet_id,
        handle: r.handle ?? "",
        kind: r.kind === "reply" ? "reply" : "tweet",
        content: r.content ?? "",
        ...base,
        impressions,
        engagements: engagementsOf(base),
        reach: reachOf(impressions, base.retweets, base.quotes),
        tweetedAt: r.tweeted_at ?? null,
        fetchedAt: r.fetched_at,
        url: `https://x.com/${r.handle || "i"}/status/${r.tweet_id}`,
        campaignId: campaignByTweet.get(r.tweet_id)?.id ?? null,
        campaignName: campaignByTweet.get(r.tweet_id)?.name ?? null,
        targetHandle: campaignByTweet.get(r.tweet_id)?.targetHandle ?? null,
      };
    });

    if (!rows.length) return emptySummary();

    const summary = emptySummary();
    const accounts = new Map<
      string,
      { posts: number; impressions: number; engagements: number; reach: number }
    >();
    const days = new Map<string, { impressions: number; engagements: number; reach: number }>();
    const campaigns = new Map<
      string,
      {
        name: string;
        replies: number;
        handles: Set<string>;
        impressions: number;
        engagements: number;
        reach: number;
        lastReplyAt: string | null;
      }
    >();

    for (const r of rows) {
      summary.totals.posts += r.kind === "tweet" ? 1 : 0;
      summary.totals.replies += r.kind === "reply" ? 1 : 0;
      summary.totals.impressions += r.impressions;
      summary.totals.engagements += r.engagements;
      summary.totals.reach += r.reach;
      summary.totals.likes += r.likes;
      summary.totals.retweets += r.retweets;
      summary.totals.repliesReceived += r.replies;
      summary.totals.bookmarks += r.bookmarks;
      summary.totals.quotes += r.quotes;
      if (isReachEstimated(r.impressions)) summary.totals.reachIncludesEstimates = true;

      const acc = accounts.get(r.handle) ?? { posts: 0, impressions: 0, engagements: 0, reach: 0 };
      acc.posts += 1;
      acc.impressions += r.impressions;
      acc.engagements += r.engagements;
      acc.reach += r.reach;
      accounts.set(r.handle, acc);

      if (r.campaignId) {
        const c = campaigns.get(r.campaignId) ?? {
          name: r.campaignName ?? "Campaign",
          replies: 0,
          handles: new Set<string>(),
          impressions: 0,
          engagements: 0,
          reach: 0,
          lastReplyAt: null as string | null,
        };
        c.replies += 1;
        if (r.handle) c.handles.add(r.handle);
        c.impressions += r.impressions;
        c.engagements += r.engagements;
        c.reach += r.reach;
        const at = r.tweetedAt ?? r.fetchedAt;
        if (!c.lastReplyAt || at > c.lastReplyAt) c.lastReplyAt = at;
        campaigns.set(r.campaignId, c);
      }

      const day = (r.tweetedAt ?? r.fetchedAt).slice(0, 10);
      const d = days.get(day) ?? { impressions: 0, engagements: 0, reach: 0 };
      d.impressions += r.impressions;
      d.engagements += r.engagements;
      d.reach += r.reach;
      days.set(day, d);
    }

    summary.totals.engagementRateAvailable = summary.totals.impressions > 0;
    summary.totals.engagementRate = summary.totals.engagementRateAvailable
      ? Number(((summary.totals.engagements / summary.totals.impressions) * 100).toFixed(2))
      : 0;

    summary.rows = rows;
    summary.byAccount = [...accounts.entries()]
      .map(([handle, v]) => ({ handle, ...v }))
      .sort((a, b) => b.engagements - a.engagements)
      .slice(0, 12);
    summary.byDay = [...days.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
    summary.byCampaign = [...campaigns.entries()]
      .map(([campaignId, v]) => ({
        campaignId,
        name: v.name,
        replies: v.replies,
        accounts: v.handles.size,
        impressions: v.impressions,
        engagements: v.engagements,
        reach: v.reach,
        engagementRate: v.impressions
          ? Number(((v.engagements / v.impressions) * 100).toFixed(2))
          : 0,
        lastReplyAt: v.lastReplyAt,
      }))
      .sort((a, b) => b.engagements - a.engagements);
    summary.lastRefreshed = rows.reduce(
      (max, r) => (r.fetchedAt > max ? r.fetchedAt : max),
      rows[0]!.fetchedAt,
    );

    // Reconciliation: how many posts were actually sent (an execution fact,
    // from scheduled_actions) versus how many of those have platform metrics
    // synced (tweet_metrics rows). A gap here is shown honestly rather than
    // the missing posts just silently not appearing anywhere on the page.
    const { resolveWorkspaceId } = await import("./workspace.server");
    const workspaceId = await resolveWorkspaceId(context);
    const { count: executedPosts } = await (context.supabase as any)
      .from("scheduled_actions")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "success")
      .in("action_type", ["tweet", "comment"])
      .not("result_tweet_id", "is", null);
    summary.sourceCoverage = {
      executedPosts: executedPosts ?? 0,
      postsWithMetrics: rows.length,
    };

    return summary;
  });

export const refreshPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveWorkspaceId } = await import("./workspace.server");
    const workspaceId = await resolveWorkspaceId(context);
    const { refreshUserMetrics } = await import("./performance.server");
    return refreshUserMetrics(context.userId, workspaceId);
  });
