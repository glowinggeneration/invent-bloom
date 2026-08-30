import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { containsChineseScript } from "./content-language";
import { matchesMentionTopic } from "./mention-intelligence";

export type ConversationOrigin = {
  label: string;
  source: string;
  publishedAt: string | null;
  url: string | null;
};

export type ConversationAmplifier = {
  label: string;
  source: string;
  views: number;
  engagements: number;
  mentions: number;
};

export type ConversationContextItem = {
  id: string;
  label: string;
  query: string;
  mentions: number;
  origin: ConversationOrigin | null;
  amplifiers: ConversationAmplifier[];
};

type ContextRow = {
  text: string;
  label: string;
  source: string;
  publishedAt: string | null;
  url: string | null;
  views: number;
  engagements: number;
};

const TOPICS = [
  { id: "leadership", label: "FKF leadership & governance", query: "leadership" },
  { id: "national-teams", label: "National teams & performance", query: "harambee" },
  { id: "grassroots", label: "Grassroots & youth development", query: "grassroots" },
  { id: "league", label: "League, clubs & competitions", query: "league" },
  { id: "facilities", label: "Facilities & football investment", query: "stadium" },
  { id: "integrity", label: "Integrity, disputes & accountability", query: "integrity" },
] as const;

function earliest(rows: ContextRow[]): ConversationOrigin | null {
  const row = [...rows]
    .filter((item) => item.publishedAt)
    .sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)))[0];
  if (!row) return null;
  return {
    label: row.label,
    source: row.source,
    publishedAt: row.publishedAt,
    url: row.url,
  };
}

function amplifiers(rows: ContextRow[]): ConversationAmplifier[] {
  const grouped = new Map<string, ConversationAmplifier>();
  for (const row of rows) {
    if (!row.label) continue;
    const key = `${row.source.toLowerCase()}::${row.label.toLowerCase()}`;
    const item = grouped.get(key) ?? {
      label: row.label,
      source: row.source,
      views: 0,
      engagements: 0,
      mentions: 0,
    };
    item.views += row.views;
    item.engagements += row.engagements;
    item.mentions += 1;
    grouped.set(key, item);
  }
  return [...grouped.values()]
    .sort(
      (a, b) =>
        b.views +
        b.engagements * 20 +
        b.mentions * 100 -
        (a.views + a.engagements * 20 + a.mentions * 100),
    )
    .slice(0, 3);
}

export const getConversationContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversationContextItem[]> => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();

    const [xRes, newsRes, socialRes] = await Promise.all([
      context.supabase
        .from("x_mentions")
        .select("text, author_handle, posted_at, view_count, like_count, url, matched_keyword")
        .gte("posted_at", since)
        .order("posted_at", { ascending: false })
        .limit(1000),
      context.supabase
        .from("news_articles")
        .select("title, description, pub_date, source_id, provider, matched_query, link")
        .gte("pub_date", since)
        .order("pub_date", { ascending: false })
        .limit(500),
      context.supabase
        .from("apify_mentions")
        .select(
          "title, content, published_at, author_name, author_handle, source_label, views, likes, comments, shares, url, matched_keywords",
        )
        .gte("published_at", since)
        .order("published_at", { ascending: false })
        .limit(800),
    ]);

    const rows: ContextRow[] = [];

    for (const raw of (xRes.data ?? []) as Record<string, any>[]) {
      const text = `${raw["text"] ?? ""} ${raw["matched_keyword"] ?? ""}`.trim();
      if (!text || containsChineseScript(text)) continue;
      const handle = String(raw["author_handle"] ?? "")
        .replace(/^@/, "")
        .trim();
      rows.push({
        text,
        label: handle ? `@${handle}` : "X account",
        source: "X",
        publishedAt: raw["posted_at"],
        url: raw["url"],
        views: Number(raw["view_count"] ?? 0),
        engagements: Number(raw["like_count"] ?? 0),
      });
    }

    for (const raw of (newsRes.data ?? []) as Record<string, any>[]) {
      const text =
        `${raw["title"] ?? ""} ${raw["description"] ?? ""} ${raw["matched_query"] ?? ""}`.trim();
      if (!text || containsChineseScript(text)) continue;
      rows.push({
        text,
        label: String(raw["source_id"] || raw["provider"] || "Publication"),
        source: String(raw["provider"] || "News"),
        publishedAt: raw["pub_date"],
        url: raw["link"],
        views: 0,
        engagements: 0,
      });
    }

    for (const raw of (socialRes.data ?? []) as Record<string, any>[]) {
      const text =
        `${raw["title"] ?? ""} ${raw["content"] ?? ""} ${(raw["matched_keywords"] ?? []).join?.(" ") ?? ""}`.trim();
      if (!text || containsChineseScript(text)) continue;
      const handle = String(raw["author_handle"] ?? "")
        .replace(/^@/, "")
        .trim();
      const label = String(
        raw["author_name"] || (handle ? `@${handle}` : raw["source_label"] || "Social source"),
      );
      rows.push({
        text,
        label,
        source: String(raw["source_label"] || "Social"),
        publishedAt: raw["published_at"],
        url: raw["url"],
        views: Number(raw["views"] ?? 0),
        engagements:
          Number(raw["likes"] ?? 0) + Number(raw["comments"] ?? 0) + Number(raw["shares"] ?? 0),
      });
    }

    return TOPICS.map((topic): ConversationContextItem | null => {
      const matches = rows.filter((row) => matchesMentionTopic(row.text, topic.query));
      if (!matches.length) return null;
      return {
        id: topic.id,
        label: topic.label,
        query: topic.query,
        mentions: matches.length,
        origin: earliest(matches),
        amplifiers: amplifiers(matches),
      };
    })
      .filter((item): item is ConversationContextItem => item !== null)
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 4);
  });
