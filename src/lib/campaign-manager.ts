/**
 * Campaign Manager model.
 *
 * One shared shape for every campaign the platform can run, whatever it was
 * built from: a publish job (post / reply / like / follow / engage / mixed) or
 * a listening rule (intercept). The manager answers "what is running now and
 * how far has it got"; Performance answers "what did it produce".
 */

export type CampaignSource = "publish" | "listen";

export type CampaignStatus = "running" | "paused" | "scheduled" | "completed";

export type CampaignActionKind = "tweet" | "comment" | "like" | "retweet" | "bookmark" | "follow";

export const ACTION_KIND_LABELS: Record<CampaignActionKind, string> = {
  tweet: "Posts",
  comment: "Replies",
  like: "Likes",
  retweet: "Reposts",
  bookmark: "Bookmarks",
  follow: "Follows",
};

export type ActionBreakdown = {
  kind: CampaignActionKind;
  planned: number;
  completed: number;
  failed: number;
};

export type ManagedCampaign = {
  /** Stable key used in URLs: `publish:<id>` or `listen:<id>`. */
  key: string;
  source: CampaignSource;
  id: string;
  name: string;
  /** One-line description of what the campaign is about. */
  summary: string;
  /** False when the campaign has no action-level rows at all. */
  hasExecution: boolean;
  /** Human campaign type: Reply campaign, Follow campaign, Mixed campaign… */
  type: string;
  /** Action kinds this campaign runs, even before any action has executed. */
  kinds: CampaignActionKind[];
  status: CampaignStatus;
  startedAt: string;
  completedAt: string | null;
  planned: number;
  completed: number;
  failed: number;
  remaining: number;
  progress: number;
  nextRunAt: string | null;
  breakdown: ActionBreakdown[];
};

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  running: "Running",
  paused: "Paused",
  scheduled: "Scheduled",
  completed: "Completed",
};

/** Percentage of planned actions that have finished (success or failure). */
export function progressOf(planned: number, done: number) {
  if (planned <= 0) return 0;
  return Math.min(100, Math.round((done / planned) * 100));
}

/** Campaign type name from the mix of actions it performs. */
export function campaignTypeFrom(kinds: CampaignActionKind[]): string {
  const unique = [...new Set(kinds)];
  if (unique.length === 0) return "Campaign";
  if (unique.length > 1) {
    const engagementOnly = unique.every((k) => k === "like" || k === "retweet" || k === "bookmark");
    if (engagementOnly) return "Engagement campaign";
    return "Mixed campaign";
  }
  switch (unique[0]) {
    case "tweet":
      return "Post campaign";
    case "comment":
      return "Reply campaign";
    case "like":
      return "Like campaign";
    case "retweet":
      return "Repost campaign";
    case "bookmark":
      return "Bookmark campaign";
    case "follow":
      return "Follow campaign";
    default:
      return "Campaign";
  }
}

/** Detailed report shown on the Performance page for a single campaign. */
export type CampaignReport = {
  campaign: ManagedCampaign;
  duration: string;
  performance: {
    posts: number;
    impressions: number;
    reach: number;
    engagements: number;
    engagementRate: number;
    likes: number;
    retweets: number;
    repliesReceived: number;
    bookmarks: number;
    quotes: number;
  };
  byDay: { date: string; impressions: number; engagements: number; reach: number }[];
  byAccount: {
    handle: string;
    posts: number;
    actions: number;
    impressions: number;
    engagements: number;
    reach: number;
  }[];
  /** Actual posts / replies the campaign produced, best performing first. */
  content: {
    tweetId: string;
    handle: string;
    text: string;
    url: string;
    publishedAt: string | null;
    likes: number;
    retweets: number;
    replies: number;
    bookmarks: number;
    impressions: number;
    engagements: number;
  }[];
  sentiment: { positive: number; neutral: number; negative: number } | null;
  /**
   * What the campaign acted on. Engagement/like campaigns point at a tweet;
   * follow campaigns point at the accounts that were followed.
   */
  target: {
    tweetUrl: string | null;
    handles: string[];
  } | null;
};

/** "3 days 4 hrs" style duration between two ISO stamps. */
export function durationBetween(startIso: string, endIso: string | null) {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ${mins % 60} min`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ${hours % 24} hr${hours % 24 === 1 ? "" : "s"}`;
}
