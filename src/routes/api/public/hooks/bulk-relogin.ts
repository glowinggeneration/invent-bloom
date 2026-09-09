import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Bulk re-login maintenance job.
 *
 * Personas were renamed on X after their credentials were first imported, so
 * the stored rows in `x_login_attempts` still carry the original username.
 * This job resolves each saved credential to the account's CURRENT handle
 * (matching on handle, previous handle, then persona label), logs in again
 * with the new username plus the saved email/password/TOTP secret, and stores
 * fresh `login_cookies` on `x_accounts`.
 */
const bodySchema = z.object({
  /** Only re-login accounts whose handles are listed (default: all). */
  handles: z.array(z.string().max(50)).max(200).default([]),
  /** Skip accounts that already hold a session. */
  onlyMissing: z.boolean().default(false),
  /** Skip accounts flagged suspended in the workspace. */
  skipSuspended: z.boolean().default(false),
  /** Which username to present to X: the current handle, the original one, or the email. */
  identity: z.enum(["auto", "current", "original", "email"]).default("auto"),
  limit: z.number().int().min(1).max(200).default(25),
  offset: z.number().int().min(0).default(0),
});

type Cred = {
  handle: string;
  email: string;
  password: string;
  totp_secret: string;
  persona_label: string;
};

type Account = {
  id: string;
  handle: string;
  previous_handle: string | null;
  persona_label: string | null;
  auth_token: string | null;
  suspended: boolean | null;
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export const Route = createFileRoute("/api/public/hooks/bulk-relogin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || apikey !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json().catch(() => ({})));
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const twitter = await import("@/lib/twitterapi.server");
        // TODO(Phase 3): shared background maintenance job, not a single
        // request's context - see workspace.server.ts.
        const { LEGACY_SINGLE_WORKSPACE_ID } = await import("@/lib/workspace.server");
        const proxy = (process.env["DEFAULT_TWITTER_PROXY"] ?? "").trim();

        const { data: accountRows, error: accErr } = await (supabaseAdmin as any)
          .from("x_accounts")
          .select("id, handle, previous_handle, persona_label, auth_token, suspended")
          .eq("workspace_id", LEGACY_SINGLE_WORKSPACE_ID)
          .order("handle");
        if (accErr) return Response.json({ error: accErr.message }, { status: 500 });

        const { data: credRows, error: credErr } = await (supabaseAdmin as any)
          .from("x_login_attempts")
          .select("handle, email, password, totp_secret, persona_label")
          .eq("workspace_id", LEGACY_SINGLE_WORKSPACE_ID);
        if (credErr) return Response.json({ error: credErr.message }, { status: 500 });

        const creds = (credRows ?? []) as Cred[];
        const byHandle = new Map(creds.map((c) => [norm(c.handle), c]));
        const byLabel = new Map(creds.map((c) => [norm(c.persona_label), c]));

        const wanted = new Set(body.handles.map(norm));
        let accounts = (accountRows ?? []) as Account[];
        if (wanted.size) accounts = accounts.filter((a) => wanted.has(norm(a.handle)));
        if (body.onlyMissing) accounts = accounts.filter((a) => !a.auth_token);
        if (body.skipSuspended) accounts = accounts.filter((a) => !a.suspended);
        accounts = accounts.slice(body.offset, body.offset + body.limit);

        const results: Record<string, unknown>[] = [];

        for (const account of accounts) {
          const cred =
            byHandle.get(norm(account.handle)) ??
            byHandle.get(norm(account.previous_handle)) ??
            byLabel.get(norm(account.persona_label));

          if (!cred || !cred.password) {
            results.push({ handle: account.handle, ok: false, error: "No saved credentials." });
            continue;
          }

          // X denies the old username once a persona has been renamed, so we
          // try the email identity as well before giving up.
          const identities =
            body.identity === "auto"
              ? [account.handle, cred.email, cred.handle].filter(Boolean)
              : [
                  body.identity === "original"
                    ? cred.handle
                    : body.identity === "email"
                      ? cred.email || account.handle
                      : account.handle,
                ];

          let login: Awaited<ReturnType<typeof twitter.loginAccount>> = {
            error: "No credentials to try.",
          };
          for (const identity of identities) {
            login = await twitter.loginAccount({
              userName: identity,
              ...(cred.email ? { email: cred.email } : {}),
              password: cred.password,
              proxy,
              ...(cred.totp_secret ? { totpSecret: cred.totp_secret } : {}),
            });
            if (!("error" in login)) break;
            await twitter.sleep(800);
          }

          if ("error" in login) {
            results.push({
              handle: account.handle,
              ok: false,
              from: cred.handle,
              error: login.error.slice(0, 200),
            });
            await twitter.sleep(1200);
            continue;
          }

          await (supabaseAdmin as any)
            .from("x_accounts")
            .update({
              auth_token: login.loginCookies,
              is_active: true,
              suspended: false,
              ...(proxy ? { proxy } : {}),
            })
            .eq("id", account.id);

          results.push({ handle: account.handle, ok: true, from: cred.handle });
          await twitter.sleep(1200);
        }

        return Response.json({
          ok: true,
          attempted: results.length,
          succeeded: results.filter((r) => r["ok"]).length,
          results,
        });
      },
    },
  },
});
