import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

type AnalysisShape = {
  summary?: unknown;
  confidence?: unknown;
  sentiment?: unknown;
  metrics?: unknown;
  classification?: unknown;
  risks?: unknown;
  suggestions?: unknown;
};

export default defineTool({
  name: "get_message_test",
  title: "Get message test",
  description:
    "Read one message-testing session: the tested messages plus the persona-panel verdict, sentiment split, risks and the three recommended rewrites.",
  inputSchema: {
    thread_id: z
      .string()
      .describe("The id of the message-testing session (from list_message_tests)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ thread_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("messages")
      .select("id, role, content, analysis, created_at")
      .eq("thread_id", thread_id)
      .order("created_at", { ascending: true });

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data?.length) {
      return {
        content: [{ type: "text", text: "No message test found with that id." }],
        isError: true,
      };
    }

    // Persona-by-persona reactions are large; return the verdict-level fields only.
    const messages = data.map((m) => {
      const a = (m.analysis ?? null) as AnalysisShape | null;
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
        ...(a
          ? {
              analysis: {
                summary: a.summary,
                confidence: a.confidence,
                sentiment: a.sentiment,
                metrics: a.metrics,
                classification: a.classification,
                risks: a.risks,
                suggestions: a.suggestions,
              },
            }
          : {}),
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(messages) }],
      structuredContent: { messages },
    };
  },
});
