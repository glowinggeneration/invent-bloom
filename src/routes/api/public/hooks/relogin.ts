import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Server-only maintenance job: re-log accounts in with password + TOTP so we
 * hold genuine `login_cookies` (required by X profile-write endpoints), then
 * optionally push the stored persona name, bio, Kenya location, avatar and
 * banner onto the live profile. No UI control.
 */
const bodySchema = z.object({
  accounts: z
    .array(
      z.object({
        username: z.string().min(1).max(50),
        password: z.string().min(1).max(200),
        email: z.string().max(200).default(""),
        totpSecret: z.string().max(64).default(""),
      }),
    )
    .min(1)
    .max(10),
  sync: z.boolean().default(true),
});

export const Route = createFileRoute("/api/public/hooks/relogin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch (e) {
          return new Response(JSON.stringify({ error: (e as Error).message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const twitter = await import("@/lib/twitterapi.server");
        // TODO(Phase 3): shared background maintenance job, not a single
        // request's context - see workspace.server.ts.
        const { LEGACY_SINGLE_WORKSPACE_ID } = await import("@/lib/workspace.server");
        const proxy = (process.env["DEFAULT_TWITTER_PROXY"] ?? "").trim();

        const results: Array<Record<string, unknown>> = [];

        for (const cred of parsed.accounts) {
          const login = await twitter.loginAccount({
            userName: cred.username,
            ...(cred.email ? { email: cred.email } : {}),
            password: cred.password,
            proxy,
            ...(cred.totpSecret ? { totpSecret: cred.totpSecret } : {}),
          });

          if ("error" in login) {
            results.push({ handle: cred.username, loggedIn: false, error: login.error });
            await twitter.sleep(800);
            continue;
          }

          const { data: row } = await (supabaseAdmin as any)
            .from("x_accounts")
            .select("id, handle, display_name, bio, avatar_url, background_url")
            .eq("workspace_id", LEGACY_SINGLE_WORKSPACE_ID)
            .eq("handle", cred.username)
            .maybeSingle();

          if (row) {
            await supabaseAdmin
              .from("x_accounts")
              .update({ auth_token: login.loginCookies, is_active: true })
              .eq("id", row.id);
          }

          const entry: Record<string, unknown> = { handle: cred.username, loggedIn: true };

          if (parsed.sync && row) {
            const account = {
              id: row.id,
              handle: row.handle,
              loginCookies: login.loginCookies,
              proxy,
            };

            const profile = await twitter.updateProfileDisplayName(
              account,
              row.display_name || row.handle,
              (row.bio ?? "").slice(0, 160),
              "Kenya",
            );
            entry["profile"] = profile.ok ? "ok" : profile.error;

            if (row.avatar_url) {
              const av = await twitter.updateAvatarFromUrl(account, row.avatar_url);
              entry["avatar"] = av.ok ? "ok" : av.error;
            }
            if (row.background_url) {
              const bn = await twitter.updateBannerFromUrl(account, row.background_url);
              entry["banner"] = bn.ok ? "ok" : bn.error;
            }
          }

          results.push(entry);
          await twitter.sleep(1000);
        }

        return new Response(JSON.stringify({ results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
