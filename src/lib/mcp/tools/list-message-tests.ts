import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_message_tests",
  title: "List message tests",
  description:
    "List the signed-in user's recent message-testing sessions (threads) in FKF CommsIQ, newest first.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .optional()
      .describe("How many sessions to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("threads")
      .select("id, title, pinned, visibility, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(take);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { threads: data ?? [] },
    };
  },
});
