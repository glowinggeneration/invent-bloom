/**
 * Reads the multi-platform mentions collected through Apify, plus the official
 * page profiles shown above the feed. Collection itself is server-only; the
 * browser only ever reads stored rows.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ApifyContentType, ApifyPlatform } from "./apify-sources";
import { containsChineseScript } from "./content-language";

export type SocialMention = {
  id: string;
  platform: ApifyPlatform;
  contentType: ApifyContentType;
  sourceLabel: string;
  authorName: string | null;
  authorHandle: string | null;
  authorAvatar: string | null;
  title: string | null;
  content: string | null;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  entities: string[];
  matchedKeywords: string[];
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  sentimentReason: string | null;
};

export type SocialProfile = {
  platform: ApifyPlatform;
  handle: string;
  displayName: string | null;
  description: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  profileUrl: string;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  likesCount: number | null;
  isVerified: boolean;
  fetchedAt: string;
};

export type SourceStatus = {
  key: string;
  label: string;
  status: string;
  message: string | null;
  lastRunAt: string | null;
  storedLastRun: number;
};

/** Newest-first public conversation from every connected platform. */
export const listSocialMentions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(300).default(120) }).parse(input ?? {}),
  )
  .handler(
    async ({ data, context }): Promise<{ mentions: SocialMention[]; error: string | null }> => {
      const { data: rows, error } = await context.supabase
        .from("apify_mentions")
        .select(
          "id, platform, content_type, source_label, author_name, author_handle, author_avatar, title, content, url, thumbnail_url, published_at, views, likes, comments, shares, entities, matched_keywords, sentiment, sentiment_score, sentiment_reason",
        )
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(data.limit);

      if (error) return { mentions: [], error: "Social listening is unavailable right now." };

      const mentions = ((rows ?? []) as Record<string, any>[])
        .filter((r) => !containsChineseScript(r["title"], r["content"]))
        .map((r): SocialMention => ({
          id: String(r["id"]),
          platform: r["platform"],
          contentType: r["content_type"],
          sourceLabel: r["source_label"],
          authorName: r["author_name"],
          authorHandle: r["author_handle"],
          authorAvatar: r["author_avatar"],
          title: r["title"],
          content: r["content"],
          url: r["url"],
          thumbnailUrl: r["thumbnail_url"],
          publishedAt: r["published_at"],
          views: r["views"],
          likes: r["likes"],
          comments: r["comments"],
          shares: r["shares"],
          entities: r["entities"] ?? [],
          matchedKeywords: r["matched_keywords"] ?? [],
          sentiment: r["sentiment"] ?? "neutral",
          sentimentScore: Number(r["sentiment_score"] ?? 0),
          sentimentReason: r["sentiment_reason"],
        }));

      return { mentions, error: null };
    },
  );

/** The federation's own public pages, for the strip above the feed. */
export const listSocialProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SocialProfile[]> => {
    const { data: rows } = await context.supabase
      .from("apify_profiles")
      .select(
        "platform, handle, display_name, description, avatar_url, banner_url, profile_url, followers, following, posts_count, likes_count, is_verified, fetched_at",
      );

    return ((rows ?? []) as Record<string, any>[]).map((r) => ({
      platform: r["platform"],
      handle: r["handle"],
      displayName: r["display_name"],
      description: r["description"],
      avatarUrl: r["avatar_url"],
      bannerUrl: r["banner_url"],
      profileUrl: r["profile_url"],
      followers: r["followers"],
      following: r["following"],
      postsCount: r["posts_count"],
      likesCount: r["likes_count"],
      isVerified: Boolean(r["is_verified"]),
      fetchedAt: r["fetched_at"],
    }));
  });

/** Which platforms are actually returning data, for the source filter. */
export const listSourceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SourceStatus[]> => {
    const { data: rows } = await context.supabase
      .from("apify_source_status")
      .select("source_key, label, status, message, last_run_at, stored_last_run");

    return ((rows ?? []) as Record<string, any>[]).map((r) => ({
      key: r["source_key"],
      label: r["label"],
      status: r["status"],
      message: r["message"],
      lastRunAt: r["last_run_at"],
      storedLastRun: r["stored_last_run"] ?? 0,
    }));
  });

/** Runs a collection cycle on demand. Optionally limited to named lanes. */
export const refreshSocialMentions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sources: z.array(z.string()).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { runApifySweep } = await import("./apify-mentions.server");
    try {
      return await runApifySweep(data.sources);
    } catch (err) {
      console.error("Apify sweep failed", err);
      return { sources: [], stored: 0 };
    }
  });

/** Refreshes the official page profiles shown above the feed. */
export const refreshSocialProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { refreshApifyProfiles } = await import("./apify-mentions.server");
    try {
      return await refreshApifyProfiles();
    } catch (err) {
      console.error("Apify profile refresh failed", err);
      return { stored: 0, failed: [] as string[] };
    }
  });
