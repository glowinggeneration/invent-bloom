/**
 * Scheduled multi-platform listening sweep. Called by the database timer.
 * Idempotent: an item already collected is never stored twice.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/hooks/apify-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        const url = new URL(request.url);
        const only = url.searchParams.get("sources");
        const profiles = url.searchParams.get("profiles") === "1";

        try {
          if (profiles) {
            const { refreshApifyProfiles } = await import("@/lib/apify-mentions.server");
            const result = await refreshApifyProfiles();
            return Response.json({ ok: true, profiles: result });
          }

          const { runListeningPipeline } = await import("@/lib/listening-pipeline.server");
          const sources = only ? only.split(",").filter(Boolean) : null;
          const result = await runListeningPipeline({
            lanes: ["apify"],
            ...(sources ? { apifySources: sources } : {}),
          });
          return Response.json(result, { status: result.ok ? 200 : 207 });
        } catch (err) {
          console.error("apify-sweep failed", err);
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "sweep failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
