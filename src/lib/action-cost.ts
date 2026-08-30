// Current write-cost model for the twitterapi.io V2 endpoints used by this project.
// Source endpoints are declared in twitterapi.server.ts. Provider rates were
// verified against docs.twitterapi.io on 17 Aug 2026.
//
// twitterapi.io denominates the wallet at 100,000 credits = US$1.
// ZAR values are a planning conversion only and use the 16 Aug 2026 USD/ZAR
// reference rate. The USD/credit figures remain the source of truth.

export const USD_TO_ZAR = 16.1879;
export const FX_AS_OF = "2026-08-16";
export const CREDITS_PER_USD = 100_000;
export const PRICING_AS_OF = "2026-08-17";

export type ActionKind = "like" | "retweet" | "bookmark" | "follow" | "comment" | "post" | "media";

export type ActionPricing = {
  kind: ActionKind;
  label: string;
  endpoint: string;
  usd: number;
  credits: number;
  automatedCampaignUse: "enabled" | "reviewed" | "disabled";
  note?: string;
};

const row = (
  kind: ActionKind,
  label: string,
  endpoint: string,
  usd: number,
  automatedCampaignUse: ActionPricing["automatedCampaignUse"],
  note?: string,
): ActionPricing => ({
  kind,
  label,
  endpoint,
  usd,
  credits: Math.round(usd * CREDITS_PER_USD),
  automatedCampaignUse,
  ...(note ? { note } : {}),
});

export const ACTION_PRICING: Record<ActionKind, ActionPricing> = {
  post: row(
    "post",
    "Post",
    "/twitter/create_tweet_v2",
    0.003,
    "enabled",
    "One text-only original post. Media upload is charged separately.",
  ),
  comment: row(
    "comment",
    "Reply",
    "/twitter/create_tweet_v2",
    0.003,
    "reviewed",
    "One operator-reviewed reply to a specific conversation.",
  ),
  like: row(
    "like",
    "Like",
    "/twitter/like_tweet_v2",
    0.002,
    "disabled",
    "Shown for provider-cost transparency; automated campaign Likes are disabled.",
  ),
  retweet: row(
    "retweet",
    "Repost",
    "/twitter/retweet_tweet_v2",
    0.002,
    "disabled",
    "Shown for provider-cost transparency; fleet-wide amplification is disabled.",
  ),
  bookmark: row(
    "bookmark",
    "Bookmark",
    "/twitter/bookmark_tweet_v2",
    0.002,
    "disabled",
    "Shown for provider-cost transparency; automated campaign Bookmarks are disabled.",
  ),
  follow: row(
    "follow",
    "Follow",
    "/twitter/follow_user_v2",
    0.002,
    "disabled",
    "Shown for provider-cost transparency; automated proactive Follows are disabled.",
  ),
  media: row(
    "media",
    "Media upload",
    "/twitter/upload_media_v2",
    0.003,
    "reviewed",
    "Added once per uploaded media file before the post/reply call.",
  ),
};

export const ACTION_LABELS: Record<ActionKind, string> = Object.fromEntries(
  Object.values(ACTION_PRICING).map((item) => [item.kind, item.label]),
) as Record<ActionKind, string>;

export const ACTION_KINDS: ActionKind[] = [
  "post",
  "comment",
  "retweet",
  "like",
  "bookmark",
  "follow",
  "media",
];

export function creditsPerAction(kind: ActionKind): number {
  return ACTION_PRICING[kind].credits;
}

/** How many complete actions of one type the current provider balance can fund. */
export function actionsRemaining(
  credits: number | null | undefined,
  kind: ActionKind = "post",
): number {
  if (credits == null || !Number.isFinite(credits) || credits <= 0) return 0;
  return Math.floor(credits / creditsPerAction(kind));
}

export function costUsd(kind: ActionKind): number {
  return ACTION_PRICING[kind].usd;
}

export function costZar(kind: ActionKind): number {
  return costUsd(kind) * USD_TO_ZAR;
}

export function combinedCostZar(kinds: ActionKind[] = ACTION_KINDS): number {
  return kinds.reduce((sum, kind) => sum + costZar(kind), 0);
}

const randFmt = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatZar(value: number): string {
  return randFmt.format(value);
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(3)}`;
}
