import type { BrandMention } from "./brand-mentions.functions";
import type { ManagedCampaign } from "./campaign-manager";
import type { OfficialPost } from "./overview.functions";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "./notification-preferences";

/**
 * In-app alerts stay decision-focused: fresh official posts, current campaign
 * completion and meaningful negative attention. They are not another copy of
 * the full activity feeds.
 */
export type NotificationKind = "official" | "campaign" | "mention";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string;
  href: "/overview" | "/campaign-manager" | "/mentions";
  severity: "critical" | "action" | "info";
  sourceUrl?: string;
};

const READ_KEY = "commsiq.notifications.read.v2";
const LEGACY_READ_KEY = "commsiq.notifications.read";
const OFFICIAL_NOTIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function readKey(scope?: string | null) {
  const safe = String(scope || "default")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);
  return `${READ_KEY}.${safe}`;
}

export function readIds(scope?: string | null): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      window.localStorage.getItem(readKey(scope)) ?? window.localStorage.getItem(LEGACY_READ_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function saveReadIds(ids: string[], scope?: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(readKey(scope), JSON.stringify(ids.slice(-500)));
  } catch {
    /* storage full or blocked - notifications simply stay unread */
  }
}

export function isCriticalMention(mention: BrandMention): boolean {
  if (mention.sentiment !== "negative") return false;
  if (mention.sentimentScore <= -4) return true;
  const loud = mention.viewCount >= 2000 || mention.likeCount >= 30 || mention.isVerified;
  return mention.sentimentScore <= -2 && (loud || mention.replyToBrand);
}

export function isImportantNegativeMention(mention: BrandMention): boolean {
  if (mention.sentiment !== "negative") return false;
  if (isCriticalMention(mention)) return true;
  return (
    mention.sentimentScore <= -3 ||
    mention.replyToBrand ||
    mention.isVerified ||
    mention.viewCount >= 500 ||
    mention.likeCount >= 10
  );
}

function reachLine(mention: BrandMention): string {
  const bits: string[] = [];
  if (mention.viewCount > 0) bits.push(`${mention.viewCount.toLocaleString()} views`);
  if (mention.likeCount > 0) bits.push(`${mention.likeCount.toLocaleString()} likes`);
  if (mention.isVerified) bits.push("verified account");
  return bits.length ? ` It has already reached ${bits.join(", ")}.` : "";
}

function officialBody(post: OfficialPost) {
  const metrics: string[] = [];
  if (post.impressions > 0) metrics.push(`${post.impressions.toLocaleString()} views`);
  if (post.likes > 0) metrics.push(`${post.likes.toLocaleString()} likes`);
  if (post.retweets > 0) metrics.push(`${post.retweets.toLocaleString()} reposts`);
  const performance = metrics.length ? ` Current activity: ${metrics.join(", ")}.` : "";
  return `Review the fresh official post and decide whether relevant authorised accounts should prepare distinct amplification content.${performance}`;
}

function isFreshOfficialPost(post: OfficialPost, now = Date.now()) {
  if (!post.postedAt) return false;
  const at = Date.parse(post.postedAt);
  if (!Number.isFinite(at)) return false;
  const age = now - at;
  return age >= 0 && age <= OFFICIAL_NOTIFICATION_MAX_AGE_MS;
}

export function buildNotifications(input: {
  campaigns: ManagedCampaign[];
  mentions: BrandMention[];
  officialPosts?: OfficialPost[];
  preferences?: NotificationPreferences;
}): AppNotification[] {
  const out: AppNotification[] = [];
  const preferences = input.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;

  if (preferences.officialPosts) {
    for (const post of input.officialPosts ?? []) {
      if (!isFreshOfficialPost(post)) continue;
      out.push({
        id: `official:${post.tweetId}`,
        kind: "official",
        title: `New official post from ${post.name}`,
        body: officialBody(post),
        at: post.postedAt!,
        href: "/overview",
        severity: "action",
        sourceUrl: post.url,
      });
    }
  }

  if (preferences.campaignCompletions) {
    for (const campaign of input.campaigns) {
      if (campaign.status !== "completed" || !campaign.completedAt) continue;
      out.push({
        id: `campaign:${campaign.key}:${campaign.completedAt}`,
        kind: "campaign",
        title: `${campaign.name} completed`,
        body:
          campaign.planned > 0
            ? `${campaign.completed} of ${campaign.planned} planned actions completed${campaign.failed ? `, with ${campaign.failed} failed` : ""}. Open Campaigns for proof and measured performance.`
            : "The campaign is complete. Open Campaigns to review its proof and measured performance.",
        at: campaign.completedAt,
        href: "/campaign-manager",
        severity: "info",
      });
    }
  }

  if (preferences.negativeMentions !== "off") {
    for (const mention of input.mentions) {
      const notify =
        preferences.negativeMentions === "important"
          ? isImportantNegativeMention(mention)
          : isCriticalMention(mention);
      if (!notify) continue;
      const who = mention.authorName || `@${mention.authorHandle}`;
      out.push({
        id: `mention:${mention.id}`,
        kind: "mention",
        title:
          preferences.negativeMentions === "important" && !isCriticalMention(mention)
            ? `Important negative post from ${who}`
            : `Damaging post from ${who}`,
        body: `${mention.sentimentReason || "The post criticises the federation."}${reachLine(mention)}`,
        at: mention.createdAt ?? new Date().toISOString(),
        href: "/mentions",
        severity: "critical",
        sourceUrl: mention.url,
      });
    }
  }

  const rank = { critical: 0, action: 1, info: 2 } as const;
  return out.sort((a, b) => {
    if (a.severity !== b.severity) return rank[a.severity] - rank[b.severity];
    return new Date(b.at).getTime() - new Date(a.at).getTime();
  });
}
