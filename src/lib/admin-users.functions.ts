import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./access";
import { logAuditEventAsCaller } from "./platform/audit-log.server";

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

/** Grants or revokes team-workspace membership. Admin-only. */
export const setUserOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; org: "team" | "external" }) => {
    if (!data?.userId) throw new Error("Missing user.");
    if (data.org !== "team" && data.org !== "external") throw new Error("Invalid org value.");
    return data;
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ org: data.org })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAuditEventAsCaller(context.supabase, {
      action: "account.status_change",
      resourceTable: "profiles",
      resourceId: data.userId,
      metadata: { org: data.org },
    });
    return { ok: true as const };
  });

export type AdminWorkspace = {
  id: string;
  name: string;
  planTier: string;
  status: string;
  ownerEmail: string | null;
  memberCount: number;
  accountCount: number;
  createdAt: string;
};

/** Cross-tenant: every workspace on the platform, for the SaaS-owner view. */
export const listAllWorkspaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminWorkspace[]> => {
    assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: workspaces, error } = await admin
      .from("workspaces")
      .select("id, name, plan_tier, status, owner_user_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (workspaces ?? []).map((w: any) => w.id as string);
    const ownerIds = [
      ...new Set((workspaces ?? []).map((w: any) => w.owner_user_id).filter(Boolean)),
    ];

    const [membersRes, accountsRes, ownersRes] = await Promise.all([
      ids.length
        ? admin.from("workspace_members").select("workspace_id").in("workspace_id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? admin.from("x_accounts").select("workspace_id").in("workspace_id", ids)
        : Promise.resolve({ data: [] }),
      ownerIds.length
        ? admin.from("profiles").select("id, email").in("id", ownerIds)
        : Promise.resolve({ data: [] }),
    ]);

    const memberCounts = new Map<string, number>();
    for (const r of (membersRes.data ?? []) as { workspace_id: string }[]) {
      memberCounts.set(r.workspace_id, (memberCounts.get(r.workspace_id) ?? 0) + 1);
    }
    const accountCounts = new Map<string, number>();
    for (const r of (accountsRes.data ?? []) as { workspace_id: string }[]) {
      accountCounts.set(r.workspace_id, (accountCounts.get(r.workspace_id) ?? 0) + 1);
    }
    const emailByOwner = new Map(
      ((ownersRes.data ?? []) as { id: string; email: string }[]).map((p) => [p.id, p.email]),
    );

    return (workspaces ?? []).map((w: any) => ({
      id: w.id,
      name: w.name || "Workspace",
      planTier: w.plan_tier,
      status: w.status,
      ownerEmail: w.owner_user_id ? (emailByOwner.get(w.owner_user_id) ?? null) : null,
      memberCount: memberCounts.get(w.id) ?? 0,
      accountCount: accountCounts.get(w.id) ?? 0,
      createdAt: w.created_at,
    }));
  });

/** Cross-tenant: admin-set plan change. No payment processor - just the shape. */
export const updateWorkspacePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        planTier: z.enum(["free", "pro", "enterprise"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("workspaces")
      .update({ plan_tier: data.planTier, updated_at: new Date().toISOString() })
      .eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    await logAuditEventAsCaller(context.supabase, {
      action: "config.change",
      resourceTable: "workspaces",
      resourceId: data.workspaceId,
      metadata: { planTier: data.planTier },
    });
    return { ok: true as const };
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
    await logAuditEventAsCaller(context.supabase, {
      action: "account.password_reset",
      resourceTable: "auth.users",
      resourceId: data.userId,
    });
    return { ok: true as const };
  });
