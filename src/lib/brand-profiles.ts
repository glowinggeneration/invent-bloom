export type BrandProfile = {
  handle: string;
  displayName: string;
  description: string;
  location: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  followers: number;
  following: number;
  tweetCount: number;
  mediaCount: number;
  favouritesCount: number;
  isVerified: boolean;
  profileCreatedAt: string | null;
  fetchedAt: string | null;
};

/** Compact follower counts, e.g. 67 888 -> "67.9K". */
export function formatFollowers(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
