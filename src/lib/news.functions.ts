/**
 * Reads the stored news feed for the Mentions page. Neither news source is
 * ever called from the browser: NewsData needs a backend secret, and Google
 * News RSS is not CORS-accessible.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { containsChineseScript } from "./content-language";
import {
  dedupeByStory,
  isNewsRelevant,
  isSocialProvider,
  normalizeTitle,
  toProvider,
  type NewsArticle,
  type NewsSentiment,
} from "./news";
import {
  buildRelevancePattern,
  describeSubject,
  getWorkspaceSettings,
} from "./entity-config.server";

/** An article as the feed shows it: press record plus how the story reads. */
export type ScoredNewsArticle = NewsArticle & {
  sentiment: NewsSentiment;
  sentimentScore: number;
  sentimentReason: string;
};

/**
 * Reads each headline the way mentions are read: does this story help or hurt
 * the monitored subject. Falls back to neutral when the model is
 * unavailable, so the feed never blanks on an AI failure.
 */
async function classifyArticles(
  articles: NewsArticle[],
  subject: string,
): Promise<
  Map<string, { sentiment: NewsSentiment; score: number; reason: string; relevant: boolean }>
> {
  const out = new Map<
    string,
    { sentiment: NewsSentiment; score: number; reason: string; relevant: boolean }
  >();
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey || articles.length === 0) return out;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content: [
              `You judge how each news story reads FOR ${subject}.`,
              "negative: scandal, corruption, court cases, bans, losses, crises, criticism, grievances.",
              "positive: wins, qualification, investment, sponsorship, new facilities, praise, milestones.",
              "neutral: plain announcements with no clear upside or damage.",
              "Read sarcasm, irony, mocking praise and rhetorical criticism in context. Positive words used to ridicule the subject must be classified as negative, not positive.",
              "score: -5 (very damaging) to +5 (very good news). reason: one short plain-English sentence.",
              "relevant: true only when the story is really about the monitored subject.",
              'Return strict JSON: {"results":[{"id":string,"sentiment":"positive"|"negative"|"neutral","score":number,"reason":string,"relevant":boolean}]}',
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify(
              articles.map((a) => ({
                id: a.link,
                headline: a.title,
                summary: a.description.slice(0, 300),
                publisher: a.sourceId,
              })),
            ),
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) return out;
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as {
      results?: {
        id?: string;
        sentiment?: string;
        score?: number;
        reason?: string;
        relevant?: boolean;
      }[];
    };
    for (const r of parsed.results ?? []) {
      const id = String(r.id ?? "");
      if (!id) continue;
      const sentiment: NewsSentiment =
        r.sentiment === "positive" || r.sentiment === "negative" ? r.sentiment : "neutral";
      out.set(id, {
        sentiment,
        score: Number.isFinite(r.score)
          ? Number(r.score)
          : sentiment === "negative"
            ? -2
            : sentiment === "positive"
              ? 2
              : 0,
        reason: String(r.reason ?? "").trim(),
        relevant: r.relevant !== false,
      });
    }
  } catch {
    return out;
  }
  return out;
}

type Row = {
  link: string;
  title: string;
  description: string | null;
  pub_date: string | null;
  source_id: string | null;
  image_url: string | null;
  category: string[] | null;
  matched_query: string | null;
  provider: string | null;
  title_key: string | null;
};

/**
 * Newest-first press coverage across both sources, deduplicated by normalized
 * headline. The richer record wins a collision: an item with an image or a
 * snippet (NewsData) is preferred over a headline-only RSS item for the same
 * story, so the feed never shows one story twice.
 */
export const listNews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).default(30) }).parse(input ?? {}),
  )
  .handler(
    async ({ data, context }): Promise<{ articles: ScoredNewsArticle[]; error: string | null }> => {
      const { data: rows, error } = await context.supabase
        .from("news_articles")
        .select(
          "link, title, description, pub_date, source_id, image_url, category, matched_query, provider, title_key",
        )
        .order("pub_date", { ascending: false, nullsFirst: false })
        // Over-fetch so deduplication and language filtering cannot leave the feed short.
        .limit(data.limit * 3);

      if (error) return { articles: [], error: "News feed is unavailable right now." };

      const mapped = ((rows ?? []) as Row[])
        .filter((r) => !containsChineseScript(r.title, r.description))
        .map((r): NewsArticle => {
          const title = r.title;
          return {
            link: r.link,
            title,
            description: r.description ?? "",
            pubDate: r.pub_date,
            sourceId: r.source_id ?? "",
            imageUrl: r.image_url,
            category: r.category ?? [],
            matchedQuery: r.matched_query ?? "",
            source: isSocialProvider(toProvider(r.provider))
              ? ("Social" as const)
              : ("News" as const),
            provider: toProvider(r.provider),
            titleKey: r.title_key || normalizeTitle(title),
          };
        });

      // Second dedupe pass at read time: it also heals rows stored before the
      // matching rules were tightened.
      const { kept } = dedupeByStory(mapped);
      // Keyword guard first, so obviously off-topic stories never reach the
      // feed (or the model) even when the sweep query was loose. An
      // unconfigured workspace (no pattern) keeps everything rather than
      // emptying the feed - see isNewsRelevant()'s doc comment.
      const settings = await getWorkspaceSettings();
      const pattern = buildRelevancePattern(settings);
      const relevantByKeyword = kept.filter((a) =>
        isNewsRelevant(pattern, a.title, a.description, a.matchedQuery),
      );
      const ordered = relevantByKeyword
        .sort((a, b) => (b.pubDate ?? "").localeCompare(a.pubDate ?? ""))
        .slice(0, data.limit);

      const subject = describeSubject(settings);
      const verdicts = await classifyArticles(ordered, subject);
      const articles = ordered
        // The model has the final say on whether a story is really relevant.
        .filter((a) => verdicts.get(a.link)?.relevant !== false)
        .map((a): ScoredNewsArticle => {
          const v = verdicts.get(a.link);
          return {
            ...a,
            sentiment: v?.sentiment ?? "neutral",
            sentimentScore: v?.score ?? 0,
            sentimentReason: v?.reason ?? `No clear upside or damage for ${subject}.`,
          };
        });

      return { articles, error: null };
    },
  );

/** Pulls a fresh sweep of both sources on demand (used by the Refresh button). */
export const refreshNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { runNewsSweep } = await import("./news.server");
    try {
      return await runNewsSweep();
    } catch (err) {
      return {
        fetched: 0,
        stored: 0,
        newsdata: 0,
        googleNews: 0,
        social: {} as Record<string, number>,
        duplicates: 0,
        failedQueries: [] as string[],
        error: err instanceof Error ? err.message : "News sweep failed",
      };
    }
  });
