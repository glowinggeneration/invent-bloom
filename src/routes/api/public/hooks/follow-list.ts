import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Legacy mass-follow endpoint.
 *
 * Automated proactive following is disabled. The endpoint remains available so
 * old scheduled calls terminate successfully without generating account risk.
 */
export const Route = createFileRoute("/api/public/hooks/follow-list")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        return Response.json({
          ok: true,
          disabled: true,
          reason:
            "Automated proactive following is disabled by the X campaign compliance policy. Follow decisions must be made manually on X.",
        });
      },
    },
  },
});
