import { createFileRoute } from "@tanstack/react-router";

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
        const apiKey = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || apiKey !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

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
