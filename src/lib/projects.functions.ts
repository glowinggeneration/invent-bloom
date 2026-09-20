import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveWorkspaceId } from "./workspace.server";

export type Project = {
  id: string;
  name: string;
  objective: string;
  brief: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type ProjectReference = {
  id: string;
  projectId: string;
  title: string;
  content: string;
  url: string | null;
  excluded: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectInvestigation = {
  id: string;
  projectId: string | null;
  name: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Every existing record type a project can link to, and the RLS-scoped
 * table + display fields to read it back through. Kept as a single
 * allowlist so linking can never target an arbitrary table name from
 * client input - `itemType` is validated against these keys only.
 */
const LINKABLE_TABLES = {
  thread: { table: "threads", titleColumn: "title", dateColumn: "updated_at" },
  campaign: { table: "publish_jobs", titleColumn: "name", dateColumn: "updated_at" },
  listening_campaign: {
    table: "listening_campaigns",
    titleColumn: "name",
    dateColumn: "updated_at",
  },
  report: { table: "reports", titleColumn: "label", dateColumn: "updated_at" },
  managed_report: { table: "managed_reports", titleColumn: "title", dateColumn: "updated_at" },
} as const;

export type LinkableItemType = keyof typeof LINKABLE_TABLES;

function mapProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    objective: row.objective ?? "",
    brief: row.brief ?? "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReference(row: any): ProjectReference {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    content: row.content ?? "",
    url: row.url ?? null,
    excluded: Boolean(row.excluded),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvestigation(row: any): ProjectInvestigation {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    topic: row.topic,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every project in the caller's workspace, active first, most recent first. */
export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Project[]> => {
    const { data, error } = await (context.supabase as any)
      .from("projects")
      .select("*")
      .order("status", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map(mapProject);
  });

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  objective: z.string().trim().max(4000).default(""),
  brief: z.string().trim().max(8000).default(""),
});

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createProjectSchema.parse(input))
  .handler(async ({ data, context }): Promise<Project> => {
    const workspaceId = await resolveWorkspaceId(context);
    const { data: row, error } = await (context.supabase as any)
      .from("projects")
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        objective: data.objective,
        brief: data.brief,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapProject(row);
  });

const renameProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
});

/** Rename only - a dedicated action so "renaming a project" can't accidentally
 *  touch its objective/brief/status in the same request. */
export const renameProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => renameProjectSchema.parse(input))
  .handler(async ({ data, context }): Promise<Project> => {
    const { data: row, error } = await (context.supabase as any)
      .from("projects")
      .update({ name: data.name })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Project not found, or you don't have access to it.");
    return mapProject(row);
  });

const updateProjectContextSchema = z.object({
  id: z.string().uuid(),
  objective: z.string().trim().max(4000).optional(),
  brief: z.string().trim().max(8000).optional(),
});

/** Edits the project's own instructions (objective/brief) - the "edit" half
 *  of the context panel's "edit or exclude" requirement. */
export const updateProjectContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateProjectContextSchema.parse(input))
  .handler(async ({ data, context }): Promise<Project> => {
    const patch: Record<string, string> = {};
    if (data.objective !== undefined) patch["objective"] = data.objective;
    if (data.brief !== undefined) patch["brief"] = data.brief;
    if (Object.keys(patch).length === 0) throw new Error("Nothing to update.");
    const { data: row, error } = await (context.supabase as any)
      .from("projects")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Project not found, or you don't have access to it.");
    return mapProject(row);
  });

const setProjectStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "archived"]),
});

/** Archive or restore. Never a delete - linked items keep their project_id
 *  (ON DELETE SET NULL only fires on an actual row delete, not this). */
export const setProjectStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setProjectStatusSchema.parse(input))
  .handler(async ({ data, context }): Promise<Project> => {
    const { data: row, error } = await (context.supabase as any)
      .from("projects")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Project not found, or you don't have access to it.");
    return mapProject(row);
  });

const projectIdSchema = z.object({ projectId: z.string().uuid() });

export const listProjectReferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProjectReference[]> => {
    const { data: rows, error } = await (context.supabase as any)
      .from("project_references")
      .select("*")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map(mapReference);
  });

const addReferenceSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().max(8000).default(""),
  url: z.string().trim().url().max(2000).optional(),
});

export const addProjectReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addReferenceSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProjectReference> => {
    const workspaceId = await resolveWorkspaceId(context);
    // Confirms the project is actually in this workspace before attaching a
    // reference to it - RLS also enforces this, but a clear error here beats
    // a bare "insert failed" from a foreign-key/RLS rejection.
    const { data: project, error: projectError } = await (context.supabase as any)
      .from("projects")
      .select("id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projectError) throw new Error(projectError.message);
    if (!project) throw new Error("Project not found, or you don't have access to it.");

    const { data: row, error } = await (context.supabase as any)
      .from("project_references")
      .insert({
        project_id: data.projectId,
        workspace_id: workspaceId,
        title: data.title,
        content: data.content,
        url: data.url ?? null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapReference(row);
  });

const updateReferenceSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().max(8000).optional(),
  url: z.string().trim().url().max(2000).nullable().optional(),
  excluded: z.boolean().optional(),
});

/** Covers both edit and the context panel's "exclude" toggle - `excluded`
 *  is just another field on the same row, never a delete. */
export const updateProjectReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateReferenceSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProjectReference> => {
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.content !== undefined) patch["content"] = data.content;
    if (data.url !== undefined) patch["url"] = data.url;
    if (data.excluded !== undefined) patch["excluded"] = data.excluded;
    if (Object.keys(patch).length === 0) throw new Error("Nothing to update.");
    const { data: row, error } = await (context.supabase as any)
      .from("project_references")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Reference not found, or you don't have access to it.");
    return mapReference(row);
  });

export const deleteProjectReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ deleted: boolean }> => {
    const { error, count } = await (context.supabase as any)
      .from("project_references")
      .delete({ count: "exact" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { deleted: (count ?? 0) > 0 };
  });

export type ProjectItem = {
  itemType: LinkableItemType;
  id: string;
  title: string;
  updatedAt: string;
};

/** Every existing record currently linked to a project, read back through
 *  each item's own RLS-scoped table - never a second copy of the content. */
export const listProjectItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProjectItem[]> => {
    const supabase = context.supabase as any;
    const results = await Promise.all(
      (
        Object.entries(LINKABLE_TABLES) as [
          LinkableItemType,
          (typeof LINKABLE_TABLES)[LinkableItemType],
        ][]
      ).map(async ([itemType, def]) => {
        const { data: rows, error } = await supabase
          .from(def.table)
          .select(`id, ${def.titleColumn}, ${def.dateColumn}`)
          .eq("project_id", data.projectId)
          .order(def.dateColumn, { ascending: false })
          .limit(100);
        if (error) throw new Error(error.message);
        return ((rows ?? []) as any[]).map((row): ProjectItem => ({
          itemType,
          id: row.id,
          title: row[def.titleColumn] || "Untitled",
          updatedAt: row[def.dateColumn],
        }));
      }),
    );
    return results
      .flat()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

const linkItemSchema = z.object({
  projectId: z.string().uuid(),
  itemType: z.enum(["thread", "campaign", "listening_campaign", "report", "managed_report"]),
  itemId: z.string().uuid(),
});

/** Links an existing record to a project. Never copies content - only sets
 *  the item's own `project_id` column, which RLS already scopes to
 *  workspace members, so this can only ever touch a row the caller could
 *  already read/write. */
export const linkItemToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => linkItemSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ linked: boolean }> => {
    // RLS alone would let this succeed against a project UUID from a
    // different workspace (the FK only checks the projects row exists
    // somewhere, not that it's in the caller's workspace) - explicit check
    // here so a linked item's project is always actually the caller's own,
    // not just an update that happened not to error.
    const workspaceId = await resolveWorkspaceId(context);
    const { data: project, error: projectError } = await (context.supabase as any)
      .from("projects")
      .select("id, workspace_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projectError) throw new Error(projectError.message);
    if (!project || project.workspace_id !== workspaceId) {
      throw new Error("Project not found, or you don't have access to it.");
    }

    const def = LINKABLE_TABLES[data.itemType];
    const { error, count } = await (context.supabase as any)
      .from(def.table)
      .update({ project_id: data.projectId }, { count: "exact" })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    if (!count) throw new Error("Item not found, or you don't have access to it.");
    return { linked: true };
  });

const unlinkItemSchema = z.object({
  itemType: z.enum(["thread", "campaign", "listening_campaign", "report", "managed_report"]),
  itemId: z.string().uuid(),
});

export const unlinkItemFromProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => unlinkItemSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ unlinked: boolean }> => {
    const def = LINKABLE_TABLES[data.itemType];
    const { error, count } = await (context.supabase as any)
      .from(def.table)
      .update({ project_id: null }, { count: "exact" })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { unlinked: (count ?? 0) > 0 };
  });

/** Investigations, optionally scoped to one project. Omit `projectId` for
 *  "all of mine, project-linked or not" (used by the project picker when
 *  choosing which existing investigation to attach). */
export const listInvestigations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ProjectInvestigation[]> => {
    let query = (context.supabase as any)
      .from("investigations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data.projectId) query = query.eq("project_id", data.projectId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map(mapInvestigation);
  });

const saveInvestigationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  topic: z.string().trim().min(1).max(2000),
  projectId: z.string().uuid().optional(),
});

export const saveInvestigation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveInvestigationSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProjectInvestigation> => {
    const workspaceId = await resolveWorkspaceId(context);
    const { data: row, error } = await (context.supabase as any)
      .from("investigations")
      .insert({
        workspace_id: workspaceId,
        project_id: data.projectId ?? null,
        user_id: context.userId,
        name: data.name,
        topic: data.topic,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapInvestigation(row);
  });

const linkInvestigationSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
});

export const linkInvestigationToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => linkInvestigationSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProjectInvestigation> => {
    const { data: row, error } = await (context.supabase as any)
      .from("investigations")
      .update({ project_id: data.projectId })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Investigation not found, or you don't have access to it.");
    return mapInvestigation(row);
  });

export const deleteInvestigation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ deleted: boolean }> => {
    const { error, count } = await (context.supabase as any)
      .from("investigations")
      .delete({ count: "exact" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { deleted: (count ?? 0) > 0 };
  });
