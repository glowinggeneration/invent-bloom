import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveWorkspaceId } from "./workspace.server";
import { trackEvent } from "./growth-events.server";

export type DraftVersion = {
  id: string;
  threadId: string;
  name: string;
  content: string;
  note: string;
  sourceMessageId: string | null;
  suggestionIndex: number | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
};

function mapVersion(row: any, name: string | null): DraftVersion {
  return {
    id: row.id,
    threadId: row.thread_id,
    name: row.name,
    content: row.content,
    note: row.note ?? "",
    sourceMessageId: row.source_message_id,
    suggestionIndex: row.suggestion_index,
    createdBy: row.created_by,
    createdByName: name,
    createdAt: row.created_at,
  };
}

/** Every saved version for a thread, oldest first - a plain append-only
 *  history, never filtered down to "the latest" since nothing here is ever
 *  superseded or deleted. */
export const listDraftVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<DraftVersion[]> => {
    const supabase = context.supabase as any;
    const { data: rows, error } = await supabase
      .from("draft_versions")
      .select("*")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const authorIds = [...new Set((rows ?? []).map((r: any) => r.created_by).filter(Boolean))];
    const names: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds);
      for (const p of (profiles ?? []) as { id: string; full_name: string }[]) {
        names[p.id] = p.full_name;
      }
    }

    return ((rows ?? []) as any[]).map((row) => mapVersion(row, names[row.created_by] ?? null));
  });

const saveSchema = z.object({
  threadId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(4000),
  note: z.string().trim().max(500).default(""),
  sourceMessageId: z.string().uuid().optional(),
  suggestionIndex: z.number().int().min(0).max(10).optional(),
});

/** Saves a new named version - always an insert, never an update, so an
 *  earlier version is never touched. Verifies the thread is actually in the
 *  caller's workspace before attaching to it (same guard shape used
 *  everywhere else a client-supplied id is written against). */
export const saveDraftVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }): Promise<DraftVersion> => {
    const workspaceId = await resolveWorkspaceId(context);
    const supabase = context.supabase as any;

    const { data: thread, error: threadError } = await supabase
      .from("threads")
      .select("id, workspace_id")
      .eq("id", data.threadId)
      .maybeSingle();
    if (threadError) throw new Error(threadError.message);
    if (!thread || thread.workspace_id !== workspaceId) {
      throw new Error("Test not found, or you don't have access to it.");
    }

    const { data: row, error } = await supabase
      .from("draft_versions")
      .insert({
        workspace_id: workspaceId,
        thread_id: data.threadId,
        name: data.name,
        content: data.content,
        note: data.note,
        source_message_id: data.sourceMessageId ?? null,
        suggestion_index: data.suggestionIndex ?? null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    void trackEvent({ workspaceId, userId: context.userId, eventName: "draft_version_saved" });
    return mapVersion(row, null);
  });
