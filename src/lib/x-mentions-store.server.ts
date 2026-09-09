/**
 * Persists X mentions as they are collected.
 *
 * The live X search only ever returns a rolling window, so without this the
 * Overview page could never compare this week against last week. Rows are
 * keyed by tweet id and refreshed on every sweep, which keeps like and view
 * counts current without duplicating history.
 */
import type { BrandMention } from "./brand-mentions.functions";
import { classifyEntityMention, getWorkspaceSettings } from "./entity-config.server";

export async function storeXMentions(
  mentions: BrandMention[],
  workspaceId: string,
): Promise<number> {
  if (mentions.length === 0) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const settings = await getWorkspaceSettings(workspaceId);

  const rows = mentions.map((m) => ({
    workspace_id: workspaceId,
    tweet_id: m.id,
    text: m.text,
    author_handle: m.authorHandle ?? "",
    author_name: m.authorName ?? "",
    author_verified: Boolean(m.isVerified),
    url: m.url ?? "",
    posted_at: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    like_count: Number(m.likeCount ?? 0),
    view_count: Number(m.viewCount ?? 0),
    sentiment: m.sentiment,
    sentiment_score: Number(m.sentimentScore ?? 0),
    sentiment_reason: m.sentimentReason ?? "",
    reply_to_brand: Boolean(m.replyToBrand),
    mentions_federation:
      classifyEntityMention(settings, m.text).org || (m.mentions ?? []).length > 0,
    mentions_president: classifyEntityMention(settings, m.text).keyFigure,
    source: m.source ?? "mention",
    matched_keyword: m.matchedKeyword ?? "",
    collected_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from("x_mentions")
    .upsert(rows, { onConflict: "workspace_id,tweet_id" });
  if (error) {
    console.error(`Storing X mentions failed: ${error.message}`);
    return 0;
  }
  return rows.length;
}
