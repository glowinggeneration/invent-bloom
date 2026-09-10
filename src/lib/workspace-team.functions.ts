/**
 * Per-workspace team, plan and usage — the customer-facing counterpart to
 * admin-users.functions.ts's cross-tenant view. Every handler here is
 * scoped to the caller's own workspace; nothing crosses workspace
 * boundaries.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAuditEventAsCaller } from "./platform/audit-log.server";
import { resolveWorkspaceId } from "./workspace.server";

export type WorkspaceRole = "owner" | "admin" | "member";

export type WorkspaceMember = {
  userId: string;
  email: string;
  fullName: string | null;
  role: WorkspaceRole;
  joinedAt: string;
};

export type WorkspaceUsage = {
  accounts: number;
  seats: number;
  keywords: number;
  aiCallsThisMonth: number;
};

export type WorkspacePlanLimits = {
  tier: string;
  label: string;
  maxAccounts: number;
  maxSeats: number;
  maxKeywords: number;
  maxAiCallsMonth: number;
  /** null means custom/"contact us" pricing, not zero. */
  monthlyPriceUsd: number | null;
};

export type WorkspaceOverview = {
  id: string;
  name: string;
  planTier: string;
  status: string;
  createdAt: string;
  callerRole: WorkspaceRole;
  members: WorkspaceMember[];
  usage: WorkspaceUsage;
  limits: WorkspacePlanLimits;
};

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export const getWorkspaceOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceOverview> => {
    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: workspace, error: wsError } = await admin
      .from("workspaces")
      .select("id, name, plan_tier, status, created_at")
      .eq("id", workspaceId)
      .single();
    if (wsError) throw new Error(wsError.message);

    const { data: memberRows, error: memberError } = await admin
      .from("workspace_members")
      .select("user_id, role, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });
    if (memberError) throw new Error(memberError.message);

    const memberIds = (memberRows ?? []).map((m: any) => m.user_id as string);
    const { data: profileRows } = memberIds.length
      ? await admin.from("profiles").select("id, email, full_name").in("id", memberIds)
      : { data: [] };
    const profileById = new Map<string, any>((profileRows ?? []).map((p: any) => [p.id, p]));

    const members: WorkspaceMember[] = (memberRows ?? []).map((m: any) => {
      const p = profileById.get(m.user_id);
      return {
        userId: m.user_id,
        email: p?.email ?? "",
        fullName: p?.full_name ?? null,
        role: m.role,
        joinedAt: m.created_at,
      };
    });

    const caller = members.find((m) => m.userId === context.userId);
    const callerRole: WorkspaceRole = caller?.role ?? "member";

    const monthStart = monthStartIso();
    const [accountsRes, keywordsRes, aiEventsRes, limitsRes] = await Promise.all([
      admin
        .from("x_accounts")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      admin
        .from("mention_keywords")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("is_active", true),
      admin
        .from("ai_events")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", monthStart),
      admin.from("plan_limits").select("*").eq("tier", workspace.plan_tier).maybeSingle(),
    ]);

    const limits = limitsRes.data ?? {
      tier: workspace.plan_tier,
      label: workspace.plan_tier,
      max_accounts: 0,
      max_seats: 0,
      max_keywords: 0,
      max_ai_calls_month: 0,
      monthly_price_usd: null,
    };

    return {
      id: workspace.id,
      name: workspace.name || "Workspace",
      planTier: workspace.plan_tier,
      status: workspace.status,
      createdAt: workspace.created_at,
      callerRole,
      members,
      usage: {
        accounts: accountsRes.count ?? 0,
        seats: members.length,
        keywords: keywordsRes.count ?? 0,
        aiCallsThisMonth: aiEventsRes.count ?? 0,
      },
      limits: {
        tier: limits.tier,
        label: limits.label,
        maxAccounts: limits.max_accounts,
        maxSeats: limits.max_seats,
        maxKeywords: limits.max_keywords,
        maxAiCallsMonth: limits.max_ai_calls_month,
        monthlyPriceUsd: limits.monthly_price_usd,
      },
    };
  });

export type PlanTier = {
  tier: string;
  label: string;
  monthlyPriceUsd: number | null;
  maxAccounts: number;
  maxSeats: number;
  maxKeywords: number;
  maxAiCallsMonth: number;
  costNote: string;
};

/** The three plan tiers, for the plan picker and the SaaS-owner workspace list. */
export const listPlanTiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<PlanTier[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("plan_limits")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((row) => ({
      tier: row.tier,
      label: row.label,
      monthlyPriceUsd: row.monthly_price_usd,
      maxAccounts: row.max_accounts,
      maxSeats: row.max_seats,
      maxKeywords: row.max_keywords,
      maxAiCallsMonth: row.max_ai_calls_month,
      costNote: row.cost_note,
    }));
  });

/**
 * Adds an existing account (by email) to the caller's workspace. There is no
 * email-invite infrastructure yet, so this only works for someone who
 * already has an account somewhere on the platform — the same shape
 * workspace_members already supports (one user, multiple workspaces).
 */
export const inviteWorkspaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email(),
        role: z.enum(["admin", "member"]).default("member"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ added: true; email: string }> => {
    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: callerMembership } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (callerMembership?.role !== "owner" && callerMembership?.role !== "admin") {
      throw new Error("Only workspace owners or admins can add members.");
    }

    const { data: targetProfile, error: lookupError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!targetProfile) {
      throw new Error(
        "No account found for that email yet. Ask them to create an account first, then invite them.",
      );
    }

    const { data: existing } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", targetProfile.id)
      .maybeSingle();
    if (existing) throw new Error("That person is already a member of this workspace.");

    const { error: insertError } = await admin.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: targetProfile.id,
      role: data.role,
      invited_by: context.userId,
    });
    if (insertError) throw new Error(insertError.message);

    await logAuditEventAsCaller(context.supabase, {
      action: "role.grant",
      resourceTable: "workspace_members",
      resourceId: targetProfile.id,
      metadata: { workspaceId, role: data.role },
    });

    return { added: true, email: data.email };
  });

export const removeWorkspaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ removed: true }> => {
    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: callerMembership } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (callerMembership?.role !== "owner") {
      throw new Error("Only the workspace owner can remove members.");
    }
    if (data.userId === context.userId) {
      throw new Error("You can't remove yourself as the workspace owner.");
    }

    const { error } = await admin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    await logAuditEventAsCaller(context.supabase, {
      action: "role.revoke",
      resourceTable: "workspace_members",
      resourceId: data.userId,
      metadata: { workspaceId },
    });

    return { removed: true };
  });
