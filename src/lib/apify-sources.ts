/**
 * Client+server-safe display helpers for the non-X collection sources.
 *
 * The accounts/queries watched, and the relevance/classification tests
 * applied to what comes back, live in apify-relevance.server.ts instead -
 * that logic now reads workspace_settings (via entity-config.server.ts),
 * which touches the service-role client and must never reach the browser
 * bundle. This file only has what social-profiles.tsx, social-mention-card.tsx
 * and brand-mentions.tsx actually import: types and formatting, no network
 * calls and no secrets.
 */

/** Every platform that can put an item in the mentions feed via Apify. */
export type ApifyPlatform =
  "facebook" | "tiktok" | "linkedin" | "threads" | "instagram" | "snapchat" | "youtube" | "news";

export type ApifyContentType =
  "post" | "video" | "short" | "story" | "article" | "group_post" | "reel";

/** One collection lane. Each maps to a single Apify actor call. */
export type ApifySourceKey =
  | "tiktok"
  | "facebook_search"
  | "facebook_pages"
  | "facebook_groups"
  | "instagram"
  | "instagram_stories"
  | "threads"
  | "linkedin"
  | "youtube"
  | "youtube_shorts"
  | "snapchat"
  | "google_news";

/**
 * The label shown in the Mentions source filter. Stored on the row so the
 * filter never has to re-derive it, and so Groups / Stories / Shorts read as
 * their own channel while still belonging to their parent platform.
 */
export function sourceLabel(platform: ApifyPlatform, contentType: ApifyContentType): string {
  if (platform === "facebook" && contentType === "group_post") return "Facebook Groups";
  if (platform === "instagram" && contentType === "story") return "Instagram Stories";
  if (platform === "youtube" && contentType === "short") return "YouTube Shorts";
  const names: Record<ApifyPlatform, string> = {
    facebook: "Facebook",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
    threads: "Threads",
    instagram: "Instagram",
    snapchat: "Snapchat",
    youtube: "YouTube",
    news: "News",
  };
  return names[platform];
}

/** Order the source filter lists platforms in, once each has data. */
export const APIFY_SOURCE_LABELS: string[] = [
  "Facebook",
  "Facebook Groups",
  "Instagram",
  "Instagram Stories",
  "TikTok",
  "Threads",
  "LinkedIn",
  "YouTube",
  "YouTube Shorts",
  "Snapchat",
  "News",
];

/** Compact metric label: 42300 -> 42.3K. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}K`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}
