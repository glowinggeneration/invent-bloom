/**
 * Scheduled social sweep (Reddit, Mastodon, YouTube, Bluesky, Meta slots).
 * Runs on a faster timer than the press wires, which are quota-limited.
 * Idempotent: items are deduplicated by link and by normalised headline.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/hooks/social-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

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
