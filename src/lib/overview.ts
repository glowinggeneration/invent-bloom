/**
 * Shapes and small pure helpers for the Overview intelligence page.
 *
 * Everything here is browser-safe: the numbers are produced on the server from
 * stored mentions, and this module only describes them and does the arithmetic
 * both sides need to agree on.
 */

export type OverviewWindow = "24h" | "7d" | "30d";

export const OVERVIEW_WINDOWS: { value: OverviewWindow; label: string; hours: number }[] = [
  { value: "24h", label: "24 hours", hours: 24 },
  { value: "7d", label: "7 days", hours: 24 * 7 },
  { value: "30d", label: "30 days", hours: 24 * 30 },
];

export function windowHours(w: OverviewWindow, customHours?: number | null): number {
  if (customHours && customHours > 0) return customHours;
  return OVERVIEW_WINDOWS.find((o) => o.value === w)?.hours ?? 24;
}

export type Sentiment = "positive" | "neutral" | "negative";

/** A value with the same value one period earlier. */
export type Delta = {
  value: number;
  previous: number;
  /** Null when there is no earlier data to compare against. */
  changePct: number | null;
};

export function delta(value: number, previous: number): Delta {
  return {
    value,
    previous,
    changePct: previous > 0 ? Math.round(((value - previous) / previous) * 100) : null,
  };
}

export type SentimentSplit = {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
};

export function split(counts: {
  positive: number;
  neutral: number;
  negative: number;
}): SentimentSplit {
  const total = counts.positive + counts.neutral + counts.negative;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return {
    ...counts,
    total,
    positivePct: pct(counts.positive),
    neutralPct: pct(counts.neutral),
    negativePct: pct(counts.negative),
  };
}

export type SeriesPoint = {
  /** ISO start of the bucket. */
  at: string;
  label: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
};

export type PlatformSlice = {
  platform: string;
  /** Query value used by the /mentions source filter. */
  filter: string;
  count: number;
  sharePct: number;
  sentiment: SentimentSplit;
};

export type TrendingTopic = {
  topic: string;
  /** Real count of collected posts carrying the topic in the window. */
  volume: number;
  sentiment: SentimentSplit;
  /** Volume change against the equally long previous window. */
  momentumPct: number | null;
  /** AI-written, grounded in the counts above. */
  why: string;
  relevance: string;
  opportunity: string;
};

export type JoinableConversation = {
  topic: string;
  volume: number;
  sentiment: SentimentSplit;
  why: string;
};

export type OverviewInsight = { text: string };

export type Recommendation = {
  category: "AMPLIFY" | "RESPOND" | "JOIN" | "WATCH" | "PUBLISH";
  headline: string;
  action: string;
};

export type TopicMomentum = {
  topic: string;
  volume: number;
  sentiment: SentimentSplit;
  changePct: number | null;
  /** Highest-engagement post carrying the topic. */
  topDriver: string | null;
  topDriverUrl: string | null;
};

export type TopContentItem = {
  platform: string;
  title: string;
  author: string;
  url: string;
  publishedAt: string | null;
  engagements: number;
  views: number | null;
  sentiment: Sentiment;
  thumbnailUrl: string | null;
};

export type TopAccount = {
  handle: string;
  name: string;
  platform: string;
  profileUrl: string;
  followers: number | null;
  posts: number;
  engagements: number;
  sentiment: SentimentSplit;
  stance: "supportive" | "neutral" | "critical" | "unclear";
  topTopic: string | null;
};

export type OverviewData = {
  window: OverviewWindow;
  from: string;
  to: string;
  generatedAt: string;
  /** True when nothing has been collected for the window yet. */
  empty: boolean;

  health: {
    score: number | null;
    mentions: Delta;
    engagements: Delta;
    views: Delta;
    posts: Delta;
    sentiment: SentimentSplit;
    previousSentiment: SentimentSplit;
  };

  series: SeriesPoint[];

  volume: {
    today: number;
    thisWeek: number;
    total: Delta;
  };

  entities: {
    federation: SentimentSplit;
    president: SentimentSplit;
  };

  platforms: PlatformSlice[];

  momentum: TopicMomentum[];
  issues: (TopicMomentum & { negativeChangePct: number | null; negatives: number })[];

  topContent: TopContentItem[];
  topAccounts: TopAccount[];
};

export type OverviewIntel = {
  generatedAt: string | null;
  trending: TrendingTopic[];
  joinable: JoinableConversation[];
  insights: OverviewInsight[];
  recommendations: Recommendation[];
};

export function formatCompact(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** "↑ 24%" / "↓ 8%" / "" when there is nothing to compare to. */
export function changeLabel(changePct: number | null): string {
  if (changePct === null || changePct === 0) return "";
  return `${changePct > 0 ? "↑" : "↓"} ${Math.abs(changePct)}%`;
}
