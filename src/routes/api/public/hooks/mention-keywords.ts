import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily keyword refresh. Asks the model for new topics worth listening to and
 * adds them to the shared keyword list used by Mentions.
 */
export const Route = createFileRoute("/api/public/hooks/mention-keywords")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || apiKey !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { refreshKeywords } = await import("@/lib/mention-keywords.server");
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: workspaces, error } = await (supabaseAdmin as any)
            .from("workspaces")
            .select("id");
          if (error) throw new Error(error.message);

          const results = await Promise.all(
            ((workspaces ?? []) as { id: string }[]).map(async (w) => {
              try {
                return { workspaceId: w.id, ...(await refreshKeywords(w.id)) };
              } catch (e) {
                return { workspaceId: w.id, added: [], checked: 0, error: (e as Error).message };
              }
            }),
          );
          return Response.json({ ok: true, workspaces: results });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
