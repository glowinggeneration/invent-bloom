import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { containsChineseScript } from "./content-language";

export type UnifiedMentionSentiment = "positive" | "neutral" | "negative";
export type UnifiedMentionKind = "x" | "social" | "news";

export type UnifiedMention = {
  id: string;
  kind: UnifiedMentionKind;
  source: string;
  platform: string;
  title: string | null;
  content: string;
  url: string;
  publishedAt: string | null;
  authorName: string | null;
  authorHandle: string | null;
  authorAvatar: string | null;
  thumbnailUrl: string | null;
  sentiment: UnifiedMentionSentiment;
  sentimentScore: number;
  sentimentReason: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  isVerified: boolean;
  isDirectReply: boolean;
  matchedKeywords: string[];
};

export type UnifiedMentionFeed = {
  mentions: UnifiedMention[];
  counts: {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    directReplies: number;
    bySource: Record<string, number>;
  };
  generatedAt: string;
  error: string | null;
};

type XRow = {
  tweet_id: string;
  text: string | null;
  author_handle: string | null;
  author_name: string | null;
  author_verified: boolean | null;
  url: string | null;
  posted_at: string | null;
  like_count: number | null;
  view_count: number | null;
  sentiment: string | null;
  sentiment_score: number | null;
  sentiment_reason: string | null;
  reply_to_brand: boolean | null;
  source: string | null;
  matched_keyword: string | null;
};

type SocialRow = {
  id: string;
  platform: string | null;
  source_label: string | null;
  author_name: string | null;
  author_handle: string | null;
  author_avatar: string | null;
  title: string | null;
  content: string | null;
  url: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  matched_keywords: string[] | null;
  sentiment: string | null;
  sentiment_score: number | null;
  sentiment_reason: string | null;
};

type NewsRow = {
  link: string;
  title: string | null;
  description: string | null;
  pub_date: string | null;
  source_id: string | null;
  image_url: string | null;
  provider: string | null;
  matched_query: string | null;
};

function sentiment(value: string | null | undefined): UnifiedMentionSentiment {
  return value === "positive" || value === "negative" ? value : "neutral";
}

function timestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function countFeed(mentions: UnifiedMention[]): UnifiedMentionFeed["counts"] {
  const counts: UnifiedMentionFeed["counts"] = {
    total: mentions.length,
    positive: 0,
    neutral: 0,
    negative: 0,
    directReplies: 0,
    bySource: {},
  };
  for (const item of mentions) {
    counts[item.sentiment] += 1;
    if (item.isDirectReply) counts.directReplies += 1;
    counts.bySource[item.source] = (counts.bySource[item.source] ?? 0) + 1;
  }
  return counts;
}

/**
 * One read contract for the Mentions surface.
 *
 * Collection remains source-specific, but the UI no longer needs to know
 * which table a public mention came from. X history, Apify social results and
 * press coverage are normalised here, sorted together and returned with one
 * source/sentiment count model.
 */
export const listUnifiedMentions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).default(200),
        sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
        source: z.string().trim().min(1).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<UnifiedMentionFeed> => {
    const perSource = Math.min(Math.max(data.limit, 50), 300);

    const [xResult, socialResult, newsResult] = await Promise.all([
      context.supabase
        .from("x_mentions")
        .select(
          "tweet_id, text, author_handle, author_name, author_verified, url, posted_at, like_count, view_count, sentiment, sentiment_score, sentiment_reason, reply_to_brand, source, matched_keyword",
        )
        .order("posted_at", { ascending: false, nullsFirst: false })
        .limit(perSource),
      context.supabase
        .from("apify_mentions")
        .select(
          "id, platform, source_label, author_name, author_handle, author_avatar, title, content, url, thumbnail_url, published_at, views, likes, comments, shares, matched_keywords, sentiment, sentiment_score, sentiment_reason",
        )
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(perSource),
      context.supabase
        .from("news_articles")
        .select("link, title, description, pub_date, source_id, image_url, provider, matched_query")
        .order("pub_date", { ascending: false, nullsFirst: false })
        .limit(perSource),
    ]);

    const errors = [xResult.error, socialResult.error, newsResult.error].filter(Boolean);
    const items: UnifiedMention[] = [];

    for (const row of (xResult.data ?? []) as XRow[]) {
      const content = String(row.text ?? "").trim();
      if (!content || containsChineseScript(content)) continue;
      items.push({
        id: `x:${row.tweet_id}`,
        kind: "x",
        source: row.source === "keyword" ? "Topic matches" : "X",
        platform: "X",
        title: null,
        content,
        url: row.url ?? "",
        publishedAt: row.posted_at,
        authorName: row.author_name,
        authorHandle: row.author_handle,
        authorAvatar: null,
        thumbnailUrl: null,
        sentiment: sentiment(row.sentiment),
        sentimentScore: Number(row.sentiment_score ?? 0),
        sentimentReason: row.sentiment_reason,
        views: Number(row.view_count ?? 0),
        likes: Number(row.like_count ?? 0),
        comments: 0,
        shares: 0,
        isVerified: Boolean(row.author_verified),
        isDirectReply: Boolean(row.reply_to_brand),
        matchedKeywords: row.matched_keyword ? [row.matched_keyword] : [],
      });
    }

    for (const row of (socialResult.data ?? []) as SocialRow[]) {
      const content = String(row.content ?? row.title ?? "").trim();
      if (!content || containsChineseScript(row.title, row.content)) continue;
      items.push({
        id: `social:${row.id}`,
        kind: "social",
        source: row.source_label || row.platform || "Social",
        platform: row.platform || row.source_label || "Social",
        title: row.title,
        content,
        url: row.url ?? "",
        publishedAt: row.published_at,
        authorName: row.author_name,
        authorHandle: row.author_handle,
        authorAvatar: row.author_avatar,
        thumbnailUrl: row.thumbnail_url,
        sentiment: sentiment(row.sentiment),
        sentimentScore: Number(row.sentiment_score ?? 0),
        sentimentReason: row.sentiment_reason,
        views: Number(row.views ?? 0),
        likes: Number(row.likes ?? 0),
        comments: Number(row.comments ?? 0),
        shares: Number(row.shares ?? 0),
        isVerified: false,
        isDirectReply: false,
        matchedKeywords: row.matched_keywords ?? [],
      });
    }

    for (const row of (newsResult.data ?? []) as NewsRow[]) {
      const content = String(row.description ?? row.title ?? "").trim();
      if (!content || containsChineseScript(row.title, row.description)) continue;
      items.push({
        id: `news:${row.link}`,
        kind: "news",
        source: row.provider || row.source_id || "News",
        platform: "News",
        title: row.title,
        content,
        url: row.link,
        publishedAt: row.pub_date,
        authorName: row.source_id,
        authorHandle: null,
        authorAvatar: null,
        thumbnailUrl: row.image_url,
        // Stored press rows do not persist the scored result yet. Keep the
        // read contract stable and neutral rather than manufacturing a score.
        sentiment: "neutral",
        sentimentScore: 0,
        sentimentReason: null,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        isVerified: false,
        isDirectReply: false,
        matchedKeywords: row.matched_query ? [row.matched_query] : [],
      });
    }

    let filtered = items;
    if (data.sentiment) filtered = filtered.filter((item) => item.sentiment === data.sentiment);
    if (data.source) {
      const wanted = data.source.toLowerCase();
      filtered = filtered.filter(
        (item) => item.source.toLowerCase() === wanted || item.platform.toLowerCase() === wanted,
      );
    }

    filtered.sort((a, b) => timestamp(b.publishedAt) - timestamp(a.publishedAt));
    filtered = filtered.slice(0, data.limit);

    return {
      mentions: filtered,
      counts: countFeed(filtered),
      generatedAt: new Date().toISOString(),
      error: errors.length ? "One or more listening sources are temporarily unavailable." : null,
    };
  });
