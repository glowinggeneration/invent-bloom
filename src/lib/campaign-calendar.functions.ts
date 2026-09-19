import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** One scheduled_actions row shaped for the calendar UI. */
export type CalendarAction = {
  id: string;
  runAt: string;
  actionType: "tweet" | "comment" | "like" | "retweet" | "bookmark" | "follow";
  status: "pending" | "running" | "success" | "failed" | "paused" | "cancelled";
  handle: string | null;
  personaName: string | null;
  campaignId: string | null;
  accountId: string | null;
  content: string | null;
  targetHandle: string | null;
};

const rangeSchema = z.object({
  from: z.string(), // ISO date/datetime, inclusive lower bound
  to: z.string(), // ISO date/datetime, exclusive upper bound
});

type ScheduledActionRow = {
  id: string;
  run_at: string;
  action_type: CalendarAction["actionType"];
  status: CalendarAction["status"];
  handle: string | null;
  persona_name: string | null;
  campaign_id: string | null;
  account_id: string | null;
  content: string | null;
  target_handle: string | null;
  x_accounts: { handle: string | null } | { handle: string | null }[] | null;
};

/** Minimal shape of the supabase query chain this handler relies on. */
type ScheduledActionsClient = {
  from: (table: string) => {
    select: (columns: string) => {
      gte: (
        column: string,
        value: string,
      ) => {
        lt: (
          column: string,
          value: string,
        ) => {
          order: (
            column: string,
            opts: { ascending: boolean },
          ) => {
            limit: (
              n: number,
            ) => Promise<{ data: ScheduledActionRow[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };
};

function shorten(text: string | null, max = 140): string | null {
  if (!text) return null;
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * All scheduled_actions whose run_at falls within [from, to), for the
 * calendar view. RLS on scheduled_actions/x_accounts already scopes this to
 * the caller's workspace, so a plain authenticated client is enough.
 */
export const listCalendarActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rangeSchema.parse(input))
  .handler(async ({ data, context }): Promise<CalendarAction[]> => {
    const supabase = context.supabase as unknown as ScheduledActionsClient;

    const { data: rows, error } = await supabase
      .from("scheduled_actions")
      .select(
        "id, run_at, action_type, status, handle, persona_name, campaign_id, account_id, content, target_handle, x_accounts(handle)",
      )
      .gte("run_at", data.from)
      .lt("run_at", data.to)
      .order("run_at", { ascending: true })
      .limit(5000);

    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => {
      const joined = Array.isArray(row.x_accounts) ? row.x_accounts[0] : row.x_accounts;
      return {
        id: row.id,
        runAt: row.run_at,
        actionType: row.action_type,
        status: row.status,
        handle: row.handle ?? joined?.handle ?? null,
        personaName: row.persona_name ?? null,
        campaignId: row.campaign_id ?? null,
        accountId: row.account_id ?? null,
        content: shorten(row.content),
        targetHandle: row.target_handle ?? null,
      };
    });
  });
