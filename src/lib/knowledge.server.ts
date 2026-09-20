/**
 * Server-only helper: assembles the approved, non-expired Knowledge Library
 * context Studio should treat as authoritative, and formats it for the
 * synthesis prompt. Never exposed as a client server-fn - callers that need
 * client-facing CRUD use knowledge.functions.ts instead.
 */

export type KnowledgeContextEntry = {
  id: string;
  category: string;
  title: string;
  content: string;
};

/**
 * Approved, non-expired entries visible to a workspace/project pair:
 * organisation-wide entries (project_id null) plus, when a project is given,
 * that project's own entries. Superseded and rejected entries are always
 * excluded - only the current approved guidance should ever reach a prompt.
 */
export async function getActiveKnowledgeEntries(
  supabase: { from: (table: string) => any },
  workspaceId: string,
  projectId: string | null,
): Promise<KnowledgeContextEntry[]> {
  const today = new Date().toISOString().slice(0, 10);
  let query = (supabase as any)
    .from("knowledge_entries")
    .select("id, category, title, content, project_id, expiry_date")
    .eq("workspace_id", workspaceId)
    .eq("approval_status", "approved")
    .or(`expiry_date.is.null,expiry_date.gte.${today}`)
    .order("updated_at", { ascending: false })
    .limit(60);

  query = projectId
    ? query.or(`project_id.is.null,project_id.eq.${projectId}`)
    : query.is("project_id", null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    content: row.content,
  }));
}

/** Formats entries as a labelled block for the AI system/context prompt. */
export function formatKnowledgeContext(entries: KnowledgeContextEntry[]): string {
  if (entries.length === 0) return "";
  const byCategory = new Map<string, KnowledgeContextEntry[]>();
  for (const entry of entries) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }
  const sections = [...byCategory.entries()].map(([category, items]) => {
    const label = category.replace(/_/g, " ");
    const lines = items.map((e) => `- [${e.id}] ${e.title}: ${e.content.slice(0, 500)}`);
    return `${label}:\n${lines.join("\n")}`;
  });
  return sections.join("\n\n");
}
