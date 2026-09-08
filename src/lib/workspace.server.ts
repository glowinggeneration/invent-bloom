/**
 * Resolves which workspace a server request is acting on. Every signup owns
 * exactly one workspace today (no invite/multi-workspace-membership or
 * workspace-switcher feature exists yet), so this always resolves to that
 * single membership via the RLS-respecting client - workspace_members'
 * "Own membership rows readable" policy already lets a caller read their
 * own row directly.
 *
 * Fails closed: a request with no resolvable workspace throws rather than
 * falling back to any default. Never fall back to a specific workspace id
 * here - that would be this project's "unconfigured = accept-all" ingestion
 * philosophy (see entity-config.server.ts) turned inside-out into a
 * cross-tenant leak.
 */

export type WorkspaceContext = { userId: string; supabase: any };

/**
 * TEMPORARY, pre-Phase-3 placeholder: the single workspace Phase 1's
 * backfill migration created for the current single-tenant deployment.
 * Used only by call sites that haven't yet been threaded a real per-request
 * workspaceId - specifically entity-config.server.ts's getWorkspaceSettings()
 * and workspace_execution_state's read/write sites, whose full workspaceId
 * threading is real, separate work (they reach through several layers of
 * helper modules) scoped for right before self-serve signup ships, not
 * bundled into the singleton-column-removal migration that forced this
 * stopgap. Behaviorally identical to today's singleton behavior since only
 * this one workspace exists - but it MUST be replaced with real
 * resolveWorkspaceId()-based threading before Phase 3 ships, or every
 * future tenant would silently read/write Workspace 1's config instead of
 * their own.
 */
export const LEGACY_SINGLE_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export async function resolveWorkspaceId(context: WorkspaceContext): Promise<string> {
  const { data, error } = await context.supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", context.userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No workspace found for this account.");
  return data.workspace_id as string;
}
