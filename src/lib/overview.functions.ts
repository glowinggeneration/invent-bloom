/**
 * Server functions behind /overview.
 *
 * Reads are cheap (stored mentions); refreshing the intelligence layer and
 * reading the latest official post touch the X API, so they are separate
 * calls the page makes deliberately.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OverviewData, OverviewIntel, OverviewWindow } from "./overview";

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ window: z.enum(["24h", "7d", "30d"]).default("24h") })
      .default({ window: "24h" })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<OverviewData> => {
    const { buildOverview } = await import("./overview.server");
    return buildOverview(data.window as OverviewWindow);
  });

export const getOverviewIntel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ refresh: z.boolean().default(false) })
      .default({ refresh: false })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<OverviewIntel> => {
    const { getIntel } = await import("./overview.server");
    return getIntel(data.refresh);
  });

export type OfficialPost = {
  handle: string;
  name: string;
  avatarUrl: string | null;
  followers: number | null;
  tweetId: string;
  text: string;
  url: string;
  postedAt: string | null;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  impressions: number;
};

/** The newest post from each official account, with live public metrics. */
export const getOfficialPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ posts: OfficialPost[]; error: string | null }> => {
    const { BRAND_PROFILE_HANDLES } = await import("./brand-profiles");
    const { fetchLatestTweetIds, fetchTweetMetrics, fetchXProfile } =
      await import("./twitterapi.server");

    const posts: OfficialPost[] = [];
    let error: string | null = null;

    for (const handle of BRAND_PROFILE_HANDLES) {
      const [{ ids, error: idError }, { profile }] = await Promise.all([
        fetchLatestTweetIds(handle, 1, false),
        fetchXProfile(handle),
      ]);
      if (!ids.length) {
        error ??= idError;
        continue;
      }
      const { tweets, error: metricError } = await fetchTweetMetrics(ids);
      const tweet = tweets[0];
      if (!tweet) {
        error ??= metricError;
        continue;
      }
      posts.push({
        handle,
        name: profile?.displayName ?? tweet.authorName ?? handle,
        avatarUrl: profile?.avatarUrl ?? null,
        followers: profile?.followers ?? null,
        tweetId: tweet.tweetId,
        text: tweet.text,
        url: `https://x.com/${handle}/status/${tweet.tweetId}`,
        postedAt: tweet.createdAt,
        likes: tweet.likeCount,
        retweets: tweet.retweetCount,
        replies: tweet.replyCount,
        quotes: tweet.quoteCount,
        bookmarks: tweet.bookmarkCount,
        impressions: tweet.impressionCount,
      });
    }

    posts.sort((a, b) => {
      const av = a.postedAt ? Date.parse(a.postedAt) : 0;
      const bv = b.postedAt ? Date.parse(b.postedAt) : 0;
      return bv - av;
    });

    return { posts, error: posts.length ? null : error };
  });
