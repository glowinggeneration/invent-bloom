/** Client-safe types and helpers for the Brand Health overview. */

export type BrandHealthTestPoint = {
  id: string;
  title: string;
  confidence: number | null;
  updatedAt: string;
};

export type BrandHealthSentItem = {
  id: string;
  source: "publish" | "campaign" | "always-on";
  handle: string;
  content: string;
  status: string;
  url: string | null;
  createdAt: string;
};

export type BrandHealthSummary = {
  tests: {
    total: number;
    scored: number;
    average: number | null;
    strong: number;
    weak: number;
    shared: number;
    recent: BrandHealthTestPoint[];
    trend: { date: string; confidence: number; tests: number }[];
  };
  outbound: {
    accounts: number;
    activeAccounts: number;
    posts: number;
    replies: number;
    alwaysOnPosts: number;
    failed: number;
    held: number;
    bySource: { source: string; count: number }[];
    byDay: { date: string; sent: number }[];
    recent: BrandHealthSentItem[];
  };
  /** What went out through /publish. */
  publish: {
    jobs: number;
    objectiveJobs: number;
    posts: number;
    comments: number;
    queued: number;
    nextRunAt: string | null;
    lastRunAt: string | null;
    lastObjective: string | null;
    lastMessage: string | null;
  };
  /** What the listening campaigns are doing. */
  campaigns: {
    total: number;
    active: number;
    replies: number;
    held: number;
    failed: number;
    keywords: number;
    top: {
      id: string;
      name: string;
      replies: number;
      accounts: number;
      lastReplyAt: string | null;
    }[];
  };
  reach: {
    impressions: number;
    engagements: number;
    reach: number;
    engagementRate: number;
    byDay: { date: string; impressions: number; engagements: number; reach: number }[];
    topAccounts: { handle: string; posts: number; reach: number; engagements: number }[];
    lastRefreshed: string | null;
  };
  /** 0-100 composite of message confidence, delivery reliability and audience response. */
  score: number;
  scoreParts: { label: string; value: number; weight: number }[];
};

export function emptyBrandHealth(): BrandHealthSummary {
  return {
    tests: {
      total: 0,
      scored: 0,
      average: null,
      strong: 0,
      weak: 0,
      shared: 0,
      recent: [],
      trend: [],
    },
    outbound: {
      accounts: 0,
      activeAccounts: 0,
      posts: 0,
      replies: 0,
      alwaysOnPosts: 0,
      failed: 0,
      held: 0,
      bySource: [],
      byDay: [],
      recent: [],
    },
    publish: {
      jobs: 0,
      objectiveJobs: 0,
      posts: 0,
      comments: 0,
      queued: 0,
      nextRunAt: null,
      lastRunAt: null,
      lastObjective: null,
      lastMessage: null,
    },
    campaigns: {
      total: 0,
      active: 0,
      replies: 0,
      held: 0,
      failed: 0,
      keywords: 0,
      top: [],
    },
    reach: {
      impressions: 0,
      engagements: 0,
      reach: 0,
      engagementRate: 0,
      byDay: [],
      topAccounts: [],
      lastRefreshed: null,
    },
    score: 0,
    scoreParts: [],
  };
}

/**
 * Composite brand-health score.
 * Confidence (50%) - how the persona panel receives the messaging.
 * Delivery (30%) - share of outbound actions that actually landed.
 * Response (20%) - engagement rate of what went out, normalised at 5%.
 */
export function computeBrandHealth(input: {
  averageConfidence: number | null;
  sent: number;
  failed: number;
  engagementRate: number;
}): { score: number; parts: { label: string; value: number; weight: number }[] } {
  const confidence = input.averageConfidence ?? 0;
  const attempted = input.sent + input.failed;
  const delivery =
    attempted > 0 ? (input.sent / attempted) * 100 : input.averageConfidence === null ? 0 : 100;
  const response = Math.min(100, (input.engagementRate / 5) * 100);

  const parts = [
    { label: "Message confidence", value: Math.round(confidence), weight: 0.5 },
    { label: "Delivery reliability", value: Math.round(delivery), weight: 0.3 },
    { label: "Audience response", value: Math.round(response), weight: 0.2 },
  ];
  const score = Math.round(parts.reduce((sum, p) => sum + p.value * p.weight, 0));
  return { score, parts };
}

export function healthTone(score: number): "green" | "amber" | "red" {
  if (score >= 70) return "green";
  if (score >= 45) return "amber";
  return "red";
}

/** ---- Date range helpers (shared by the dashboard filter and the server fn) */

export const BRAND_HEALTH_DEFAULT_DAYS = 14;
/** Hard cap so a huge custom range can't produce thousands of chart buckets. */
export const BRAND_HEALTH_MAX_BUCKETS = 120;

export type BrandHealthRange = { from?: string | undefined; to?: string | undefined };

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Preset windows offered in the dashboard filter. `null` days = all time. */
export const BRAND_HEALTH_PRESETS: { id: string; label: string; days: number | null }[] = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "all", label: "All time", days: null },
];

export function presetRange(days: number | null): BrandHealthRange {
  if (days === null) return {};
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  return { from: isoDay(from), to: isoDay(to) };
}

/** Inclusive list of YYYY-MM-DD days for the chart buckets in a range. */
export function daysInRange(range: BrandHealthRange): string[] {
  const end = range.to ? new Date(`${range.to}T00:00:00Z`) : new Date();
  const start = range.from
    ? new Date(`${range.from}T00:00:00Z`)
    : new Date(end.getTime() - (BRAND_HEALTH_DEFAULT_DAYS - 1) * 86400000);
  const out: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
    if (out.length >= BRAND_HEALTH_MAX_BUCKETS) break;
  }
  return out.length ? out : [isoDay(end)];
}
