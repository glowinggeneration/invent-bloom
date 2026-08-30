import { createServerFn } from "@tanstack/react-start";
import { assertAdmin } from "./access";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Fetch abstract Unsplash artwork for connected X accounts that don't have a
 * profile picture yet. Unsplash's free tier allows 50 requests/hour, so this
 * runs in small batches and caches every result on the account row.
 */
export const syncAccountImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(30).default(12),
        refreshAll: z.boolean().default(false),
      })
      .parse(input ?? {}),
  )
  .handler(
    async ({ data, context }): Promise<{ updated: number; remaining: number; error?: string }> => {
      assertAdmin(context as any);
      const { portraitQuery, searchUnsplash } = await import("./unsplash.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = supabaseAdmin as any;

      const { data: rows, error } = await admin
        .from("x_accounts")
        .select("id, handle, display_name, persona_label, avatar_url, background_url")

        .order("handle");
      if (error) throw new Error(error.message);

      const pending = (rows ?? []).filter(
        (r: any) => data.refreshAll || !r.avatar_url || !r.background_url,
      );
      const batch = pending.slice(0, data.limit);
      let updated = 0;
      let failure: string | undefined;

      const covers = [
        "nairobi kenya city skyline",
        "kenya landscape savannah",
        "football stadium crowd kenya",
        "mount kenya scenery",
        "kenya coast beach sunset",
      ];

      for (const [index, account] of batch.entries()) {
        // A linked account's portrait is permanent - once it has one we never
        // replace it, even on a full refresh. Only missing pieces are filled.
        const needsAvatar = !account.avatar_url;
        const needsCover = !account.background_url || data.refreshAll;
        if (!needsAvatar && !needsCover) continue;

        const query = portraitQuery({
          vibe: account.persona_label || account.display_name || account.handle,
          segment: "",
        });
        try {
          const photo = needsAvatar
            ? await searchUnsplash(query, account.handle.length + index, "portrait")
            : null;
          const coverQuery = covers[(account.handle.length + index) % covers.length]!;
          const cover = needsCover
            ? await searchUnsplash(coverQuery, account.handle.length + index * 3, "landscape")
            : null;
          if (!photo && !cover) continue;
          const { error: upErr } = await admin
            .from("x_accounts")
            .update({
              ...(photo
                ? {
                    avatar_url: photo.avatarUrl,
                    avatar_color: photo.color,
                    avatar_credit_name: photo.photographerName,
                    avatar_credit_url: photo.photographerUrl,
                  }
                : {}),
              ...(cover
                ? { background_url: cover.backgroundUrl }
                : photo
                  ? { background_url: photo.backgroundUrl }
                  : {}),
            })
            .eq("id", account.id);
          if (upErr) throw new Error(upErr.message);
          updated += 1;
        } catch (e) {
          failure = (e as Error).message;
          break;
        }
      }

      return {
        updated,
        remaining: Math.max(0, pending.length - updated),
        ...(failure ? { error: failure } : {}),
      };
    },
  );
