import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Hourly performance refresh. Called by pg_cron: pulls fresh public metrics
 * (impressions, likes, retweets, replies, quotes, bookmarks) for every post
 * and reply published by the linked accounts.
 * Authenticated with the shared cron secret in the `authorization: Bearer` header.
 */
export const Route = createFileRoute("/api/public/hooks/metrics-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        const { refreshAllMetrics } = await import("@/lib/performance.server");
        const results = await refreshAllMetrics();
        return Response.json({ ok: true, results });
      },
    },
  },
});
