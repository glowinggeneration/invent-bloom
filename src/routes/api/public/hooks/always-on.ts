import { createFileRoute } from "@tanstack/react-router";

/**
 * Always-on editorial planning cron. Called by pg_cron with the project
 * publishable key in the `apikey` header.
 *
 * - `action: "plan"` builds the day's draft plan for always-on accounts.
 * - automatic background publishing is intentionally disabled. A reviewer
 *   must publish an approved post explicitly from the authenticated workspace.
 */
export const Route = createFileRoute("/api/public/hooks/always-on")({
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

        let action = "plan";
        let maxAccounts = 12;
        try {
          const body = (await request.json()) as { action?: string; maxAccounts?: number };
          if (typeof body?.action === "string") action = body.action;
          if (typeof body?.maxAccounts === "number") {
            maxAccounts = Math.min(40, Math.max(1, Math.round(body.maxAccounts)));
          }
        } catch {
          // No body means plan drafts only.
        }

        if (action !== "plan") {
          return Response.json({
            ok: true,
            action,
            automaticPublishing: false,
            message:
              "Always-on background publishing is disabled. Review an individual planned post in the authenticated workspace and publish it explicitly.",
            results: [],
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: owners, error } = await supabaseAdmin
          .from("x_accounts")
          .select("user_id")
          .eq("always_on", true)
          .eq("is_active", true);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const userIds = [...new Set((owners ?? []).map((r: { user_id: string }) => r.user_id))];
        const { runDailyPlanning } = await import("@/lib/always-on-planner.server");

        const results: Record<string, unknown>[] = [];
        for (const userId of userIds) {
          try {
            const plans = await runDailyPlanning({ userId, maxAccounts });
            results.push({
              userId,
              accountsPlanned: plans.length,
              planned: plans.reduce((n, p) => n + p.posts.length, 0),
            });
          } catch (e) {
            results.push({ userId, error: (e as Error).message });
          }
        }

        return Response.json({ ok: true, action: "plan", automaticPublishing: false, results });
      },
    },
  },
});
