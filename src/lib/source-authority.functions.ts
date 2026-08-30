import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sourceAuthority, type SourceAuthority } from "./mention-intelligence";

export type AuthorityCitation = {
  id: string;
  title: string;
  url?: string;
  timestamp?: string;
};

export type AuthoritySource = {
  key: string;
  name: string;
  channel: string;
  authority: SourceAuthority;
  mentions: number;
  views: number;
  engagement: number;
  verified: boolean;
  citations: AuthorityCitation[];
};

type Aggregate = Omit<AuthoritySource, "authority"> & { isPublication: boolean };

const AUTHORITY_RANK: Record<SourceAuthority, number> = { High: 3, Medium: 2, Standard: 1 };

export const getSourceAuthority = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuthoritySource[]> => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();

    const [xRes, newsRes, socialRes, profilesRes] = await Promise.all([
      context.supabase
        .from("x_mentions")
        .select(
          "author_handle, author_name, author_verified, view_count, like_count, posted_at, text, url",
        )
        .gte("posted_at", since)
        .limit(800),
      context.supabase
        .from("news_articles")
        .select("source_id, provider, pub_date, title, url")
        .gte("pub_date", since)
        .limit(500),
      context.supabase
        .from("apify_mentions")
        .select(
          "platform, source_label, author_name, author_handle, views, likes, comments, shares, published_at, title, content, url",
        )
        .gte("published_at", since)
        .limit(800),
      context.supabase.from("apify_profiles").select("platform, handle, is_verified"),
    ]);

    const profileVerified = new Map<string, boolean>();
    for (const row of (profilesRes.data ?? []) as Record<string, any>[]) {
      const key = `${String(row["platform"] ?? "").toLowerCase()}:${String(row["handle"] ?? "")
        .replace(/^@/, "")
        .toLowerCase()}`;
      profileVerified.set(key, Boolean(row["is_verified"]));
    }

    const sources = new Map<string, Aggregate>();
    const add = (input: {
      name: string;
      channel: string;
      views?: number;
      engagement?: number;
      verified?: boolean;
      isPublication?: boolean;
      citation?: { id: string; title: string; url?: string; timestamp?: string };
    }) => {
      const name = input.name.trim() || "Unknown source";
      const channel = input.channel.trim() || "Other";
      const key = `${channel.toLowerCase()}:${name.toLowerCase()}`;
      const current = sources.get(key) ?? {
        key,
        name,
        channel,
        mentions: 0,
        views: 0,
        engagement: 0,
        verified: false,
        isPublication: false,
        citations: [] as AuthorityCitation[],
      };
      current.mentions += 1;
      current.views += Math.max(0, Number(input.views ?? 0));
      current.engagement += Math.max(0, Number(input.engagement ?? 0));
      current.verified = current.verified || Boolean(input.verified);
      current.isPublication = current.isPublication || Boolean(input.isPublication);
      if (input.citation && current.citations.length < 3) {
        const citation: AuthorityCitation = { id: input.citation.id, title: input.citation.title };
        if (input.citation.url) citation.url = input.citation.url;
        if (input.citation.timestamp) citation.timestamp = input.citation.timestamp;
        current.citations.push(citation);
      }
      sources.set(key, current);
    };

    for (const [i, row] of ((xRes.data ?? []) as Record<string, any>[]).entries()) {
      const text = String(row["text"] ?? "").slice(0, 140);
      add({
        name: String(row["author_name"] || row["author_handle"] || "X account"),
        channel: "X",
        views: Number(row["view_count"] ?? 0),
        engagement: Number(row["like_count"] ?? 0),
        verified: Boolean(row["author_verified"]),
        citation: {
          id: `x-${i}-${row["url"] ?? row["posted_at"] ?? i}`,
          title: text || "X post",
          url: row["url"] || undefined,
          timestamp: row["posted_at"] || undefined,
        },
      });
    }

    for (const [i, row] of ((newsRes.data ?? []) as Record<string, any>[]).entries()) {
      add({
        name: String(row["source_id"] || row["provider"] || "Publication"),
        channel: "News",
        isPublication: true,
        citation: {
          id: `news-${i}-${row["url"] ?? row["pub_date"] ?? i}`,
          title: String(row["title"] ?? row["source_id"] ?? "News article"),
          url: row["url"] || undefined,
          timestamp: row["pub_date"] || undefined,
        },
      });
    }

    for (const [i, row] of ((socialRes.data ?? []) as Record<string, any>[]).entries()) {
      const platform = String(row["platform"] || row["source_label"] || "Social");
      const handle = String(row["author_handle"] ?? "").replace(/^@/, "");
      const title = String(row["title"] || row["content"] || "").slice(0, 140);
      add({
        name: String(row["author_name"] || handle || row["source_label"] || platform),
        channel: platform,
        views: Number(row["views"] ?? 0),
        engagement:
          Number(row["likes"] ?? 0) + Number(row["comments"] ?? 0) + Number(row["shares"] ?? 0),
        verified: profileVerified.get(`${platform.toLowerCase()}:${handle.toLowerCase()}`) ?? false,
        isPublication: platform.toLowerCase() === "news",
        citation: {
          id: `social-${i}-${row["url"] ?? row["published_at"] ?? i}`,
          title: title || `${platform} post`,
          url: row["url"] || undefined,
          timestamp: row["published_at"] || undefined,
        },
      });
    }

    return [...sources.values()]
      .map((source): AuthoritySource => {
        const authority = sourceAuthority({
          verified: source.verified,
          isPublication: source.isPublication,
          views: source.views,
          engagement: source.engagement,
        });
        return {
          key: source.key,
          name: source.name,
          channel: source.channel,
          authority,
          mentions: source.mentions,
          views: source.views,
          engagement: source.engagement,
          verified: source.verified,
          citations: source.citations,
        };
      })
      .sort(
        (a, b) =>
          AUTHORITY_RANK[b.authority] - AUTHORITY_RANK[a.authority] ||
          b.views - a.views ||
          b.engagement - a.engagement ||
          b.mentions - a.mentions,
      )
      .slice(0, 8);
  });
