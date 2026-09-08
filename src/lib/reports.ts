/**
 * Shapes for the daily record kept on /reports.
 *
 * Everything in here is browser-safe. The numbers are computed on the server
 * from stored mentions and stored campaign execution rows — a report never
 * estimates: an action only counts as completed when the platform recorded a
 * success for it.
 */

export type ReportKind = "daily" | "weekly" | "monthly" | "custom";
export type ReportStatus = "generating" | "ready" | "partial" | "failed";

/** Reporting day is anchored to the federation's own clock. */
export const REPORT_TIMEZONE = "Africa/Nairobi";
export const REPORT_TZ_OFFSET_HOURS = 3;

export const REPORT_FILTERS = [
  { value: "all", label: "All reports" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "campaign", label: "Campaign" },
  { value: "mentions", label: "Mentions" },
  { value: "persona", label: "Persona activity" },
] as const;

export type ReportFilter = (typeof REPORT_FILTERS)[number]["value"];

export type ReportSentiment = {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
};

export type ReportMetrics = {
  mentions: number;
  previousMentions: number;
  mentionsChangePct: number | null;
  sentiment: ReportSentiment;
  views: number;
  engagements: number;
  /** Our own published output in the period (organic conversation excluded). */
  ownPosts: number;
};

export type ReportPlatform = {
  platform: string;
  count: number;
  sharePct: number;
  engagements: number;
  views: number;
};

export type ReportTopic = {
  topic: string;
  volume: number;
  changePct: number | null;
  positivePct: number;
  negativePct: number;
};

export type ReportPost = {
  platform: string;
  author: string;
  handle: string;
  title: string;
  url: string;
  publishedAt: string | null;
  engagements: number;
  views: number;
  sentiment: string;
};

export type ReportConversation = {
  platforms: ReportPlatform[];
  topics: ReportTopic[];
  topPosts: ReportPost[];
  issues: ReportTopic[];
  mostDiscussed: string | null;
  fastestGrowing: string | null;
  mostEngagedPlatform: string | null;
  org: ReportSentiment;
  keyFigure: ReportSentiment;
};

/** One campaign execution, frozen as it stood at the end of the period. */
export type CampaignRun = {
  campaignId: string;
  campaignName: string;
  campaignType: string;
  source: "publish" | "listen";
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  targetPost: string;
  targetUrl: string;
  personasRequested: number;
  personasEligible: number;
  personasUsed: number;
  requestedActions: number;
  completedActions: number;
  failedActions: number;
  likes: number;
  replies: number;
  reposts: number;
  follows: number;
  posts: number;
  engagementGenerated: number;
};

export type ReportCampaigns = {
  total: number;
  runs: CampaignRun[];
  requestedActions: number;
  completedActions: number;
  failedActions: number;
  likes: number;
  replies: number;
  reposts: number;
  follows: number;
  posts: number;
};

export type PersonaActivityRow = {
  persona: string;
  account: string;
  platform: string;
  campaign: string;
  action: string;
  target: string;
  time: string | null;
  status: string;
  result: string;
};

export type ReportPersonas = {
  active: number;
  totalActions: number;
  successful: number;
  failed: number;
  leaderboard: {
    persona: string;
    handle: string;
    actions: number;
    successful: number;
    failed: number;
  }[];
};

export type ReportInsight = { text: string };

export type ReportRecommendation = {
  category: "AMPLIFY" | "RESPOND" | "WATCH" | "JOIN" | "PUBLISH";
  headline: string;
  action: string;
};

export type ReportRecord = {
  id: string;
  kind: ReportKind;
  reportDate: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  status: ReportStatus;
  generatedAt: string;
  metrics: ReportMetrics;
  conversation: ReportConversation;
  campaigns: ReportCampaigns;
  personas: ReportPersonas;
  insights: ReportInsight[];
  recommendations: ReportRecommendation[];
  sourceErrors: string[];
};

/** Summary line used by the report library list. */
export type ReportListItem = {
  id: string;
  kind: ReportKind;
  reportDate: string;
  label: string;
  status: ReportStatus;
  generatedAt: string;
  mentions: number;
  campaigns: number;
  engagementActions: number;
};

export const STATUS_LABEL: Record<ReportStatus, string> = {
  generating: "Generating",
  ready: "Ready",
  partial: "Partial",
  failed: "Failed",
};

export function emptySentiment(): ReportSentiment {
  return {
    positive: 0,
    neutral: 0,
    negative: 0,
    total: 0,
    positivePct: 0,
    neutralPct: 0,
    negativePct: 0,
  };
}

export function sentimentOf(counts: {
  positive: number;
  neutral: number;
  negative: number;
}): ReportSentiment {
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

/** "14 August 2026" in the reporting timezone. */
export function formatReportDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** "14 Aug 2026" for compact list rows. */
export function formatReportDateShort(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Start/end of one reporting day (Nairobi) as ISO instants. */
export function dayBounds(dateKey: string): { start: string; end: string } {
  const offset = REPORT_TZ_OFFSET_HOURS;
  const start = new Date(`${dateKey}T00:00:00Z`).getTime() - offset * 3600_000;
  return {
    start: new Date(start).toISOString(),
    end: new Date(start + 24 * 3600_000).toISOString(),
  };
}

/** YYYY-MM-DD for an instant, in the reporting timezone. */
export function reportDateKey(at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + REPORT_TZ_OFFSET_HOURS * 3600_000);
  return shifted.toISOString().slice(0, 10);
}

export function csvFilename(prefix: string, dateKey: string): string {
  return `SMAIT_${prefix}_${dateKey}.csv`;
}
