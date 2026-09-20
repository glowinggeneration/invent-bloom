import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveWorkspaceId } from "./workspace.server";
import { trackEvent } from "./growth-events.server";
import { assertAdmin } from "./access";

export type KnowledgeCategory =
  "fact" | "product_detail" | "terminology" | "positioning" | "prior_statement";

export type KnowledgeApprovalStatus = "pending" | "approved" | "rejected" | "superseded";

export type KnowledgeEntry = {
  id: string;
  projectId: string | null;
  category: KnowledgeCategory;
  title: string;
  content: string;
  source: string;
  ownerId: string | null;
  ownerName: string | null;
  approvalStatus: KnowledgeApprovalStatus;
  version: number;
  reviewDate: string | null;
  expiryDate: string | null;
  supersededBy: string | null;
  isExpired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeEntryVersion = {
  id: string;
  version: number;
  title: string;
  content: string;
  approvalStatus: KnowledgeApprovalStatus;
  changedBy: string | null;
  changeNote: string;
  createdAt: string;
};

const CATEGORIES = [
  "fact",
  "product_detail",
  "terminology",
  "positioning",
  "prior_statement",
] as const;

function isExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  return expiryDate < new Date().toISOString().slice(0, 10);
}

function mapEntry(row: any, ownerName: string | null): KnowledgeEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    category: row.category,
    title: row.title,
    content: row.content,
    source: row.source ?? "",
    ownerId: row.owner_id,
    ownerName,
    approvalStatus: row.approval_status,
    version: row.version,
    reviewDate: row.review_date,
    expiryDate: row.expiry_date,
    supersededBy: row.superseded_by,
    isExpired: isExpired(row.expiry_date),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersion(row: any): KnowledgeEntryVersion {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    content: row.content,
    approvalStatus: row.approval_status,
    changedBy: row.changed_by,
    changeNote: row.change_note ?? "",
    createdAt: row.created_at,
  };
}

/** Every entry in the caller's workspace, optionally scoped to one project
 *  (returns that project's own entries plus organisation-wide ones). Omit
 *  `projectId` for the workspace-wide library view (organisation-wide only). */
export const listKnowledgeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid().optional(),
        includeProjectSpecific: z.boolean().default(false),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<KnowledgeEntry[]> => {
    const supabase = context.supabase as any;
    let query = supabase
      .from("knowledge_entries")
      .select("*")
      .order("approval_status", { ascending: true })
      .order("updated_at", { ascending: false });

    if (data.projectId) {
      query = data.includeProjectSpecific
        ? query.or(`project_id.is.null,project_id.eq.${data.projectId}`)
        : query.eq("project_id", data.projectId);
    } else if (!data.includeProjectSpecific) {
      query = query.is("project_id", null);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ownerIds = [...new Set((rows ?? []).map((r: any) => r.owner_id).filter(Boolean))];
    const names: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds);
      for (const p of (profiles ?? []) as { id: string; full_name: string }[]) {
        names[p.id] = p.full_name;
      }
    }

    return ((rows ?? []) as any[]).map((row) => mapEntry(row, names[row.owner_id] ?? null));
  });

const createEntrySchema = z.object({
  projectId: z.string().uuid().optional(),
  category: z.enum(CATEGORIES),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(4000),
  source: z.string().trim().max(500).default(""),
  ownerId: z.string().uuid().optional(),
  reviewDate: z.string().trim().max(10).optional(),
  expiryDate: z.string().trim().max(10).optional(),
});

export const createKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createEntrySchema.parse(input))
  .handler(async ({ data, context }): Promise<KnowledgeEntry> => {
    const workspaceId = await resolveWorkspaceId(context);
    const supabase = context.supabase as any;

    if (data.projectId) {
      // Same cross-workspace guard used by linkItemToProject: a project id
      // alone doesn't prove it belongs to this workspace.
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id, workspace_id")
        .eq("id", data.projectId)
        .maybeSingle();
      if (projectError) throw new Error(projectError.message);
      if (!project || project.workspace_id !== workspaceId) {
        throw new Error("Project not found, or you don't have access to it.");
      }
    }

    const { data: row, error } = await supabase
      .from("knowledge_entries")
      .insert({
        workspace_id: workspaceId,
        project_id: data.projectId ?? null,
        category: data.category,
        title: data.title,
        content: data.content,
        source: data.source,
        owner_id: data.ownerId ?? context.userId,
        review_date: data.reviewDate ?? null,
        expiry_date: data.expiryDate ?? null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapEntry(row, null);
  });

const updateEntrySchema = z.object({
  id: z.string().uuid(),
  category: z.enum(CATEGORIES).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(4000).optional(),
  source: z.string().trim().max(500).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  reviewDate: z.string().trim().max(10).nullable().optional(),
  expiryDate: z.string().trim().max(10).nullable().optional(),
  changeNote: z.string().trim().max(500).default(""),
});

/** Edits an entry's substance. Snapshots the pre-edit row into
 *  knowledge_entry_versions and bumps `version` - an approved entry that's
 *  edited drops back to 'pending' so a stale approval can never silently
 *  cover new wording. */
export const updateKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateEntrySchema.parse(input))
  .handler(async ({ data, context }): Promise<KnowledgeEntry> => {
    const supabase = context.supabase as any;
    const { data: existing, error: fetchError } = await supabase
      .from("knowledge_entries")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!existing) throw new Error("Entry not found, or you don't have access to it.");

    const substantiveChange =
      (data.category !== undefined && data.category !== existing.category) ||
      (data.title !== undefined && data.title !== existing.title) ||
      (data.content !== undefined && data.content !== existing.content);

    if (substantiveChange) {
      const { error: versionError } = await supabase.from("knowledge_entry_versions").insert({
        entry_id: existing.id,
        workspace_id: existing.workspace_id,
        version: existing.version,
        title: existing.title,
        content: existing.content,
        approval_status: existing.approval_status,
        changed_by: context.userId,
        change_note: data.changeNote,
      });
      if (versionError) throw new Error(versionError.message);
    }

    const patch: Record<string, unknown> = {};
    if (data.category !== undefined) patch["category"] = data.category;
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.content !== undefined) patch["content"] = data.content;
    if (data.source !== undefined) patch["source"] = data.source;
    if (data.ownerId !== undefined) patch["owner_id"] = data.ownerId;
    if (data.reviewDate !== undefined) patch["review_date"] = data.reviewDate;
    if (data.expiryDate !== undefined) patch["expiry_date"] = data.expiryDate;
    if (substantiveChange) {
      patch["version"] = existing.version + 1;
      if (existing.approval_status === "approved") patch["approval_status"] = "pending";
    }
    if (Object.keys(patch).length === 0) throw new Error("Nothing to update.");

    const { data: row, error } = await supabase
      .from("knowledge_entries")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapEntry(row, null);
  });

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "approved", "rejected"]),
});

/** Approve, reject or return an entry to pending - never marks 'superseded'
 *  directly (see supersedeKnowledgeEntry) and never deletes. Admin-gated:
 *  this is the step that makes Studio treat an entry as authoritative, the
 *  same trust boundary decision_log/managed_reports already gate the same
 *  way. Drafting an entry (createKnowledgeEntry/updateKnowledgeEntry) stays
 *  open to any workspace member - only the approval transition is
 *  restricted, matching the spec's "authorised reviewer" language. */
export const setKnowledgeApprovalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data, context }): Promise<KnowledgeEntry> => {
    assertAdmin(context as any);
    const { data: row, error } = await (context.supabase as any)
      .from("knowledge_entries")
      .update({ approval_status: data.status })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Entry not found, or you don't have access to it.");
    if (data.status === "approved") {
      void trackEvent({
        workspaceId: row.workspace_id,
        userId: context.userId,
        eventName: "knowledge_entry_approved",
        properties: { category: row.category },
      });
    }
    return mapEntry(row, null);
  });

const supersedeSchema = z.object({
  id: z.string().uuid(),
  replacementId: z.string().uuid(),
});

/** Marks an old entry superseded by a newer one that must already exist and
 *  be in the same workspace - keeps the outdated entry visible in history
 *  without it ever being retrieved as active context again. Admin-gated for
 *  the same reason as setKnowledgeApprovalStatus: this changes what Studio
 *  treats as authoritative. */
export const supersedeKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => supersedeSchema.parse(input))
  .handler(async ({ data, context }): Promise<KnowledgeEntry> => {
    assertAdmin(context as any);
    const supabase = context.supabase as any;
    const { data: existing, error: fetchError } = await supabase
      .from("knowledge_entries")
      .select("id, workspace_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!existing) throw new Error("Entry not found, or you don't have access to it.");

    const { data: replacement, error: replacementError } = await supabase
      .from("knowledge_entries")
      .select("id, workspace_id")
      .eq("id", data.replacementId)
      .maybeSingle();
    if (replacementError) throw new Error(replacementError.message);
    if (!replacement || replacement.workspace_id !== existing.workspace_id) {
      throw new Error("Replacement entry not found, or you don't have access to it.");
    }

    const { data: row, error } = await supabase
      .from("knowledge_entries")
      .update({ approval_status: "superseded", superseded_by: data.replacementId })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapEntry(row, null);
  });

/** Only entries that have never been approved can be hard-deleted (pending
 *  or rejected drafts) - once an entry has ever been approved, superseding
 *  is the only way to retire it, so anything drafts were ever checked
 *  against stays in the audit trail. */
export const deleteKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ deleted: boolean }> => {
    const { error, count } = await (context.supabase as any)
      .from("knowledge_entries")
      .delete({ count: "exact" })
      .eq("id", data.id)
      .in("approval_status", ["pending", "rejected"]);
    if (error) throw new Error(error.message);
    return { deleted: (count ?? 0) > 0 };
  });

export const listKnowledgeEntryVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ entryId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<KnowledgeEntryVersion[]> => {
    const { data: rows, error } = await (context.supabase as any)
      .from("knowledge_entry_versions")
      .select("*")
      .eq("entry_id", data.entryId)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map(mapVersion);
  });
