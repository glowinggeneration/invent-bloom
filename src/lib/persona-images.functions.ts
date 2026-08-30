import { createServerFn } from "@tanstack/react-start";
import { assertAdmin } from "./access";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PersonaImage = {
  personaId: string;
  avatarUrl: string;
  backgroundUrl: string;
  color: string | null;
  photographerName: string;
  photographerUrl: string;
};

/** Cached Unsplash artwork for every persona that has been resolved so far. */
export const listPersonaImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PersonaImage[]> => {
    const { data, error } = await context.supabase
      .from("persona_images")
      .select("persona_id, avatar_url, background_url, color, photographer_name, photographer_url");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      personaId: r.persona_id,
      avatarUrl: r.avatar_url,
      backgroundUrl: r.background_url,
      color: r.color,
      photographerName: r.photographer_name,
      photographerUrl: r.photographer_url,
    }));
  });

/**
 * Fetch Unsplash artwork for personas that don't have any yet.
 * Unsplash's free tier allows 50 requests/hour, so this runs in small batches
 * and caches every result in the database.
 */
export const syncPersonaImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(30).default(12) }).parse(input),
  )
  .handler(
    async ({ data, context }): Promise<{ added: number; remaining: number; error?: string }> => {
      assertAdmin(context as any);
      const { PERSONAS } = await import("./personas");
      const { personaQuery, portraitQuery, searchUnsplash } = await import("./unsplash.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = supabaseAdmin as any;

      const { data: existing, error } = await admin
        .from("persona_images")
        .select("persona_id, query");
      if (error) throw new Error(error.message);
      // Personas must show real people: rows created before that rule (their
      // stored query isn't a portrait search) get refreshed.
      const have = new Set(
        (existing ?? [])
          .filter((r: any) => String(r.query ?? "").startsWith("portrait"))
          .map((r: any) => r.persona_id as string),
      );

      const missing = PERSONAS.filter((p) => !have.has(p.id));
      const batch = missing.slice(0, data.limit);
      let added = 0;
      let failure: string | undefined;

      for (const [index, persona] of batch.entries()) {
        const query = portraitQuery(persona);
        try {
          const photo = await searchUnsplash(query, persona.name.length + index, "portrait");
          if (!photo) continue;
          const cover = await searchUnsplash(
            personaQuery(persona),
            persona.name.length + index * 2,
            "landscape",
          );
          const { error: upErr } = await admin.from("persona_images").upsert(
            {
              persona_id: persona.id,
              query,
              avatar_url: photo.avatarUrl,
              background_url: (cover ?? photo).backgroundUrl,
              color: photo.color,
              photographer_name: photo.photographerName,
              photographer_url: photo.photographerUrl,
              unsplash_id: photo.id,
            },
            { onConflict: "persona_id" },
          );
          if (upErr) throw new Error(upErr.message);
          added += 1;
        } catch (e) {
          failure = (e as Error).message;
          break;
        }
      }

      void context.userId;
      return {
        added,
        remaining: Math.max(0, missing.length - added),
        ...(failure ? { error: failure } : {}),
      };
    },
  );
