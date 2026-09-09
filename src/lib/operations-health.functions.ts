import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./access";
import { resolveWorkspaceId } from "./workspace.server";

export type HealthState = "healthy" | "attention" | "stale" | "unknown";

export type HealthSource = {
  key: string;
  label: string;
  state: HealthState;
  detail: string;
  lastSeenAt: string | null;
};

export type OperationsHealth = {
  generatedAt: string;
  sources: HealthSource[];
  accounts: {
    total: number;
    ready: number;
    suspended: number;
    inactive: number;
    needsSession: number;
  };
  queue: {
    pending: number;
    overdue: number;
    nextRunAt: string | null;
  };
  delivery: {
    last24h: number;
    successful: number;
    failed: number;
    held: number;
    successRate: number | null;
  };
  recentFailures: {
    source: string;
    status: string;
    at: string;
  }[];
};

function ageState(at: string | null, healthyHours: number, staleHours: number): HealthState {
  if (!at) return "unknown";
  const age = Date.now() - new Date(at).getTime();
  if (!Number.isFinite(age)) return "unknown";
  if (age <= healthyHours * 3600000) return "healthy";
  if (age <= staleHours * 3600000) return "attention";
  return "stale";
}

function safeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function newest(rows: any[] | null | undefined, key: string): string | null {
  let latest: string | null = null;
  for (const row of rows ?? []) {
    const at = safeDate(row?.[key]);
    if (at && (!latest || at > latest)) latest = at;
  }
  return latest;
}

export const getOperationsHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OperationsHealth> => {
    assertAdmin(context as any);
    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const since = new Date(Date.now() - 24 * 3600000).toISOString();
    const now = new Date().toISOString();

    const [
      sourceStatusRes,
      xMentionsRes,
      newsRes,
      socialRes,
      accountsRes,
      queueRes,
      publishRes,
      repliesRes,
      dailyRes,
    ] = await Promise.all([
      admin
        .from("apify_source_status")
        .select("source_key, label, status, message, last_run_at, stored_last_run")
        .eq("workspace_id", workspaceId)
        .order("label"),
      admin
        .from("x_mentions")
        .select("collected_at, posted_at")
        .eq("workspace_id", workspaceId)
        .order("collected_at", { ascending: false })
        .limit(1),
      admin
        .from("news_articles")
        .select("pub_date, provider")
        .eq("workspace_id", workspaceId)
        .order("pub_date", { ascending: false })
        .limit(1),
      admin
        .from("apify_mentions")
        .select("published_at, platform")
        .eq("workspace_id", workspaceId)
        .order("published_at", { ascending: false })
        .limit(1),
      admin
        .from("x_accounts")
        .select("id, is_active, suspended, auth_token")
        .eq("workspace_id", workspaceId),
      admin
        .from("scheduled_actions")
        .select("id, run_at, source, status")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending")
        .order("run_at", { ascending: true })
        .limit(2000),
      admin
        .from("publish_actions")
        .select("status, created_at")
        .eq("workspace_id", workspaceId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000),
      admin
        .from("campaign_replies")
        .select("status, created_at")
        .eq("workspace_id", workspaceId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000),
      admin
        .from("persona_daily_posts")
        .select("status, created_at")
        .eq("workspace_id", workspaceId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    const sources: HealthSource[] = [];

    const xAt = newest(xMentionsRes.data, "collected_at") ?? newest(xMentionsRes.data, "posted_at");
    sources.push({
      key: "x",
      label: "X listening",
      state: ageState(xAt, 2, 8),
      detail: xAt ? "Latest stored X mention" : "No stored X mention found",
      lastSeenAt: xAt,
    });

    const newsAt = newest(newsRes.data, "pub_date");
    sources.push({
      key: "news",
      label: "News monitoring",
      state: ageState(newsAt, 6, 24),
      detail: newsAt ? "Latest stored news article" : "No stored news article found",
      lastSeenAt: newsAt,
    });

    const socialAt = newest(socialRes.data, "published_at");
    sources.push({
      key: "social",
      label: "Apify social listening",
      state: ageState(socialAt, 6, 24),
      detail: socialAt ? "Latest stored social mention" : "No stored social mention found",
      lastSeenAt: socialAt,
    });

    for (const row of sourceStatusRes.data ?? []) {
      const lastSeenAt = safeDate(row.last_run_at);
      const stored = Number(row.stored_last_run ?? 0);
      const status = String(row.status ?? "").toLowerCase();
      let state = ageState(lastSeenAt, 6, 24);
      if (status === "error" || status === "failed") state = "attention";
      sources.push({
        key: `apify:${row.source_key}`,
        label: row.label || row.source_key || "Apify source",
        state,
        detail: row.message || `${stored} item${stored === 1 ? "" : "s"} stored on the last run`,
        lastSeenAt,
      });
    }

    const accounts = accountsRes.data ?? [];
    const accountSummary = {
      total: accounts.length,
      ready: 0,
      suspended: 0,
      inactive: 0,
      needsSession: 0,
    };
    for (const account of accounts) {
      const active = Boolean(account.is_active);
      const suspended = Boolean(account.suspended);
      const hasSession = Boolean(account.auth_token);
      if (suspended) accountSummary.suspended += 1;
      if (!active) accountSummary.inactive += 1;
      if (!hasSession) accountSummary.needsSession += 1;
      if (active && !suspended && hasSession) accountSummary.ready += 1;
    }

    const pending = queueRes.data ?? [];
    const overdue = pending.filter(
      (item: any) => safeDate(item.run_at) && item.run_at < now,
    ).length;
    const nextRunAt = safeDate(pending[0]?.run_at);

    const deliveryRows: { source: string; status: string; at: string }[] = [];
    const addRows = (source: string, rows: any[] | null | undefined) => {
      for (const row of rows ?? []) {
        const at = safeDate(row.created_at);
        if (!at) continue;
        deliveryRows.push({ source, status: String(row.status ?? "unknown"), at });
      }
    };
    addRows("Publish", publishRes.data);
    addRows("Campaign", repliesRes.data);
    addRows("Always-on", dailyRes.data);

    let successful = 0;
    let failed = 0;
    let held = 0;
    for (const row of deliveryRows) {
      const status = row.status.toLowerCase();
      if (["success", "published", "completed", "sent"].includes(status)) successful += 1;
      else if (["held", "review", "pending_review"].includes(status)) held += 1;
      else if (["failed", "error"].includes(status)) failed += 1;
    }
    const attempted = successful + failed;
    const successRate = attempted > 0 ? Math.round((successful / attempted) * 1000) / 10 : null;

    const recentFailures = deliveryRows
      .filter((row) =>
        ["failed", "error", "held", "pending_review"].includes(row.status.toLowerCase()),
      )
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8);

    return {
      generatedAt: now,
      sources,
      accounts: accountSummary,
      queue: { pending: pending.length, overdue, nextRunAt },
      delivery: {
        last24h: deliveryRows.length,
        successful,
        failed,
        held,
        successRate,
      },
      recentFailures,
    };
  });
