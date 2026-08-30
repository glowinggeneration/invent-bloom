import { createFileRoute } from "@tanstack/react-router";

/**
 * Hourly performance refresh. Called by pg_cron: pulls fresh public metrics
 * (impressions, likes, retweets, replies, quotes, bookmarks) for every post
 * and reply published by the linked accounts.
 * Authenticated with the project publishable key in the `apikey` header.
 */
export const Route = createFileRoute("/api/public/hooks/metrics-refresh")({
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

        const { refreshAllMetrics } = await import("@/lib/performance.server");
        const results = await refreshAllMetrics();
        return Response.json({ ok: true, results });
      },
    },
  },
});
