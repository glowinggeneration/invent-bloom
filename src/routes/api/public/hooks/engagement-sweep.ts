import { createFileRoute } from "@tanstack/react-router";

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
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || apiKey !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

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
