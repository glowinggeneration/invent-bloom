/**
 * Server functions for the /campaign/follow module: follow one or more handles
 * with a chosen subset of persona accounts, now or on a spread window.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const handlesSchema = z.array(z.string().trim().min(1).max(120)).min(1).max(25);

/** Follow the target handles immediately with the selected personas. */
export const runFollowTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        handles: handlesSchema,
        accountIds: z.array(z.string().uuid()).min(1).max(500),
        name: z.string().trim().max(80).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { followHandlesWithAccounts } = await import("./follow.server");
    return followHandlesWithAccounts(context.userId, data.handles, data.accountIds, data.name);
  });

/** Queue the follows across a spread window (or a fixed per-action delay). */
export const scheduleFollowTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        handles: handlesSchema,
        accountIds: z.array(z.string().uuid()).min(1).max(500),
        spreadHours: z.number().int().min(0).max(48).default(0),
        delaySeconds: z.number().int().min(0).max(3600).default(0),
        smartDelay: z.boolean().default(true),
        name: z.string().trim().max(80).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ scheduled: number }> => {
    const { scheduleFollowActions } = await import("./follow.server");
    return scheduleFollowActions(context.userId, data);
  });
