/**
 * Server functions dedicated to the /campaign/engage module: like / repost /
 * bookmark a set of tweet links using a chosen subset of persona accounts,
 * either immediately or scattered across a spread window.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const actionsSchema = z
  .object({
    like: z.boolean().default(true),
    retweet: z.boolean().default(true),
    bookmark: z.boolean().default(true),
  })
  .default({ like: true, retweet: true, bookmark: true });

/** Run the engagement immediately with the selected personas. */
export const runEngageLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tweetUrls: z.array(z.string().trim().min(5)).min(1).max(50),
        accountIds: z.array(z.string().uuid()).min(1).max(500),
        actions: actionsSchema,
        name: z.string().trim().max(80).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { engageLinksWithAccounts } = await import("./engage.server");
    return engageLinksWithAccounts(
      context.userId,
      data.tweetUrls,
      data.accountIds,
      data.actions,
      data.name,
    );
  });

/** Queue the engagement across a spread window (or a fixed per-action delay). */
export const scheduleEngageLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tweetUrls: z.array(z.string().trim().min(5)).min(1).max(50),
        accountIds: z.array(z.string().uuid()).min(1).max(500),
        actions: actionsSchema,
        spreadHours: z.number().int().min(0).max(48).default(0),
        delaySeconds: z.number().int().min(0).max(3600).default(0),
        smartDelay: z.boolean().default(true),
        name: z.string().trim().max(80).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ scheduled: number }> => {
    const { scheduleEngageActions } = await import("./engage.server");
    return scheduleEngageActions(context.userId, data);
  });
