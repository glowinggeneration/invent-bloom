/**
 * Nightly report generation.
 *
 * Called by the scheduler just before midnight Nairobi time so the day's
 * record exists without anyone having a browser open. Accepts an optional
 * `date` (YYYY-MM-DD) to regenerate a past day.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/hooks/daily-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        const date = new URL(request.url).searchParams.get("date");
        const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
        try {
          const { generateDailyReport } = await import("@/lib/reports.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: workspaces, error } = await (supabaseAdmin as any)
            .from("workspaces")
            .select("id");
          if (error) throw new Error(error.message);

          const results = await Promise.all(
            ((workspaces ?? []) as { id: string }[]).map(async (w) => {
              try {
                const report = await generateDailyReport(validDate, w.id);
                return {
                  workspaceId: w.id,
                  ok: true,
                  id: report.id,
                  date: report.reportDate,
                  status: report.status,
                  mentions: report.metrics.mentions,
                  campaigns: report.campaigns.total,
                };
              } catch (err) {
                console.error(`Daily report generation failed for workspace ${w.id}`, err);
                return { workspaceId: w.id, ok: false, error: (err as Error).message };
              }
            }),
          );
          return Response.json({ ok: true, workspaces: results });
        } catch (err) {
          console.error("Daily report generation failed", err);
          return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
