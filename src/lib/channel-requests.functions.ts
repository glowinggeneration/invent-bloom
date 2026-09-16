import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveWorkspaceId } from "./workspace.server";

const requestSchema = z.object({
  channel: z.string().trim().min(2).max(80),
  handle: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(1000).default(""),
});

/** Records a request for another channel the team would like monitored. */
export const requestChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const workspaceId = await resolveWorkspaceId(context);
    const { error } = await (context.supabase as any).from("channel_requests").insert({
      workspace_id: workspaceId,
      requested_by: context.userId,
      channel: data.channel,
      handle: data.handle,
      notes: data.notes,
      status: "new",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
