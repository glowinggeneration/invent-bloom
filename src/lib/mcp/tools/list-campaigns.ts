import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_campaigns",
  title: "List campaigns",
  description:
    "List the signed-in user's publishing campaigns in FKF CommsIQ with their goal, status and copy, newest first.",
  inputSchema: {
    status: z
      .string()
      .optional()
      .describe("Optional status filter, e.g. draft, queued, running, done."),
    limit: z
      .number()
      .int()
      .optional()
      .describe("How many campaigns to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("publish_jobs")
      .select(
        "id, mode, status, tweet_text, comment_text, objective_text, link_url, target_tweet_url, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(take);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { campaigns: data ?? [] },
    };
  },
});
