/**
 * Nightly report generation.
 *
 * Called by the scheduler just before midnight Nairobi time so the day's
 * record exists without anyone having a browser open. Accepts an optional
 * `date` (YYYY-MM-DD) to regenerate a past day.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/daily-report")({
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

        const date = new URL(request.url).searchParams.get("date");
        try {
          const { generateDailyReport } = await import("@/lib/reports.server");
          const report = await generateDailyReport(
            date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
          );
          return Response.json({
            ok: true,
            id: report.id,
            date: report.reportDate,
            status: report.status,
            mentions: report.metrics.mentions,
            campaigns: report.campaigns.total,
          });
        } catch (err) {
          console.error("Daily report generation failed", err);
          return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
