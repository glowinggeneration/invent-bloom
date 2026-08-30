/**
 * Scheduled social sweep (Reddit, Mastodon, YouTube, Bluesky, Meta slots).
 * Runs on a faster timer than the press wires, which are quota-limited.
 * Idempotent: items are deduplicated by link and by normalised headline.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/social-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
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
          const result = await runListeningPipeline({ lanes: ["social"] });
          return Response.json(result, { status: result.ok ? 200 : 207 });
        } catch (err) {
          console.error("social-sweep failed", err);
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "sweep failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
