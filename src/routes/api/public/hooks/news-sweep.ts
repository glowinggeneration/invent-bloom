/**
 * Scheduled NewsData sweep. Called by the database timer every ~75 minutes.
 * The sweep is idempotent: articles are deduplicated by link.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/news-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        // Either key shape is accepted: projects carry the legacy anon key and
        // the newer publishable key, and the timer may send either one.
        const accepted = [
          process.env["SUPABASE_ANON_KEY"],
          process.env["SUPABASE_PUBLISHABLE_KEY"],
        ].filter((v): v is string => Boolean(v));
        if (!accepted.length || !accepted.includes(key)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { runListeningPipeline } = await import("@/lib/listening-pipeline.server");
          const result = await runListeningPipeline({ lanes: ["news"] });
          return Response.json(result, { status: result.ok ? 200 : 207 });
        } catch (err) {
          console.error("news-sweep failed", err);
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "sweep failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
