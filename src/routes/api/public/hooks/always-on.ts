import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Always-on editorial planning cron. Called by pg_cron with the shared cron
 * secret in the `authorization: Bearer` header.
 *
 * - `action: "plan"` builds the day's draft plan for always-on accounts.
 * - automatic background publishing is intentionally disabled. A reviewer
 *   must publish an approved post explicitly from the authenticated workspace.
 */
export const Route = createFileRoute("/api/public/hooks/always-on")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

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
        // Background/cron context, not a single request's session - resolve
        // (userId, workspaceId) pairs directly from x_accounts (which already
        // carries workspace_id) rather than a per-request workspace resolver.
        const { data: owners, error } = await (supabaseAdmin as any)
          .from("x_accounts")
          .select("user_id, workspace_id")
          .eq("always_on", true)
          .eq("is_active", true);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const pairs = new Map<string, string>();
        for (const r of (owners ?? []) as { user_id: string; workspace_id: string }[]) {
          pairs.set(r.user_id, r.workspace_id);
        }
        const { runDailyPlanning } = await import("@/lib/always-on-planner.server");

        const results: Record<string, unknown>[] = [];
        for (const [userId, workspaceId] of pairs) {
          try {
            const plans = await runDailyPlanning({ userId, workspaceId, maxAccounts });
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
