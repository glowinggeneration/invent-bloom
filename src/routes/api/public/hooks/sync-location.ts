import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * One-off / scheduled: set the X profile location to "Kenya" for every linked
 * account. Server-side only, no UI control.
 */
const bodySchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(25).default(10),
});

export const Route = createFileRoute("/api/public/hooks/sync-location")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        let parsed: { offset: number; limit: number };
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          parsed = { offset: 0, limit: 10 };
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const twitter = await import("@/lib/twitterapi.server");
        // TODO(Phase 3): shared background maintenance job, not a single
        // request's context - see workspace.server.ts.
        const { LEGACY_SINGLE_WORKSPACE_ID } = await import("@/lib/workspace.server");

        const { data, error } = await (supabaseAdmin as any)
          .from("x_accounts")
          .select("id, handle, display_name, auth_token, proxy")
          .eq("workspace_id", LEGACY_SINGLE_WORKSPACE_ID)
          .eq("is_active", true)
          .order("handle");
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const accounts = (data ?? []).filter((a: any) => Boolean(a.auth_token));
        const slice = accounts.slice(parsed.offset, parsed.offset + parsed.limit);

        let ok = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const acc of slice) {
          const res = await twitter.updateProfileDisplayName(
            {
              id: acc.id,
              handle: acc.handle,
              loginCookies: acc.auth_token,
              proxy: acc.proxy,
            },
            acc.display_name || acc.handle,
            undefined,
            "Kenya",
          );
          if (res.ok) ok += 1;
          else {
            failed += 1;
            if (errors.length < 5) errors.push(`${acc.handle}: ${res.error ?? "?"}`);
          }
          await twitter.sleep(500 + Math.floor(Math.random() * 700));
        }

        const next = parsed.offset + slice.length;
        return new Response(
          JSON.stringify({
            total: accounts.length,
            processed: next,
            nextOffset: next < accounts.length ? next : null,
            ok,
            failed,
            errors,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
