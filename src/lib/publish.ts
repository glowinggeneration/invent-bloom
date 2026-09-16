import { z } from "zod";
import {
  DEFAULT_INTENSITY,
  DEFAULT_TONE,
  INTENSITY_MAX,
  INTENSITY_MIN,
  PUBLISH_TONES,
} from "./voice-controls";

export const PUBLISH_MODES = ["comment", "tweet", "both"] as const;
export type PublishMode = (typeof PUBLISH_MODES)[number];

// Hard cap for anything a linked account posts: must stay under 350
// characters counting hashtags and emojis.
export const TWEET_LIMIT = 349;

/** Length in visible characters (emoji count as one, not two). */
export function textLength(text: string) {
  return Array.from(text).length;
}

/** Truncates to TWEET_LIMIT counting emoji as single characters. */
export function clampTweet(text: string) {
  const chars = Array.from(text);
  return chars.length > TWEET_LIMIT
    ? `${chars
        .slice(0, TWEET_LIMIT - 1)
        .join("")
        .trimEnd()}…`
    : text;
}

export type XAccount = {
  id: string;
  handle: string;
  displayName: string;
  personaLabel: string;
  /** Short account description used by the workspace's audience grouping. */
  bio: string;
  /** True when X shows a verified check on this account's profile. */
  isVerified: boolean;
  isActive: boolean;
  hasToken: boolean;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  avatarColor: string | null;
  avatarCreditName: string | null;
  avatarCreditUrl: string | null;
  alwaysOn: boolean;
  lastActivityAt: string | null;
  /** True when X has suspended the account (checked by the username sync). */
  suspended: boolean;
  previousHandle: string | null;
  handleSyncedAt: string | null;
};

export type PublishActionRow = {
  id: string;
  accountHandle: string;
  actionType: "tweet" | "comment" | "like" | "retweet" | "bookmark" | "follow";
  status: "pending" | "success" | "failed";
  resultTweetId: string | null;
  error: string | null;
  content: string;
  personaName?: string;
};

export type PublishJobResult = {
  jobId: string;
  mode: PublishMode;
  actions: PublishActionRow[];
  succeeded: number;
  failed: number;
};

export type EngagementActionsSelection = {
  like: boolean;
  retweet: boolean;
  bookmark: boolean;
  follow: boolean;
};

/** Coerces a stored jsonb value into a complete engagement-actions selection. */
export function normalizeEngagementActions(value: unknown): EngagementActionsSelection {
  const v = (value ?? {}) as Record<string, unknown>;
  const read = (k: string) => v[k] === true;
  return {
    like: read("like"),
    retweet: read("retweet"),
    bookmark: read("bookmark"),
    follow: read("follow"),
  };
}

export const ENGAGEMENT_ACTION_LABELS: Record<keyof EngagementActionsSelection, string> = {
  like: "Like",
  retweet: "Retweet",
  bookmark: "Bookmark",
  follow: "Follow",
};

/** Who the selected engagement actions are applied to. */
export type EngagementTargetsSelection = {
  author: boolean;
  peer: boolean;
  watchlist: boolean;
};

/**
 * Safe defaults: optional engagement may apply only to the explicitly supplied
 * target. Peer and watchlist fan-out are never enabled implicitly.
 */
export const DEFAULT_ENGAGEMENT_TARGETS: EngagementTargetsSelection = {
  author: true,
  peer: false,
  watchlist: false,
};

export const ENGAGEMENT_TARGET_LABELS: Record<keyof EngagementTargetsSelection, string> = {
  author: "Target author",
  peer: "Peer accounts",
  watchlist: "Watchlist",
};

/** Coerces a stored jsonb value into a complete engagement-targets selection. */
export function normalizeEngagementTargets(value: unknown): EngagementTargetsSelection {
  const v = (value ?? null) as Record<string, unknown> | null;
  if (!v || typeof v !== "object" || Object.keys(v).length === 0) {
    return { ...DEFAULT_ENGAGEMENT_TARGETS };
  }
  return {
    author: v["author"] === true,
    peer: v["peer"] === true,
    watchlist: v["watchlist"] === true,
  };
}

export type PublishJobSummary = {
  id: string;
  mode: PublishMode;
  tweetText: string;
  commentText: string;
  targetTweetUrl: string | null;
  objectiveMode: boolean;
  objectiveText: string;
  status: string;
  createdAt: string;
  engagementActions: EngagementActionsSelection;
  engagementTargets: EngagementTargetsSelection;
  succeeded: number;
  failed: number;
};

export type CampaignActionRow = {
  id: string;
  handle: string;
  actionType: string;
  status: string;
  content: string;
  tweetId: string | null;
  url: string | null;
  error: string | null;
  createdAt: string;
};

export type CampaignDetail = {
  id: string;
  mode: PublishMode;
  tweetText: string;
  commentText: string;
  targetTweetUrl: string | null;
  objectiveMode: boolean;
  objectiveText: string;
  createdAt: string;
  engagementActions: EngagementActionsSelection;
  engagementTargets: EngagementTargetsSelection;
  actions: CampaignActionRow[];
};

export const accountInputSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .transform((h) => h.replace(/^@/, "")),
  displayName: z.string().trim().max(80).default(""),
  personaLabel: z.string().trim().max(80).default(""),
  authToken: z.string().trim().max(4000).nullable().optional(),
});

const rawPublishInputSchema = z.object({
  mode: z.enum(PUBLISH_MODES),
  name: z.string().trim().max(80).default(""),
  /** Client-generated once per submit attempt; resent unchanged on retry so a
   * duplicate submission returns the original result instead of posting twice. */
  idempotencyKey: z.string().trim().max(100).default(""),
  accountIds: z.array(z.string().uuid()).min(1).max(500),
  tweetText: z.string().trim().max(1000).default(""),
  commentText: z.string().trim().max(1000).default(""),
  briefing: z.string().trim().max(800).default(""),
  targetTweetUrl: z.string().trim().max(500).default(""),
  linkUrl: z.string().trim().max(500).default(""),
  imageUrls: z.array(z.string().trim().max(2000)).max(4).default([]),
  likeTarget: z.boolean().default(false),
  varyByPersona: z.boolean().default(true),
  // 0 = queue now with safe pacing; otherwise distribute across N hours.
  spreadHours: z.number().int().min(0).max(48).default(0),
  // Optional explicit campaign start; queue times are offset from this moment.
  startAt: z.string().trim().max(40).default(""),
  objectiveMode: z.boolean().default(false),
  tone: z.enum(PUBLISH_TONES).default(DEFAULT_TONE),
  intensity: z.number().int().min(INTENSITY_MIN).max(INTENSITY_MAX).default(DEFAULT_INTENSITY),
  actions: z
    .object({
      like: z.boolean().default(false),
      retweet: z.boolean().default(false),
      bookmark: z.boolean().default(false),
      follow: z.boolean().default(false),
    })
    .default({ like: false, retweet: false, bookmark: false, follow: false }),
  targets: z
    .object({
      author: z.boolean().default(true),
      peer: z.boolean().default(false),
      watchlist: z.boolean().default(false),
    })
    .default({ author: true, peer: false, watchlist: false }),
  variations: z
    .array(
      z.object({
        accountId: z.string().uuid(),
        handle: z.string(),
        personaId: z.string().default(""),
        personaName: z.string().default(""),
        tweetText: z
          .string()
          .refine((v) => textLength(v) <= TWEET_LIMIT)
          .default(""),
        commentText: z
          .string()
          .refine((v) => textLength(v) <= TWEET_LIMIT)
          .default(""),
      }),
    )
    .max(100)
    .default([]),
});

/**
 * Normalises legacy clients before the policy checks run. Older UI components
 * may still send peer-engagement flags, or only preview a sample of a large
 * original-post batch. Those values must not reactivate retired behaviour.
 */
export const publishInputSchema = rawPublishInputSchema
  .transform((v) => {
    const replyMode = v.mode !== "tweet";
    const accountIds = replyMode ? v.accountIds.slice(0, 1) : v.accountIds;
    const completeVariationSet =
      v.variations.length > 0 &&
      accountIds.every((id) => v.variations.some((variation) => variation.accountId === id));
    const variations = completeVariationSet
      ? v.variations.filter((variation) => accountIds.includes(variation.accountId))
      : [];

    return {
      ...v,
      accountIds,
      variations,
      likeTarget: false,
      actions: {
        like: false,
        // A single reviewed response may explicitly repost its supplied target;
        // original-post batches never self-amplify through peer reposts.
        retweet: replyMode ? v.actions.retweet : false,
        bookmark: false,
        follow: false,
      },
      targets: {
        author: replyMode,
        peer: false,
        watchlist: false,
      },
    };
  })
  .refine((v) => v.objectiveMode || textLength(v.tweetText) <= TWEET_LIMIT, {
    message: `Tweet text must be ${TWEET_LIMIT} characters or fewer.`,
    path: ["tweetText"],
  })
  .refine((v) => v.objectiveMode || textLength(v.commentText) <= TWEET_LIMIT, {
    message: `Comment text must be ${TWEET_LIMIT} characters or fewer.`,
    path: ["commentText"],
  })
  .refine((v) => v.mode === "comment" || v.tweetText.length > 0, {
    message: "Tweet text is required for this mode.",
    path: ["tweetText"],
  })
  .refine((v) => v.mode === "tweet" || v.targetTweetUrl.length > 0, {
    message: "A target tweet URL is required for this mode.",
    path: ["targetTweetUrl"],
  })
  .refine((v) => v.mode === "tweet" || v.commentText.length > 0, {
    message: "Comment text is required for this mode.",
    path: ["commentText"],
  })
  .refine((v) => v.mode === "tweet" || v.accountIds.length === 1, {
    message: "Reply campaigns use one linked account per target post.",
    path: ["accountIds"],
  })
  .refine((v) => !v.actions.like && !v.likeTarget, {
    message: "Automated Likes are disabled.",
    path: ["actions", "like"],
  })
  .refine((v) => !v.actions.bookmark, {
    message: "Automated Bookmarks are disabled in campaign execution.",
    path: ["actions", "bookmark"],
  })
  .refine((v) => !v.actions.follow, {
    message:
      "Automated proactive following is disabled. Follow decisions must be made manually on X.",
    path: ["actions", "follow"],
  })
  .refine((v) => !v.targets.peer && !v.targets.watchlist, {
    message: "Automatic peer/watchlist engagement is disabled.",
    path: ["targets"],
  })
  .refine((v) => v.accountIds.length === 1 || !v.targets.author || !v.actions.retweet, {
    message: "Multiple linked accounts cannot coordinate reposts on the same target post.",
    path: ["accountIds"],
  });

export function modeLabel(mode: PublishMode) {
  if (mode === "comment") return "Comment on a tweet";
  if (mode === "tweet") return "Post a tweet";
  return "Comment + post";
}

export function appendLink(text: string, link: string) {
  if (!link) return text;
  return text.includes(link) ? text : `${text} ${link}`.trim();
}
