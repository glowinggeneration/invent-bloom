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
          const result = await refreshKeywords();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
