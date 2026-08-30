import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Drafts a suggested reply and objective for a tweet the team wants to answer. */
export const suggestReplyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        targetUrl: z.string().min(5).max(400),
        guidance: z.string().max(600).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { suggestReply } = await import("./reply-suggestion.server");
    return suggestReply({ targetUrl: data.targetUrl, guidance: data.guidance ?? null });
  });
