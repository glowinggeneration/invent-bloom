/**
 * Server functions behind /reports.
 *
 * Reads come from the stored report records; generating one runs the same
 * engine the nightly job uses, so a manual export and the automatic report
 * are always produced the same way.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  dayBounds,
  formatReportDate,
  reportDateKey,
  type ReportKind,
  type ReportListItem,
  type ReportRecord,
} from "./reports";

function toRecord(row: any): ReportRecord {
  return {
    id: String(row.id),
    kind: row.kind as ReportKind,
    reportDate: String(row.report_date),
    label: String(row.label ?? ""),
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    status: row.status,
    generatedAt: String(row.generated_at),
    metrics: row.metrics,
    conversation: row.conversation,
    campaigns: row.campaigns,
    personas: row.personas,
    insights: row.insights ?? [],
    recommendations: row.recommendations ?? [],
    sourceErrors: row.source_errors ?? [],
  };
}

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ kind: z.enum(["all", "daily", "weekly", "monthly", "custom"]).default("all") })
      .default({ kind: "all" })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ reports: ReportListItem[] }> => {
    let query = (context.supabase as any)
      .from("reports")
      .select("id, kind, report_date, label, status, generated_at, metrics, campaigns")
      .order("period_start", { ascending: false })
      .limit(120);
    if (data.kind !== "all") query = query.eq("kind", data.kind);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const reports: ReportListItem[] = ((rows ?? []) as any[]).map((r) => ({
      id: String(r.id),
      kind: r.kind,
      reportDate: String(r.report_date),
      label: String(r.label ?? ""),
      status: r.status,
      generatedAt: String(r.generated_at),
      mentions: Number(r.metrics?.mentions ?? 0),
      campaigns: Number(r.campaigns?.total ?? 0),
      engagementActions: Number(r.campaigns?.completedActions ?? 0),
    }));
    return { reports };
  });

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }): Promise<{ report: ReportRecord | null }> => {
    const { data: row, error } = await (context.supabase as any)
      .from("reports")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { report: row ? toRecord(row) : null };
  });

/** Manual export: same engine, caller picks the period. */
export const createReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        period: z.enum(["today", "yesterday", "last7", "last30", "custom"]).default("today"),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { generateReport } = await import("./reports.server");

    const today = reportDateKey();
    const yesterday = reportDateKey(new Date(Date.now() - 24 * 3600_000));

    if (data.period === "today" || data.period === "yesterday") {
      const key = data.period === "today" ? today : yesterday;
      const { start, end } = dayBounds(key);
      const report = await generateReport({
        kind: "daily",
        reportDate: key,
        label: `Daily Report — ${formatReportDate(key)}`,
        periodStart: start,
        periodEnd: end,
      });
      return { id: report.id };
    }

    let startKey: string;
    let endKey: string;
    if (data.period === "custom") {
      if (!data.from || !data.to) throw new Error("Pick both a start and an end date.");
      startKey = data.from;
      endKey = data.to;
    } else {
      const days = data.period === "last7" ? 6 : 29;
      startKey = reportDateKey(new Date(Date.now() - days * 24 * 3600_000));
      endKey = today;
    }
    if (startKey > endKey) throw new Error("The start date must come before the end date.");

    const start = dayBounds(startKey).start;
    const end = dayBounds(endKey).end;
    const kind: ReportKind =
      data.period === "last7" ? "weekly" : data.period === "last30" ? "monthly" : "custom";

    const report = await generateReport({
      kind,
      reportDate: endKey,
      label: `${formatReportDate(startKey)} – ${formatReportDate(endKey)}`,
      periodStart: start,
      periodEnd: end,
    });
    return { id: report.id };
  });

/** CSV text for a stored report, built live from the underlying rows. */
export const getReportCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().min(1), sheet: z.enum(["mentions", "campaigns", "personas"]) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ filename: string; csv: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkRateLimit, createSupabaseRateLimitStore, RATE_LIMIT_PRESETS } =
      await import("./platform/rate-limit.server");
    const rate = await checkRateLimit(createSupabaseRateLimitStore(supabaseAdmin as any), {
      bucketKey: `export:user:${context.userId}`,
      ...RATE_LIMIT_PRESETS.export,
    });
    if (!rate.allowed) {
      throw new Error("Too many exports. Wait a while before exporting again.");
    }

    const { data: row, error } = await (context.supabase as any)
      .from("reports")
      .select("report_date, period_start, period_end")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That report no longer exists.");

    const { mentionsCsv, campaignsCsv, personaActivityCsv } = await import("./reports-csv.server");
    const start = String(row.period_start);
    const end = String(row.period_end);
    const date = String(row.report_date);

    if (data.sheet === "mentions") {
      return { filename: `SMAIT_Mentions_${date}.csv`, csv: await mentionsCsv(start, end) };
    }
    if (data.sheet === "campaigns") {
      return { filename: `SMAIT_Campaigns_${date}.csv`, csv: await campaignsCsv(start, end) };
    }
    return {
      filename: `SMAIT_Persona_Activity_${date}.csv`,
      csv: await personaActivityCsv(start, end),
    };
  });
