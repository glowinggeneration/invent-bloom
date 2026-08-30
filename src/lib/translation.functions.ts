/**
 * Client-callable translation endpoint. Batches are translated in one call so
 * a feed of mentions costs a single round-trip.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const translateTexts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        texts: z.array(z.string()).min(1).max(40),
        targetLanguage: z.string().trim().min(2).max(40),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { aiTranslate } = await import("./translation.server");
    const translations = await aiTranslate(data.texts, data.targetLanguage);
    return { translations };
  });
