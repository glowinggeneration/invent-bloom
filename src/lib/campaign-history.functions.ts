import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CAMPAIGN_HISTORY_STATUSES = [
  "pending",
  "running",
  "success",
  "failed",
  "paused",
  "cancelled",
] as const;

export const CAMPAIGN_HISTORY_ACTION_TYPES = [
  "tweet",
  "comment",
  "like",
  "retweet",
  "bookmark",
  "follow",
] as const;

export type CampaignHistoryStatus = (typeof CAMPAIGN_HISTORY_STATUSES)[number];
export type CampaignHistoryActionType = (typeof CAMPAIGN_HISTORY_ACTION_TYPES)[number];

export type CampaignHistoryRow = {
  id: string;
  accountId: string | null;
  handle: string;
  personaName: string;
  displayName: string;
  actionType: string;
  status: string;
  content: string;
  targetTweetId: string | null;
  targetHandle: string | null;
  resultTweetId: string | null;
  runAt: string;
  updatedAt: string;
  error: string | null;
  campaignId: string | null;
  source: string;
};

const listCampaignHistoryInput = z.object({
  status: z.enum(CAMPAIGN_HISTORY_STATUSES).optional(),
  actionType: z.enum(CAMPAIGN_HISTORY_ACTION_TYPES).optional(),
  accountId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
});

export type ListCampaignHistoryInput = z.input<typeof listCampaignHistoryInput>;

type ScheduledActionRecord = {
  id: string;
  account_id: string | null;
  handle: string | null;
  persona_name: string | null;
  action_type: string;
  status: string;
  content: string | null;
  target_tweet_id: string | null;
  target_handle: string | null;
  result_tweet_id: string | null;
  run_at: string;
  updated_at: string;
  error: string | null;
  campaign_id: string | null;
  source: string;
  x_accounts: {
    handle: string | null;
    display_name: string | null;
    persona_label: string | null;
  } | null;
};

function toRow(row: ScheduledActionRecord): CampaignHistoryRow {
  const account = row.x_accounts ?? null;
  return {
    id: row.id,
    accountId: row.account_id ?? null,
    handle: row.handle ?? account?.handle ?? "",
    personaName: row.persona_name ?? account?.persona_label ?? "",
    displayName: account?.display_name ?? account?.persona_label ?? row.handle ?? "",
    actionType: row.action_type,
    status: row.status,
    content: row.content ?? "",
    targetTweetId: row.target_tweet_id ?? null,
    targetHandle: row.target_handle ?? null,
    resultTweetId: row.result_tweet_id ?? null,
    runAt: row.run_at,
    updatedAt: row.updated_at,
    error: row.error ?? null,
    campaignId: row.campaign_id ?? null,
    source: row.source,
  };
}

/**
 * Flat, filterable activity feed across every campaign and account, most
 * recent first — "which posts actually posted", at a glance. Unlike
 * getCampaignReport (campaign-scoped drill-down), this spans everything the
 * caller's workspace can see; RLS on scheduled_actions already scopes rows
 * to the caller's workspace, so no manual workspace filter is needed here.
 */
export const listCampaignHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listCampaignHistoryInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<CampaignHistoryRow[]> => {
    const supabase = context.supabase;
    let query = supabase
      .from("scheduled_actions")
      .select("*, x_accounts(handle, display_name, persona_label)")
      .order("run_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.status) query = query.eq("status", data.status);
    if (data.actionType) query = query.eq("action_type", data.actionType);
    if (data.accountId) query = query.eq("account_id", data.accountId);
    if (data.campaignId) query = query.eq("campaign_id", data.campaignId);
    if (data.from) query = query.gte("run_at", data.from);
    if (data.to) query = query.lte("run_at", data.to);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as unknown as ScheduledActionRecord[]).map(toRow);
  });
