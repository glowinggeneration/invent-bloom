import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./access";

export type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  org: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
};

export const listAllUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const users: AdminUser[] = [];
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        users.push({
          id: u.id,
          email: u.email ?? "",
          fullName: (u.user_metadata?.["full_name"] as string | undefined) ?? null,
          org: null,
          createdAt: u.created_at ?? null,
          lastSignInAt: u.last_sign_in_at ?? null,
        });
      }
      if (data.users.length < 200) break;
    }

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, org");
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    for (const u of users) {
      const p = byId.get(u.id);
      if (p) {
        u.fullName = p.full_name ?? u.fullName;
        u.org = p.org ?? null;
      }
    }

    return users.sort((a, b) => a.email.localeCompare(b.email));
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; password: string }) => {
    if (!data?.userId) throw new Error("Missing user.");
    if (!data.password || data.password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
