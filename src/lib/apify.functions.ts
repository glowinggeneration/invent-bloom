import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Verifies the Apify token with a real authenticated API call. */
export const testApifyConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { checkApifyConnection } = await import("./apify.server");
    return checkApifyConnection();
  });
