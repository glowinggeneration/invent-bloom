/**
 * Scheduled NewsData sweep. Called by the database timer every ~75 minutes.
 * The sweep is idempotent: articles are deduplicated by link.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/hooks/news-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

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
