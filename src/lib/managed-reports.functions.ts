/**
 * Server functions behind the Managed Reports library.
 *
 * Files live in a private bucket, so a view or download hands back a
 * short-lived signed link rather than a public URL — nothing SMAIT stores is
 * reachable until a report has been published.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./access";
import { logAuditEventAsCaller } from "./platform/audit-log.server";
import { resolveWorkspaceId } from "./workspace.server";
import type { ManagedReport, ManagedReportStatus } from "./managed-reports";

const BUCKET = "managed-reports";

function toManagedReport(row: any): ManagedReport {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ""),
    category: String(row.category ?? "other"),
    reportingPeriodStart: row.reporting_period_start ? String(row.reporting_period_start) : null,
    reportingPeriodEnd: row.reporting_period_end ? String(row.reporting_period_end) : null,
    client: String(row.client ?? ""),
    campaign: String(row.campaign ?? ""),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    coverImage: row.cover_image ? String(row.cover_image) : null,
    fileName: String(row.file_name),
    fileType: String(row.file_type ?? ""),
    fileSize: Number(row.file_size ?? 0),
    status: (row.status ?? "published") as ManagedReportStatus,
    uploadedBy: String(row.uploaded_by ?? "SMAIT"),
    uploadedAt: String(row.uploaded_at),
  };
}

export const listManagedReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ category: z.string().default("all") })
      .default({ category: "all" })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ reports: ManagedReport[] }> => {
    let query = (context.supabase as any)
      .from("managed_reports")
      .select("*")
      .neq("status", "archived")
      .order("uploaded_at", { ascending: false })
      .limit(200);
    if (data.category !== "all") query = query.eq("category", data.category);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { reports: ((rows ?? []) as any[]).map(toManagedReport) };
  });

/** Signed link for viewing in the browser or downloading the original file. */
export const getManagedReportLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().min(1), download: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string; fileName: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkRateLimit, createSupabaseRateLimitStore, RATE_LIMIT_PRESETS } =
      await import("./platform/rate-limit.server");
    const rate = await checkRateLimit(createSupabaseRateLimitStore(supabaseAdmin as any), {
      bucketKey: `export:user:${context.userId}`,
      ...RATE_LIMIT_PRESETS.export,
    });
    if (!rate.allowed) {
      throw new Error("Too many downloads. Wait a while before downloading again.");
    }

    const { data: row, error } = await (context.supabase as any)
      .from("managed_reports")
      .select("id, file_name, storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That report is no longer available.");

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(String(row.storage_path), 60 * 60, {
        download: data.download ? String(row.file_name) : undefined,
      } as any);
    if (signError || !signed?.signedUrl)
      throw new Error(signError?.message ?? "Could not open that file.");
    return { url: signed.signedUrl, fileName: String(row.file_name) };
  });

/** Admin-only edits from the library: rename, recategorise, archive, delete. */
export const updateManagedReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context);
    const workspaceId = await resolveWorkspaceId(context);
    const { id, ...patch } = data;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length === 0) return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("managed_reports")
      .update(clean as any)
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    await logAuditEventAsCaller(context.supabase, {
      action: "config.change",
      resourceTable: "managed_reports",
      resourceId: id,
      metadata: clean,
    });
    return { ok: true };
  });

export const deleteManagedReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context);
    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("managed_reports")
      .select("storage_path")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (row?.storage_path)
      await supabaseAdmin.storage.from(BUCKET).remove([String(row.storage_path)]);
    const { error } = await (supabaseAdmin as any)
      .from("managed_reports")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    await logAuditEventAsCaller(context.supabase, {
      action: "data.delete",
      resourceTable: "managed_reports",
      resourceId: data.id,
    });
    return { ok: true };
  });
