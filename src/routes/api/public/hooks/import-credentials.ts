import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Server-only maintenance job: park persona sign-in credentials (password +
 * TOTP secret) against the matching x_accounts row so the re-login job can be
 * retried without re-uploading the order files. No UI control.
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
    .max(500),
  note: z.string().max(300).default(""),
});

export const Route = createFileRoute("/api/public/hooks/import-credentials")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

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
        const proxy = (process.env["DEFAULT_TWITTER_PROXY"] ?? "").trim();

        const { data: accounts } = await (supabaseAdmin as any)
          .from("x_accounts")
          .select("id, user_id, handle, previous_handle, persona_label, proxy");

        // Personas get renamed on X, so a saved credential may match either the
        // current handle or the one it was imported under.
        const byHandle = new Map<string, any>();
        for (const a of (accounts ?? []) as any[]) {
          byHandle.set(String(a.handle).toLowerCase(), a);
          if (a.previous_handle) {
            const k = String(a.previous_handle).toLowerCase();
            if (!byHandle.has(k)) byHandle.set(k, a);
          }
        }

        const rows: Array<Record<string, unknown>> = [];
        const unmatched: string[] = [];

        for (const cred of parsed.accounts) {
          const account = byHandle.get(cred.username.toLowerCase());
          if (!account) {
            unmatched.push(cred.username);
            continue;
          }
          rows.push({
            user_id: account.user_id,
            handle: account.handle,
            email: cred.email,
            password: cred.password,
            totp_secret: cred.totpSecret,
            proxy: account.proxy || proxy,
            persona_label: account.persona_label,
            status: "pending_relogin",
            error: parsed.note || null,
          });
        }

        let stored = 0;
        let failure: string | null = null;
        for (let i = 0; i < rows.length; i += 50) {
          const chunk = rows.slice(i, i + 50);
          const { error } = await supabaseAdmin
            .from("x_login_attempts")
            .upsert(chunk as never, { onConflict: "user_id,handle" });
          if (error) {
            failure = error.message;
            break;
          }
          stored += chunk.length;
        }

        return new Response(JSON.stringify({ stored, unmatched, error: failure }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
