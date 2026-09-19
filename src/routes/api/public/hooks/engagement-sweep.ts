import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Legacy engagement sweep endpoint.
 *
 * Fleet-wide following and coordinated engagement are intentionally disabled.
 * Keep the endpoint alive so existing cron jobs receive a clean success
 * response instead of retrying or producing noisy health failures.
 */
export const Route = createFileRoute("/api/public/hooks/engagement-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        return Response.json({
          ok: true,
          disabled: true,
          reason:
            "Coordinated fleet-wide following and engagement are disabled by the X campaign compliance policy.",
        });
      },
    },
  },
});
