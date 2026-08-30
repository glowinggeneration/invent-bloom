import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccountDirectoryEntry = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
};

export const listAccountDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountDirectoryEntry[]> => {
    const { data, error } = await context.supabase
      .from("x_accounts")
      .select("id, handle, display_name, persona_label, avatar_url, is_verified")
      .order("handle");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      handle: r.handle,
      displayName: r.display_name || r.persona_label || r.handle,
      avatarUrl: r.avatar_url ?? null,
      isVerified: r.is_verified ?? false,
    }));
  });
