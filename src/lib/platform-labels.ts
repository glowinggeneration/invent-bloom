/**
 * Display labels and status shape for the platforms SMAIT already
 * tracks (X plus the connected social/news monitoring feeds). The
 * data layer keeps `platform` as a free-form string rather than a fixed
 * union, so these helpers accept any string and fall back to a
 * capitalised label for anything not in the known set.
 */

export const KNOWN_PLATFORMS = [
  "x",
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "linkedin",
  "reddit",
  "news",
] as const;

export type KnownPlatform = (typeof KNOWN_PLATFORMS)[number];

const LABELS: Record<KnownPlatform, string> = {
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  news: "News",
};

export function platformLabel(platform: string): string {
  const known = LABELS[platform as KnownPlatform];
  if (known) return known;
  return platform.length ? platform[0]!.toUpperCase() + platform.slice(1) : "Unknown";
}

export type SourceStatus = {
  platform: string;
  configured: boolean;
  error?: string | null;
  count: number;
};
