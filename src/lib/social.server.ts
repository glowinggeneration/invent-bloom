/**
 * Social listening sweep. Reddit, Mastodon, YouTube, Bluesky and any Meta feed
 * slots are all RSS/Atom, all keyless, and all fetched here on the server —
 * Reddit throttles anonymous browser traffic and none of the feeds are
 * CORS-accessible.
 *
 * Everything is normalized into the same article shape as press coverage, so a
 * social post and a news story dedupe against each other by headline and land
 * in one chronological mentions feed.
 */
import { normalizeTitle, type NewsArticle, type NewsProvider } from "./news";
import {
  BLUESKY_HANDLES,
  MASTODON_TAGS,
  META_FEEDS,
  REDDIT_QUERIES,
  REDDIT_SUBREDDITS,
  REDDIT_SUBREDDIT_QUERY,
  SOCIAL_USER_AGENT,
  YOUTUBE_CHANNELS,
  blueskyProfileUrl,
  mastodonTagUrl,
  redditSearchUrl,
  redditSubredditUrl,
  youtubeChannelUrl,
} from "./social-sources";

/** Most items any single feed may contribute to one sweep. */
const MAX_PER_FEED = 12;

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#8217;/g, "’")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function tagText(block: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return match ? clean(decodeEntities(match[1] ?? "")) : "";
}

/** Atom puts the URL on an attribute; RSS puts it in the element body. */
function itemLink(block: string): string {
  const rss = tagText(block, "link");
  if (rss && /^https?:\/\//i.test(rss)) return rss;
  const alternate =
    /<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i.exec(block)?.[1] ??
    /<link[^>]+href=["']([^"']+)["']/i.exec(block)?.[1] ??
    "";
  return clean(decodeEntities(alternate));
}

function itemDate(block: string): string | null {
  const raw = tagText(block, "pubDate") || tagText(block, "published") || tagText(block, "updated");
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** A thumbnail, when the feed happens to carry one (YouTube and some Meta feeds do). */
function itemImage(block: string): string | null {
  const url =
    /<media:thumbnail[^>]+url=["']([^"']+)["']/i.exec(block)?.[1] ??
    /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i.exec(block)?.[1] ??
    /<img[^>]+src=["']([^"']+)["']/i.exec(decodeEntities(block))?.[1] ??
    "";
  return /^https?:\/\//i.test(url) ? url : null;
}

/**
 * Reads one RSS or Atom feed into articles. A failing or empty feed throws so
 * the caller can skip it for the cycle without disturbing the rest.
 */
export async function fetchRss(
  feedUrl: string,
  provider: NewsProvider,
  matchedQuery: string,
  fallbackSource: string,
): Promise<NewsArticle[]> {
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent": SOCIAL_USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}`);

  const xml = await res.text();
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];

  return blocks
    .slice(0, MAX_PER_FEED)
    .map((block): NewsArticle | null => {
      const link = itemLink(block);
      if (!link) return null;

      const body =
        tagText(block, "description") || tagText(block, "summary") || tagText(block, "content");
      // Mastodon posts carry no title at all — the post's own opening line is
      // the headline, and it is also what the dedupe key is built from.
      const title =
        tagText(block, "title") ||
        body.split(/(?<=[.!?])\s/)[0]?.slice(0, 160) ||
        body.slice(0, 160);
      if (!title) return null;

      // Fediverse and Bluesky links embed the author: https://host/@user/123
      const handle = /https?:\/\/[^/]+\/(@[^/]+)/.exec(link)?.[1] ?? "";
      const author =
        tagText(block, "dc:creator") ||
        tagText(block, "name") ||
        tagText(block, "author") ||
        handle ||
        fallbackSource;

      return {
        link,
        title,
        description: body.slice(0, 600),
        pubDate: itemDate(block),
        sourceId: author || fallbackSource,
        imageUrl: itemImage(block),
        category: [],
        matchedQuery,
        source: "Social",
        provider,
        titleKey: normalizeTitle(title),
      };
    })
    .filter((a): a is NewsArticle => a !== null);
}

type Feed = {
  url: string;
  provider: NewsProvider;
  query: string;
  sourceName: string;
};

/** Every feed that is actually configured this cycle; dormant slots are skipped. */
export function activeSocialFeeds(): Feed[] {
  const feeds: Feed[] = [];

  for (const query of REDDIT_QUERIES) {
    feeds.push({ url: redditSearchUrl(query), provider: "Reddit", query, sourceName: "Reddit" });
  }
  for (const sub of REDDIT_SUBREDDITS) {
    feeds.push({
      url: redditSubredditUrl(sub, REDDIT_SUBREDDIT_QUERY),
      provider: "Reddit",
      query: `r/${sub}: ${REDDIT_SUBREDDIT_QUERY}`,
      sourceName: `r/${sub}`,
    });
  }
  for (const tag of MASTODON_TAGS) {
    feeds.push({
      url: mastodonTagUrl(tag),
      provider: "Mastodon",
      query: `#${tag}`,
      sourceName: "Mastodon",
    });
  }
  for (const channel of YOUTUBE_CHANNELS) {
    if (!channel.channelId.trim()) continue;
    feeds.push({
      url: youtubeChannelUrl(channel.channelId),
      provider: "YouTube",
      query: channel.name,
      sourceName: channel.name,
    });
  }
  for (const account of BLUESKY_HANDLES) {
    if (!account.handle.trim()) continue;
    feeds.push({
      url: blueskyProfileUrl(account.handle),
      provider: "Bluesky",
      query: account.name,
      sourceName: account.name,
    });
  }
  for (const slot of META_FEEDS) {
    if (!slot.feedUrl.trim()) continue;
    feeds.push({
      url: slot.feedUrl,
      provider: slot.platform,
      query: slot.sourceName,
      sourceName: slot.sourceName,
    });
  }

  return feeds;
}

/**
 * Runs every configured social feed. Failures are collected, never thrown: one
 * throttled Reddit query must not cost the whole sweep.
 */
export async function fetchSocialArticles(): Promise<{
  articles: NewsArticle[];
  failed: string[];
  byProvider: Record<string, number>;
}> {
  const feeds = activeSocialFeeds();
  const articles: NewsArticle[] = [];
  const failed: string[] = [];
  const byProvider: Record<string, number> = {};

  // Reddit throttles hard when its feeds are hit in parallel, so they are
  // walked one at a time with a pause between; other hosts run concurrently.
  // Reddit throttles by IP across queries, so only a rotating slice runs each
  // cycle; over a few cycles every query is still covered.
  const allReddit = feeds.filter((f) => f.provider === "Reddit");
  const slice = 3;
  const offset =
    allReddit.length === 0
      ? 0
      : (Math.floor(Date.now() / (25 * 60 * 1000)) * slice) % allReddit.length;
  const reddit = allReddit.length
    ? Array.from(
        { length: Math.min(slice, allReddit.length) },
        (_, i) => allReddit[(offset + i) % allReddit.length]!,
      )
    : [];
  const others = feeds.filter((f) => f.provider !== "Reddit");

  const attempt = async (feed: (typeof feeds)[number]) => {
    try {
      return { feed, items: await fetchRss(feed.url, feed.provider, feed.query, feed.sourceName) };
    } catch {
      return { feed, items: null };
    }
  };

  const othersDone = Promise.all(others.map(attempt));

  const redditResults: Awaited<ReturnType<typeof attempt>>[] = [];
  for (const feed of reddit) {
    redditResults.push(await attempt(feed));
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  const results = [...redditResults, ...(await othersDone)];

  for (const { feed, items } of results) {
    if (!items) {
      failed.push(`${feed.provider}: ${feed.query}`);
      continue;
    }
    articles.push(...items);
    byProvider[feed.provider] = (byProvider[feed.provider] ?? 0) + items.length;
  }

  return { articles, failed, byProvider };
}
