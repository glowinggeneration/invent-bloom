export type PerformanceRow = {
  tweetId: string;
  handle: string;
  kind: "tweet" | "reply";
  content: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  impressions: number;
  engagements: number;
  reach: number;
  tweetedAt: string | null;
  fetchedAt: string;
  url: string;
  campaignId: string | null;
  campaignName: string | null;
  targetHandle: string | null;
};

export type PerformanceTotals = {
  posts: number;
  replies: number;
  impressions: number;
  engagements: number;
  reach: number;
  likes: number;
  retweets: number;
  repliesReceived: number;
  bookmarks: number;
  quotes: number;
  engagementRate: number;
  /** True when engagementRate is a real ratio (impressions > 0) - when
   *  false, `engagementRate` is a placeholder 0 and the UI must show
   *  "not available", never "0%", which would misrepresent unknown
   *  performance as confirmed poor performance. */
  engagementRateAvailable: boolean;
  /** True when any row in this scope has no reported impressions and its
   *  contribution to `reach` came from the amplification estimate in
   *  reachOf(), not the platform. The UI must label reach as an estimate
   *  whenever this is true - it is never presented as a measured fact. */
  reachIncludesEstimates: boolean;
};

export type PerformanceSummary = {
  totals: PerformanceTotals;
  rows: PerformanceRow[];
  byAccount: {
    handle: string;
    posts: number;
    impressions: number;
    engagements: number;
    reach: number;
  }[];
  byDay: { date: string; impressions: number; engagements: number; reach: number }[];
  byCampaign: {
    campaignId: string;
    name: string;
    replies: number;
    accounts: number;
    impressions: number;
    engagements: number;
    reach: number;
    engagementRate: number;
    lastReplyAt: string | null;
  }[];
  lastRefreshed: string | null;
  /** Reconciliation against execution facts (scheduled_actions), so a gap
   *  between "posts actually sent" and "posts we have metrics for" is
   *  shown honestly instead of the missing posts just not appearing. */
  sourceCoverage: {
    executedPosts: number;
    postsWithMetrics: number;
  };
};

/** Engagements = every interaction the post received. */
export function engagementsOf(r: {
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
}): number {
  return r.likes + r.retweets + r.replies + r.quotes + r.bookmarks;
}

/**
 * Reach estimate: unique accounts a post plausibly landed with - impressions
 * when available, otherwise an amplification estimate from reshares.
 */
export function reachOf(impressions: number, retweets: number, quotes: number): number {
  return impressions > 0 ? impressions : (retweets + quotes) * 120;
}

/** True when a row's reach came from the amplification estimate rather than
 *  a reported impression count - i.e. whenever reachOf() took its fallback
 *  branch. Kept alongside reachOf() so the two can never drift apart. */
export function isReachEstimated(impressions: number): boolean {
  return impressions <= 0;
}

export function emptySummary(): PerformanceSummary {
  return {
    totals: {
      posts: 0,
      replies: 0,
      impressions: 0,
      engagements: 0,
      reach: 0,
      likes: 0,
      retweets: 0,
      repliesReceived: 0,
      bookmarks: 0,
      quotes: 0,
      engagementRate: 0,
      engagementRateAvailable: false,
      reachIncludesEstimates: false,
    },
    rows: [],
    byAccount: [],
    byDay: [],
    byCampaign: [],
    lastRefreshed: null,
    sourceCoverage: { executedPosts: 0, postsWithMetrics: 0 },
  };
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Narrow a summary to a single campaign (or to rows with no campaign) so every
 * chart, total and breakdown on the page reflects the selected campaign only.
 */
export function scopeSummary(summary: PerformanceSummary, campaignId: string): PerformanceSummary {
  if (campaignId === "all") return summary;
  const rows = summary.rows.filter((r) =>
    campaignId === "none" ? !r.campaignId : r.campaignId === campaignId,
  );

  const totals: PerformanceTotals = {
    posts: 0,
    replies: 0,
    impressions: 0,
    engagements: 0,
    reach: 0,
    likes: 0,
    retweets: 0,
    repliesReceived: 0,
    bookmarks: 0,
    quotes: 0,
    engagementRate: 0,
    engagementRateAvailable: false,
    reachIncludesEstimates: false,
  };
  const accounts = new Map<string, PerformanceSummary["byAccount"][number]>();
  const days = new Map<string, PerformanceSummary["byDay"][number]>();

  for (const r of rows) {
    if (r.kind === "reply") totals.replies += 1;
    else totals.posts += 1;
    totals.impressions += r.impressions;
    totals.engagements += r.engagements;
    totals.reach += r.reach;
    totals.likes += r.likes;
    totals.retweets += r.retweets;
    totals.repliesReceived += r.replies;
    totals.bookmarks += r.bookmarks;
    totals.quotes += r.quotes;
    if (isReachEstimated(r.impressions)) totals.reachIncludesEstimates = true;

    const acc = accounts.get(r.handle) ?? {
      handle: r.handle,
      posts: 0,
      impressions: 0,
      engagements: 0,
      reach: 0,
    };
    acc.posts += 1;
    acc.impressions += r.impressions;
    acc.engagements += r.engagements;
    acc.reach += r.reach;
    accounts.set(r.handle, acc);

    const date = (r.tweetedAt ?? r.fetchedAt).slice(0, 10);
    const day = days.get(date) ?? { date, impressions: 0, engagements: 0, reach: 0 };
    day.impressions += r.impressions;
    day.engagements += r.engagements;
    day.reach += r.reach;
    days.set(date, day);
  }

  totals.engagementRateAvailable = totals.impressions > 0;
  totals.engagementRate = totals.engagementRateAvailable
    ? Math.round((totals.engagements / totals.impressions) * 1000) / 10
    : 0;

  return {
    ...summary,
    rows,
    totals,
    byAccount: [...accounts.values()].sort((a, b) => b.impressions - a.impressions),
    byDay: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    byCampaign: summary.byCampaign.filter((c) => c.campaignId === campaignId),
  };
}
