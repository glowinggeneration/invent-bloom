import type { BrandProfile } from "./brand-profiles";

/** Maps brand_profiles rows to the client DTO, one card per handle. */
export function mapBrandRows(rows: any[]): BrandProfile[] {
  const byHandle = new Map<string, any>();
  for (const row of rows) {
    const key = String(row?.handle ?? "").toLowerCase();
    if (!key) continue;
    const existing = byHandle.get(key);
    const fresher =
      !existing ||
      new Date(row?.fetched_at ?? 0).getTime() > new Date(existing?.fetched_at ?? 0).getTime();
    if (fresher) byHandle.set(key, row);
  }
  return [...byHandle.values()].map((r) => ({
    handle: r.handle ?? "",
    displayName: r.display_name || r.handle || "",
    description: r.description ?? "",
    location: r.location ?? "",
    avatarUrl: r.avatar_url ?? null,
    bannerUrl: r.banner_url ?? null,
    followers: r.followers ?? 0,
    following: r.following ?? 0,
    tweetCount: r.tweet_count ?? 0,
    mediaCount: r.media_count ?? 0,
    favouritesCount: r.favourites_count ?? 0,
    isVerified: Boolean(r.is_verified),
    profileCreatedAt: r.profile_created_at ?? null,
    fetchedAt: r.fetched_at ?? null,
  }));
}
