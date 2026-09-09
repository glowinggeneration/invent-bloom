import { createFileRoute } from "@tanstack/react-router";

/**
 * Drains persona actions whose scheduled time has arrived. Called by pg_cron
 * every few minutes with the project publishable key in the `apikey` header.
 *
 * The workspace emergency pause is checked at this execution boundary so
 * queued work cannot run while an administrator has stopped campaigns.
 */
export const Route = createFileRoute("/api/public/hooks/scheduled-actions")({
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

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // TODO(Phase 3): shared background maintenance job, not a single
        // request's context - see workspace.server.ts.
        const { LEGACY_SINGLE_WORKSPACE_ID } = await import("@/lib/workspace.server");

        try {
          const { data: executionState, error: stateError } = await (supabaseAdmin as any)
            .from("workspace_execution_state")
            .select("paused, reason, paused_at")
            .eq("workspace_id", LEGACY_SINGLE_WORKSPACE_ID)
            .maybeSingle();
          if (stateError) throw new Error(stateError.message);

          if (executionState?.paused) {
            return Response.json({
              ok: true,
              paused: true,
              reason: executionState.reason || "Workspace execution is paused",
              pausedAt: executionState.paused_at ?? null,
              picked: 0,
              succeeded: 0,
              failed: 0,
              retried: 0,
            });
          }

          const { runDueScheduledActions } = await import("@/lib/scheduler.server");
          const summary = await runDueScheduledActions({ admin: supabaseAdmin as any, limit: 60 });
          return Response.json({ ok: true, paused: false, ...summary });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
