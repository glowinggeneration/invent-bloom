import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveWorkspaceId } from "./workspace.server";
import { trackEvent } from "./growth-events.server";

export type PriorityItemType = "decision" | "investigation" | "campaign" | "report" | "custom";
export type PriorityStatus = "active" | "deferred" | "completed";

export type TodayPriority = {
  id: string;
  itemType: PriorityItemType;
  itemId: string | null;
  title: string;
  note: string;
  href: string;
  position: number;
  status: PriorityStatus;
  deferReason: string | null;
  deferUntil: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// A soft ceiling only - the meaningful default of 3 is a per-user display
// preference (today-priorities.ts, localStorage), not enforced here. This
// just stops the list itself growing unboundedly.
const MAX_ACTIVE_PRIORITIES = 12;

function mapPriority(row: any): TodayPriority {
  return {
    id: row.id,
    itemType: row.item_type,
    itemId: row.item_id,
    title: row.title,
    note: row.note ?? "",
    href: row.href,
    position: row.position,
    status: row.status,
    deferReason: row.defer_reason,
    deferUntil: row.defer_until,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** This user's active and deferred priorities, ordered. Completed ones are
 *  read separately via listCompletedToday so "what's active" never has to
 *  filter a growing completed tail on every load. */
export const listPriorities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TodayPriority[]> => {
    const { data, error } = await (context.supabase as any)
      .from("today_priorities")
      .select("*")
      .eq("user_id", context.userId)
      .in("status", ["active", "deferred"])
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map(mapPriority);
  });

/** Priorities this user completed today (server-side UTC date), for the
 *  factual "Completed today" list - distinct from completed work read from
 *  each feature's own persisted status (decisions/campaigns/reports). */
export const listCompletedPrioritiesToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TodayPriority[]> => {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { data, error } = await (context.supabase as any)
      .from("today_priorities")
      .select("*")
      .eq("user_id", context.userId)
      .eq("status", "completed")
      .gte("completed_at", todayStart.toISOString())
      .order("completed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map(mapPriority);
  });

const addPrioritySchema = z.object({
  itemType: z.enum(["decision", "investigation", "campaign", "report", "custom"]),
  itemId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  note: z.string().trim().max(1000).default(""),
  href: z.string().trim().min(1).max(500),
});

export const addPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addPrioritySchema.parse(input))
  .handler(async ({ data, context }): Promise<TodayPriority> => {
    const workspaceId = await resolveWorkspaceId(context);
    const supabase = context.supabase as any;

    const { count } = await supabase
      .from("today_priorities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "active");
    if ((count ?? 0) >= MAX_ACTIVE_PRIORITIES) {
      throw new Error(`You can track at most ${MAX_ACTIVE_PRIORITIES} active priorities at once.`);
    }

    const { data: maxRow } = await supabase
      .from("today_priorities")
      .select("position")
      .eq("user_id", context.userId)
      .in("status", ["active", "deferred"])
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = (maxRow?.position ?? -1) + 1;

    const { data: row, error } = await supabase
      .from("today_priorities")
      .insert({
        workspace_id: workspaceId,
        user_id: context.userId,
        item_type: data.itemType,
        item_id: data.itemId ?? null,
        title: data.title,
        note: data.note,
        href: data.href,
        position: nextPosition,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapPriority(row);
  });

const reorderSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(50) });

/** Applies a full new order for this user's active+deferred priorities.
 *  Every id must already belong to the caller - RLS enforces this on each
 *  update, but a mismatched count means at least one id wasn't theirs. */
export const reorderPriorities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reorderSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const supabase = context.supabase as any;
    const results = await Promise.all(
      data.ids.map((id, index) =>
        supabase
          .from("today_priorities")
          .update({ position: index }, { count: "exact" })
          .eq("id", id)
          .eq("user_id", context.userId),
      ),
    );
    const touched = results.reduce((sum, r) => sum + (r.count ?? 0), 0);
    if (touched !== data.ids.length) {
      throw new Error("Some priorities couldn't be reordered - refresh and try again.");
    }
    return { ok: true };
  });

const deferSchema = z.object({
  id: z.string().uuid(),
  deferUntil: z.string().trim().max(10).optional(),
  reason: z.string().trim().max(500).default(""),
});

/** Defers a priority: it drops out of the active list (and its slot) but
 *  keeps its title, note and full history - reactivatePriority brings it
 *  straight back with nothing lost. */
export const deferPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deferSchema.parse(input))
  .handler(async ({ data, context }): Promise<TodayPriority> => {
    const { data: row, error } = await (context.supabase as any)
      .from("today_priorities")
      .update({
        status: "deferred",
        defer_until: data.deferUntil ?? null,
        defer_reason: data.reason,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Priority not found.");
    return mapPriority(row);
  });

export const reactivatePriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TodayPriority> => {
    const { data: row, error } = await (context.supabase as any)
      .from("today_priorities")
      .update({ status: "active", defer_reason: null, defer_until: null })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Priority not found.");
    return mapPriority(row);
  });

export const completePriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TodayPriority> => {
    const workspaceId = await resolveWorkspaceId(context);
    const { data: row, error } = await (context.supabase as any)
      .from("today_priorities")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Priority not found.");
    void trackEvent({
      workspaceId,
      userId: context.userId,
      eventName: "priority_completed",
      properties: { itemType: row.item_type },
    });
    return mapPriority(row);
  });

/** Removes a priority outright - used for "replace" (drop this, add a new
 *  one) on an active/deferred item that was never actually finished. */
export const deletePriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ deleted: boolean }> => {
    const { error, count } = await (context.supabase as any)
      .from("today_priorities")
      .delete({ count: "exact" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { deleted: (count ?? 0) > 0 };
  });
