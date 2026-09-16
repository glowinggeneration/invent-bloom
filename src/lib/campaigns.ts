import { z } from "zod";

/**
 * Legacy listening-campaign record. These definitions remain readable for
 * history and preview, but automatic keyword-triggered replies are retired.
 */
export type Campaign = {
  id: string;
  name: string;
  keywords: string[];
  hashtags: string[];
  coreMessage: string;
  language: string;
  isActive: boolean;
  maxRepliesPerRun: number;
  spreadHours: number;
  likeTarget: boolean;
  followAuthor: boolean;
  accountIds: string[];
  lastRunAt: string | null;
  createdAt: string;
  replyCount: number;
};

export type CampaignReply = {
  id: string;
  campaignId: string;
  handle: string;
  personaName: string;
  tweetId: string;
  tweetUrl: string | null;
  authorHandle: string;
  tweetText: string;
  replyText: string;
  status: "pending" | "success" | "failed" | "skipped";
  error: string | null;
  createdAt: string;
};

export type CampaignRunResult = {
  campaignId: string;
  found: number;
  replied: number;
  failed: number;
  skipped: number;
  note: string;
  replies: CampaignReply[];
};

export const REPLY_LIMIT = 280;

/** Normalises a comma / newline separated list into clean terms. */
export function parseTerms(raw: string, stripHash = false): string[] {
  return [
    ...new Set(
      raw
        .split(/[,\n]/)
        .map((t) => t.trim())
        .map((t) => (stripHash ? t.replace(/^#+/, "") : t))
        .filter(Boolean)
        .map((t) => t.slice(0, 60)),
    ),
  ].slice(0, 20);
}

/** Builds the read-only X search query used to preview a monitoring definition. */
export function buildSearchQuery(input: {
  keywords: string[];
  hashtags: string[];
  language?: string;
}): string {
  const terms = [
    ...input.keywords.map((k) => (k.includes(" ") ? `"${k}"` : k)),
    ...input.hashtags.map((h) => `#${h.replace(/^#+/, "")}`),
  ].filter(Boolean);
  if (!terms.length) return "";
  const or = terms.length > 1 ? `(${terms.join(" OR ")})` : terms[0]!;
  const lang = (input.language ?? "").trim();
  return [or, lang ? `lang:${lang}` : "", "-filter:retweets", "-filter:replies"]
    .filter(Boolean)
    .join(" ");
}

/**
 * Kept for legacy editing/import compatibility. Saved records are forced
 * inactive by the server and cannot run automatic replies, Likes or Follows.
 */
export const campaignInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  keywords: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  hashtags: z
    .array(z.string().trim().min(1).max(60))
    .max(20)
    .default([])
    .transform((list) => list.map((h) => h.replace(/^#+/, ""))),
  coreMessage: z.string().trim().max(600).default(""),
  language: z.string().trim().max(8).default("en"),
  isActive: z.boolean().default(false),
  maxRepliesPerRun: z.number().int().min(1).max(25).default(1),
  spreadHours: z.number().int().min(0).max(48).default(0),
  likeTarget: z.boolean().default(false),
  followAuthor: z.boolean().default(false),
  accountIds: z.array(z.string().uuid()).max(500).default([]),
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;
