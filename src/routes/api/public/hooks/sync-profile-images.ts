import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * One-off / scheduled: push every linked account's stored portrait and cover
 * image onto the live X profile. No UI control - server-side only.
 */
const bodySchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(20).default(5),
});

export const Route = createFileRoute("/api/public/hooks/sync-profile-images")({
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

        let parsed: { offset: number; limit: number };
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          parsed = { offset: 0, limit: 5 };
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const twitter = await import("@/lib/twitterapi.server");

        const { data, error } = await supabaseAdmin
          .from("x_accounts")
          .select("id, handle, auth_token, proxy, avatar_url, background_url")
          .eq("is_active", true)
          .order("handle");
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const accounts = (data ?? []).filter((a) => Boolean(a.auth_token) && Boolean(a.avatar_url));
        const slice = accounts.slice(parsed.offset, parsed.offset + parsed.limit);

        let avatarOk = 0;
        let bannerOk = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const acc of slice) {
          const posting = {
            id: acc.id,
            handle: acc.handle,
            loginCookies: acc.auth_token,
            proxy: acc.proxy,
          };

          const av = await twitter.updateAvatarFromUrl(posting, acc.avatar_url as string);
          if (av.ok) avatarOk += 1;
          else {
            failed += 1;
            if (errors.length < 5) errors.push(`${acc.handle} avatar: ${av.error ?? "?"}`);
          }

          if (acc.background_url) {
            const bn = await twitter.updateBannerFromUrl(posting, acc.background_url);
            if (bn.ok) bannerOk += 1;
            else if (errors.length < 5) errors.push(`${acc.handle} banner: ${bn.error ?? "?"}`);
          }

          await twitter.sleep(500 + Math.floor(Math.random() * 700));
        }

        const next = parsed.offset + slice.length;
        return new Response(
          JSON.stringify({
            total: accounts.length,
            processed: next,
            nextOffset: next < accounts.length ? next : null,
            avatarOk,
            bannerOk,
            failed,
            errors,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
