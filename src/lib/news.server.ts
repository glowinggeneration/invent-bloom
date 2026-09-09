/**
 * News sweep. Runs server-side only — the NewsData key never reaches the
 * browser, and Google News RSS cannot be fetched from a browser at all (its
 * XML is not CORS-enabled).
 *
 * Two sources, one deduplicated store:
 *  - NewsData.io — structured JSON, images and snippets, 12-hour free delay.
 *  - Google News RSS — keyless and real-time, headline + source + date only.
 *
 * Cross-source deduplication is by normalized title, never by link: Google's
 * redirect tokens can never match NewsData's canonical URLs for the same story.
 */
import {
  GOOGLE_NEWS_LOCALE,
  GOOGLE_NEWS_QUERIES,
  GOOGLE_NEWS_WINDOWS,
  NEWS_QUERIES,
  NEWS_REQUEST,
  dedupeByStory,
  googleNewsUrl,
  isSameStory,
  normalizeTitle,
  type NewsArticle,
} from "./news";

type NewsDataResult = {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  source_id?: string;
  image_url?: string | null;
  category?: string[] | null;
};

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fetches one NewsData query's first page. Throws so the sweep can skip it. */
export async function fetchNewsQuery(query: string, apiKey: string): Promise<NewsArticle[]> {
  const url = new URL(NEWS_REQUEST.endpoint);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("q", query.slice(0, 100));
  url.searchParams.set("country", NEWS_REQUEST.country);
  url.searchParams.set("language", NEWS_REQUEST.language);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`NewsData ${res.status}`);

  const data = (await res.json()) as { status?: string; results?: NewsDataResult[] };
  const results = Array.isArray(data.results) ? data.results : [];

  return results
    .slice(0, NEWS_REQUEST.maxPerQuery)
    .map((r): NewsArticle | null => {
      const link = clean(r.link);
      const title = clean(r.title);
      if (!link || !title) return null;
      return {
        link,
        title,
        description: clean(r.description).slice(0, 600),
        pubDate: r.pubDate ? new Date(r.pubDate.replace(" ", "T") + "Z").toISOString() : null,
        sourceId: clean(r.source_id),
        imageUrl: clean(r.image_url) || null,
        category: Array.isArray(r.category) ? r.category.map(clean).filter(Boolean) : [],
        matchedQuery: query,
        source: "News",
        provider: "NewsData",
        titleKey: normalizeTitle(title),
      };
    })
    .filter((a): a is NewsArticle => a !== null);
}

/** Decodes the handful of XML entities RSS titles actually carry. */
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

/**
 * Fetches one Google News RSS query. The feed returns headline, redirect link,
 * date and publisher — no images or snippets, and no pagination.
 */
export async function fetchGoogleNewsQuery(query: string, window: string): Promise<NewsArticle[]> {
  const res = await fetch(googleNewsUrl(query, window), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SMAIT/1.0)" },
  });
  if (!res.ok) throw new Error(`Google News ${res.status}`);

  const xml = await res.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

  return blocks
    .slice(0, GOOGLE_NEWS_LOCALE.maxPerQuery)
    .map((block): NewsArticle | null => {
      const rawTitle = tagText(block, "title");
      // Google's redirect token, not the publisher URL — it resolves in the browser.
      const link = tagText(block, "link");
      const sourceId = tagText(block, "source");
      if (!rawTitle || !link) return null;

      // Titles arrive as "Headline - Publisher"; drop the publisher tail since
      // it is already shown as the source.
      const title = sourceId
        ? rawTitle
            .replace(
              new RegExp(
                `\\s+[-–—|]\\s*${sourceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
                "i",
              ),
              "",
            )
            .trim()
        : rawTitle;

      const rawDate = tagText(block, "pubDate");
      const parsed = rawDate ? new Date(rawDate) : null;

      return {
        link,
        title: title || rawTitle,
        description: "",
        pubDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
        sourceId,
        imageUrl: null,
        category: [],
        matchedQuery: query,
        source: "News",
        provider: "Google News",
        titleKey: normalizeTitle(title || rawTitle),
      };
    })
    .filter((a): a is NewsArticle => a !== null);
}

/** Pulls the lead image out of a publisher page, if it has one. */
function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    // JSON-LD article payloads: "image": "https://…" or "image": ["https://…"]
    /"image"\s*:\s*"(https?:\/\/[^"]+)"/i,
    /"image"\s*:\s*\[\s*"(https?:\/\/[^"]+)"/i,
    /"contentUrl"\s*:\s*"(https?:\/\/[^"]+)"/i,
    // Last resort: the first sizeable in-article image.
    /<article[\s>][\s\S]{0,4000}?<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpe?g|png|webp)[^"']*)["']/i,
  ];
  // Site furniture — logos, share buttons, sprites — is not a story image.
  const junk = /(logo|sprite|icon|avatar|placeholder|share|badge|favicon|blank)/i;
  for (const re of patterns) {
    const m = re.exec(html);
    const url = m?.[1]?.trim().replace(/&amp;/g, "&");
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (/\.svg($|\?)/i.test(url) || junk.test(url)) continue;
    return url;
  }
  return null;
}

/**
 * Resolves one story's lead image. Google News links are redirect tokens that
 * land on an interstitial, so the publisher URL is recovered from the page
 * before the image is read. Any failure just leaves the article image-less.
 */
async function fetchStoryImage(link: string): Promise<string | null> {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    Accept: "text/html,application/xhtml+xml",
  };
  const load = async (url: string) => {
    const res = await fetch(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    return { url: res.url, html: await res.text() };
  };
  try {
    const page = await load(link);
    if (!page) return null;

    const direct = extractOgImage(page.html);
    if (direct) return direct;

    // Google interstitial: follow the publisher link it embeds, once.
    if (/news\.google\.com/i.test(page.url) || /news\.google\.com/i.test(link)) {
      const target =
        /<a[^>]+href=["'](https?:\/\/(?!news\.google\.com|policies\.google|support\.google)[^"']+)["']/i.exec(
          page.html,
        )?.[1] ??
        /data-n-au=["'](https?:\/\/[^"']+)["']/i.exec(page.html)?.[1] ??
        null;
      if (!target) return null;
      const inner = await load(target);
      return inner ? extractOgImage(inner.html) : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Fills in lead images for articles that arrived without one, in small batches. */
export async function attachStoryImages(articles: NewsArticle[], max = 60): Promise<number> {
  const missing = articles.filter((a) => !a.imageUrl).slice(0, max);
  if (!missing.length) return 0;
  let filled = 0;
  // Batched so a sweep never opens dozens of publisher connections at once.
  for (let i = 0; i < missing.length; i += 8) {
    const batch = missing.slice(i, i + 8);
    const found = await Promise.all(batch.map((a) => fetchStoryImage(a.link)));
    batch.forEach((article, j) => {
      const url = found[j];
      if (url) {
        article.imageUrl = url;
        filled += 1;
      }
    });
  }
  return filled;
}

/**
 * Runs a full sweep across both sources, deduplicates by normalized title, and
 * stores what is new. A failing query is skipped for the cycle — the existing
 * feed is never blanked.
 */
export async function runNewsSweep(): Promise<{
  fetched: number;
  stored: number;
  newsdata: number;
  googleNews: number;
  social: Record<string, number>;
  duplicates: number;
  failedQueries: string[];
}> {
  const apiKey = process.env["NEWSDATA_API_KEY"];
  const failedQueries: string[] = [];
  const collected: NewsArticle[] = [];

  // NewsData first, so its richer record wins any title collision.
  if (apiKey) {
    for (const query of NEWS_QUERIES) {
      try {
        collected.push(...(await fetchNewsQuery(query, apiKey)));
      } catch {
        failedQueries.push(`NewsData: ${query}`);
      }
    }
  }

  for (const [index, query] of GOOGLE_NEWS_QUERIES.entries()) {
    const window = GOOGLE_NEWS_WINDOWS.byIndex[index] ?? GOOGLE_NEWS_WINDOWS.defaultWindow;
    try {
      collected.push(...(await fetchGoogleNewsQuery(query, window)));
    } catch {
      failedQueries.push(`Google News: ${query}`);
    }
  }

  // Social feeds share the same sweep and the same dedupe, so a story broken on
  // Reddit and reported by a wire appears once.
  const { fetchSocialArticles } = await import("./social.server");
  const {
    articles: socialArticles,
    failed: socialFailed,
    byProvider: social,
  } = await fetchSocialArticles();
  collected.push(...socialArticles);
  failedQueries.push(...socialFailed);

  const newsdata = collected.filter((a) => a.provider === "NewsData").length;
  const googleNews = collected.filter((a) => a.provider === "Google News").length;

  // Within this sweep: one row per link, then one row per story.
  const seenLinks = new Set<string>();
  const unique = collected.filter((a) => {
    if (seenLinks.has(a.link)) return false;
    seenLinks.add(a.link);
    return true;
  });

  const { kept, duplicates: withinSweep } = dedupeByStory(unique);
  const articles = kept;
  let duplicates = withinSweep;

  if (!articles.length) {
    return { fetched: 0, stored: 0, newsdata, googleNews, social, duplicates, failedQueries };
  }

  const { stored, duplicates: alreadyStored } = await storeArticles(articles);
  duplicates += alreadyStored;

  return {
    fetched: collected.length,
    stored,
    newsdata,
    googleNews,
    social,
    duplicates,
    failedQueries,
  };
}

/**
 * Shared storage step for every source. Drops stories already in the feed,
 * fills in missing lead images, and writes what is left. Links are unique, so
 * a re-seen item is ignored rather than duplicated.
 */
export async function storeArticles(
  input: NewsArticle[],
): Promise<{ stored: number; duplicates: number }> {
  if (!input.length) return { stored: 0, duplicates: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  // TODO(Phase 3): this is a shared background sweep, not a single request's
  // context - once multiple workspaces exist with independently-configured
  // keywords, this needs to run (and store) per-workspace instead of the
  // LEGACY_SINGLE_WORKSPACE_ID stopgap. See workspace.server.ts.
  const { LEGACY_SINGLE_WORKSPACE_ID } = await import("./workspace.server");

  // Compared over a recent window: the same event is only ever re-reported
  // within a few days.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await admin
    .from("news_articles")
    .select("title")
    .eq("workspace_id", LEGACY_SINGLE_WORKSPACE_ID)
    .gte("created_at", since)
    .limit(1000);
  const knownTitles = ((existing ?? []) as { title: string }[]).map((r) => r.title);

  let articles = input;
  let duplicates = 0;
  if (knownTitles.length) {
    const before = articles.length;
    articles = articles.filter((a) => !knownTitles.some((t) => isSameStory(t, a.title)));
    duplicates += before - articles.length;
  }
  if (!articles.length) return { stored: 0, duplicates };

  // Headline-only sources (Google News, most social feeds) get their lead
  // image pulled from the story page. Bounded per sweep.
  await attachStoryImages(articles);

  const rows = articles.map((a) => ({
    workspace_id: LEGACY_SINGLE_WORKSPACE_ID,
    link: a.link,
    title: a.title,
    description: a.description,
    pub_date: a.pubDate,
    source_id: a.sourceId,
    image_url: a.imageUrl,
    category: a.category,
    matched_query: a.matchedQuery,
    provider: a.provider,
    title_key: a.titleKey,
  }));

  const { error } = await admin
    .from("news_articles")
    .upsert(rows, { onConflict: "link", ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  // Backfill older items that are still without an image.
  const { data: bare } = await admin
    .from("news_articles")
    .select("link")
    .eq("workspace_id", LEGACY_SINGLE_WORKSPACE_ID)
    .is("image_url", null)
    .order("pub_date", { ascending: false, nullsFirst: false })
    .limit(40);
  const pending = ((bare ?? []) as { link: string }[]).map((r) => ({
    link: r.link,
    imageUrl: null as string | null,
  }));
  if (pending.length) {
    await attachStoryImages(pending as unknown as NewsArticle[], 40);

    for (const item of pending) {
      if (!item.imageUrl) continue;
      await admin.from("news_articles").update({ image_url: item.imageUrl }).eq("link", item.link);
    }
  }

  return { stored: rows.length, duplicates };
}

/**
 * Social-only sweep. Polls on its own faster timer than the press wires, which
 * are rate-limited by their provider quotas.
 */
export async function runSocialSweep(): Promise<{
  fetched: number;
  stored: number;
  byProvider: Record<string, number>;
  duplicates: number;
  failedQueries: string[];
}> {
  const { fetchSocialArticles } = await import("./social.server");
  const { articles, failed, byProvider } = await fetchSocialArticles();

  const seen = new Set<string>();
  const unique = articles.filter((a) => (seen.has(a.link) ? false : (seen.add(a.link), true)));
  const { kept, duplicates: withinSweep } = dedupeByStory(unique);
  const { stored, duplicates } = await storeArticles(kept);

  return {
    fetched: articles.length,
    stored,
    byProvider,
    duplicates: withinSweep + duplicates,
    failedQueries: failed,
  };
}
