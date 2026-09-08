import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./access";
import { logAuditEventAsCaller } from "./platform/audit-log.server";
import { LEGACY_SINGLE_WORKSPACE_ID } from "./workspace.server";

export type CampaignReadiness = {
  generatedAt: string;
  accounts: { total: number; ready: number; unavailable: number; suspended: number };
  queue: { pending: number };
  execution: { paused: boolean; reason: string; pausedAt: string | null };
};

export type WatchlistItem = {
  id: string;
  kind:
    | "account"
    | "publication"
    | "journalist"
    | "official"
    | "influencer"
    | "competitor"
    | "organisation"
    | "keyword";
  label: string;
  value: string;
  platform: string | null;
  priority: "critical" | "high" | "standard";
  notes: string;
  alertEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DecisionLogItem = {
  id: string;
  insight: string;
  decision: string;
  owner: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
  result: string;
  sourceUrl: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function adminClient() {
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin as any);
}

export const getCampaignReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<CampaignReadiness> => {
    const db = await adminClient();
    const [{ data: accounts }, { count: pending }, { data: state }] = await Promise.all([
      db.from("x_accounts").select("id, is_active, suspended, auth_token"),
      db
        .from("scheduled_actions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      // TODO(Phase 3): thread the caller's real workspaceId here instead of
      // the LEGACY_SINGLE_WORKSPACE_ID stopgap - see workspace.server.ts.
      db
        .from("workspace_execution_state")
        .select("paused, reason, paused_at")
        .eq("workspace_id", LEGACY_SINGLE_WORKSPACE_ID)
        .maybeSingle(),
    ]);
    const list = (accounts ?? []) as any[];
    const ready = list.filter((a) => a.is_active && !a.suspended && Boolean(a.auth_token)).length;
    const suspended = list.filter((a) => Boolean(a.suspended)).length;
    return {
      generatedAt: new Date().toISOString(),
      accounts: {
        total: list.length,
        ready,
        unavailable: Math.max(0, list.length - ready),
        suspended,
      },
      queue: { pending: pending ?? 0 },
      execution: {
        paused: Boolean(state?.paused),
        reason: String(state?.reason ?? ""),
        pausedAt: state?.paused_at ?? null,
      },
    };
  });

export const pauseAllCampaignExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reason: z.string().trim().max(240).default("Emergency pause") }).parse(input ?? {}),
  )
  .handler(
    async ({ data, context }): Promise<{ pausedActions: number; listeningRules: number }> => {
      assertAdmin(context as any);
      const db = await adminClient();
      const now = new Date().toISOString();
      const [{ data: actions, error: actionError }, { data: rules, error: ruleError }] =
        await Promise.all([
          db
            .from("scheduled_actions")
            .update({ status: "paused" })
            .eq("status", "pending")
            .select("id"),
          db
            .from("listening_campaigns")
            .update({ is_active: false })
            .eq("is_active", true)
            .select("id"),
        ]);
      if (actionError) throw new Error(actionError.message);
      if (ruleError) throw new Error(ruleError.message);
      // TODO(Phase 3): use the caller's real workspaceId here instead of
      // the LEGACY_SINGLE_WORKSPACE_ID stopgap - see workspace.server.ts.
      const { error: stateError } = await db.from("workspace_execution_state").upsert({
        workspace_id: LEGACY_SINGLE_WORKSPACE_ID,
        paused: true,
        reason: data.reason || "Emergency pause",
        paused_by: context.userId,
        paused_at: now,
        updated_at: now,
      });
      if (stateError) throw new Error(stateError.message);
      await logAuditEventAsCaller(context.supabase, {
        action: "config.change",
        resourceTable: "workspace_execution_state",
        metadata: {
          change: "emergency_pause",
          reason: data.reason,
          pausedActions: (actions ?? []).length,
          listeningRules: (rules ?? []).length,
        },
      });
      return { pausedActions: (actions ?? []).length, listeningRules: (rules ?? []).length };
    },
  );

export const clearWorkspacePause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ cleared: true }> => {
    assertAdmin(context as any);
    const db = await adminClient();
    // TODO(Phase 3): use the caller's real workspaceId here instead of the
    // LEGACY_SINGLE_WORKSPACE_ID stopgap - see workspace.server.ts.
    const { error } = await db.from("workspace_execution_state").upsert({
      workspace_id: LEGACY_SINGLE_WORKSPACE_ID,
      paused: false,
      reason: "",
      paused_by: null,
      paused_at: null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await logAuditEventAsCaller(context.supabase, {
      action: "config.change",
      resourceTable: "workspace_execution_state",
      metadata: { change: "resume_execution" },
    });
    return { cleared: true };
  });

const watchKind = z.enum([
  "account",
  "publication",
  "journalist",
  "official",
  "influencer",
  "competitor",
  "organisation",
  "keyword",
]);
const watchPriority = z.enum(["critical", "high", "standard"]);
const watchInput = z.object({
  id: z.string().uuid().optional(),
  kind: watchKind,
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(180),
  platform: z.string().trim().max(40).nullable().optional(),
  priority: watchPriority.default("standard"),
  notes: z.string().trim().max(500).default(""),
  alertEnabled: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

function mapWatch(r: any): WatchlistItem {
  return {
    id: r.id,
    kind: r.kind,
    label: r.label,
    value: r.value,
    platform: r.platform ?? null,
    priority: r.priority,
    notes: r.notes ?? "",
    alertEnabled: Boolean(r.alert_enabled),
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const listMonitoringWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<WatchlistItem[]> => {
    const db = await adminClient();
    const { data, error } = await db
      .from("monitoring_watchlist")
      .select("*")
      .order("priority")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapWatch);
  });

export const saveMonitoringWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => watchInput.parse(input))
  .handler(async ({ data, context }): Promise<WatchlistItem> => {
    assertAdmin(context as any);
    const db = await adminClient();
    const row = {
      kind: data.kind,
      label: data.label,
      value: data.value.replace(/^@/, ""),
      platform: data.platform || null,
      priority: data.priority,
      notes: data.notes,
      alert_enabled: data.alertEnabled,
      is_active: data.isActive,
      updated_at: new Date().toISOString(),
      ...(data.id ? {} : { created_by: context.userId }),
    };
    const query = data.id
      ? db.from("monitoring_watchlist").update(row).eq("id", data.id).select("*").single()
      : db.from("monitoring_watchlist").insert(row).select("*").single();
    const { data: saved, error } = await query;
    if (error) throw new Error(error.message);
    await logAuditEventAsCaller(context.supabase, {
      action: "config.change",
      resourceTable: "monitoring_watchlist",
      resourceId: saved.id,
      metadata: { kind: data.kind, label: data.label, created: !data.id },
    });
    return mapWatch(saved);
  });

export const deleteMonitoringWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ deleted: true }> => {
    assertAdmin(context as any);
    const db = await adminClient();
    const { error } = await db.from("monitoring_watchlist").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAuditEventAsCaller(context.supabase, {
      action: "data.delete",
      resourceTable: "monitoring_watchlist",
      resourceId: data.id,
    });
    return { deleted: true };
  });

const decisionInput = z.object({
  id: z.string().uuid().optional(),
  insight: z.string().trim().min(1).max(1000),
  decision: z.string().trim().min(1).max(1000),
  owner: z.string().trim().max(120).default(""),
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).default("open"),
  result: z.string().trim().max(1200).default(""),
  sourceUrl: z.string().trim().url().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

function mapDecision(r: any): DecisionLogItem {
  return {
    id: r.id,
    insight: r.insight,
    decision: r.decision,
    owner: r.owner ?? "",
    status: r.status,
    result: r.result ?? "",
    sourceUrl: r.source_url ?? null,
    dueAt: r.due_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const listDecisionLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<DecisionLogItem[]> => {
    const db = await adminClient();
    const { data, error } = await db
      .from("decision_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(250);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapDecision);
  });

export const saveDecisionLogItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decisionInput.parse(input))
  .handler(async ({ data, context }): Promise<DecisionLogItem> => {
    assertAdmin(context as any);
    const db = await adminClient();
    const row = {
      insight: data.insight,
      decision: data.decision,
      owner: data.owner,
      status: data.status,
      result: data.result,
      source_url: data.sourceUrl || null,
      due_at: data.dueAt || null,
      updated_at: new Date().toISOString(),
      ...(data.id ? {} : { created_by: context.userId }),
    };
    const query = data.id
      ? db.from("decision_log").update(row).eq("id", data.id).select("*").single()
      : db.from("decision_log").insert(row).select("*").single();
    const { data: saved, error } = await query;
    if (error) throw new Error(error.message);
    await logAuditEventAsCaller(context.supabase, {
      action: "config.change",
      resourceTable: "decision_log",
      resourceId: saved.id,
      metadata: { status: data.status, created: !data.id },
    });
    return mapDecision(saved);
  });
