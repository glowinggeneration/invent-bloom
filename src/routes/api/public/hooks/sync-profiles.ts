import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Push everything stored on the dashboard for each persona (display name, bio,
 * Kenya location, portrait, cover image) onto the live X profile in one pass.
 * Uses twitterapi.io v2 profile endpoints: update_profile_v2, update_avatar_v2
 * and update_banner_v2. Server-side only, no UI control.
 */
const bodySchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(25).default(8),
  handles: z.array(z.string().min(1).max(50)).max(50).default([]),
});

/** Unsplash lets us ask for exactly the sizes X recommends. */
function sized(url: string, w: number, h: number): string {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("unsplash")) return url;
    u.searchParams.set("w", String(w));
    u.searchParams.set("h", String(h));
    u.searchParams.set("fit", "crop");
    u.searchParams.set("q", "80");
    u.searchParams.set("fm", "jpg");
    return u.toString();
  } catch {
    return url;
  }
}

export const Route = createFileRoute("/api/public/hooks/sync-profiles")({
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
        } catch {
          parsed = { offset: 0, limit: 8, handles: [] };
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const twitter = await import("@/lib/twitterapi.server");

        const { data, error } = await supabaseAdmin
          .from("x_accounts")
          .select("id, handle, display_name, bio, auth_token, proxy, avatar_url, background_url")
          .eq("is_active", true)
          .order("handle");
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const wanted = new Set(parsed.handles.map((h) => h.replace(/^@/, "").toLowerCase()));
        const accounts = (data ?? [])
          .filter((a) => Boolean(a.auth_token))
          .filter((a) => wanted.size === 0 || wanted.has(a.handle.toLowerCase()));
        const slice = accounts.slice(parsed.offset, parsed.offset + parsed.limit);

        const results: Array<Record<string, unknown>> = [];

        for (const acc of slice) {
          const posting = {
            id: acc.id,
            handle: acc.handle,
            loginCookies: acc.auth_token,
            proxy: acc.proxy,
          };
          const entry: Record<string, unknown> = { handle: acc.handle };

          const profile = await twitter.updateProfileDisplayName(
            posting,
            acc.display_name || acc.handle,
            (acc.bio ?? "").slice(0, 160) || undefined,
            "Kenya",
          );
          entry["profile"] = profile.ok ? "ok" : (profile.error ?? "failed");

          if (acc.avatar_url) {
            await twitter.sleep(400);
            const av = await twitter.updateAvatarFromUrl(posting, sized(acc.avatar_url, 400, 400));
            entry["avatar"] = av.ok ? "ok" : (av.error ?? "failed");
          }

          if (acc.background_url) {
            await twitter.sleep(400);
            const bn = await twitter.updateBannerFromUrl(
              posting,
              sized(acc.background_url, 1500, 500),
            );
            entry["banner"] = bn.ok ? "ok" : (bn.error ?? "failed");
          }

          results.push(entry);
          await twitter.sleep(600 + Math.floor(Math.random() * 600));
        }

        const next = parsed.offset + slice.length;
        const okCount = results.filter((r) => r["profile"] === "ok").length;

        return new Response(
          JSON.stringify({
            total: accounts.length,
            processed: next,
            nextOffset: next < accounts.length ? next : null,
            profileOk: okCount,
            results,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
