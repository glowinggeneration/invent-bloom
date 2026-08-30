import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  campaignInputSchema,
  type Campaign,
  type CampaignReply,
  type CampaignRunResult,
} from "./campaigns";

function toCampaign(row: any, replyCount = 0): Campaign {
  return {
    id: row.id,
    name: row.name,
    keywords: row.keywords ?? [],
    hashtags: row.hashtags ?? [],
    coreMessage: row.core_message ?? "",
    language: row.language ?? "en",
    isActive: row.is_active ?? false,
    maxRepliesPerRun: row.max_replies_per_run ?? 1,
    spreadHours: row.spread_hours ?? 0,
    likeTarget: row.like_target ?? false,
    followAuthor: row.follow_author ?? false,
    accountIds: row.account_ids ?? [],
    lastRunAt: row.last_run_at ?? null,
    createdAt: row.created_at,
    replyCount,
  };
}

/** Every legacy listening definition, newest first. */
export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Campaign[]> => {
    const { data, error } = await context.supabase
      .from("listening_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: replies } = await context.supabase.from("campaign_replies").select("campaign_id");
    const counts = new Map<string, number>();
    for (const r of replies ?? []) {
      const id = String((r as any).campaign_id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return (data ?? []).map((row: any) => toCampaign(row, counts.get(row.id) ?? 0));
  });

/**
 * Creates or updates a legacy listening definition for preview/history only.
 * Automatic execution, Likes and proactive follows remain disabled server-side.
 */
export const saveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => campaignInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<Campaign> => {
    const payload = {
      user_id: context.userId,
      name: data.name,
      keywords: data.keywords,
      hashtags: data.hashtags,
      core_message: data.coreMessage,
      language: data.language,
      is_active: false,
      max_replies_per_run: 1,
      spread_hours: data.spreadHours,
      like_target: false,
      follow_author: false,
      account_ids: data.accountIds,
    };

    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("listening_campaigns")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Campaign not found.");
      return toCampaign(row);
    }

    const { data: row, error } = await context.supabase
      .from("listening_campaigns")
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Could not save monitoring definition.");
    return toCampaign(row);
  });

/** Deletes a legacy listening definition and its reply history. */
export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("listening_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Historical reply records for one legacy listening definition. */
export const listCampaignReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        campaignId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<CampaignReply[]> => {
    const { data: rows, error } = await context.supabase
      .from("campaign_replies")
      .select("*")
      .eq("campaign_id", data.campaignId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const { toReplyView } = await import("./campaigns.server");
    return (rows ?? []).map(toReplyView);
  });

/** Preview matching public conversations without posting. */
export const previewCampaignMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        keywords: z.array(z.string()).max(20).default([]),
        hashtags: z.array(z.string()).max(20).default([]),
        language: z.string().max(8).default("en"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { buildSearchQuery } = await import("./campaigns");
    const query = buildSearchQuery(data);
    if (!query) return { query: "", tweets: [], error: "Add a keyword or hashtag first." };
    const { searchTweets } = await import("./twitterapi.server");
    const { tweets, error } = await searchTweets(query, 8);
    return { query, tweets, error };
  });

/**
 * Keyword-triggered automatic replies are intentionally retired. Monitoring
 * results should be reviewed in Mentions and answered through the Reply flow.
 */
export const runCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async (): Promise<CampaignRunResult> => {
    throw new Error(
      "Automatic keyword-triggered replies are disabled. Review matching conversations in Mentions and respond through the controlled Reply campaign flow.",
    );
  });
