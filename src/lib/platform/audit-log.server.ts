/**
 * Audit logging for security-sensitive and consequential actions.
 * Backs Application Build Master Rules §7.1 / §11.2. Scaffold — see
 * src/lib/platform/README.md for wiring instructions. Not called from any
 * route yet.
 *
 * Usage once wired in (inside a server function, after the action
 * succeeds):
 *
 *   await logAuditEvent(supabaseAdmin, {
 *     actorId: context.userId,
 *     action: "role.grant",
 *     resourceTable: "user_roles",
 *     resourceId: targetUserId,
 *     metadata: { role: "admin" },
 *   });
 *
 * Writes go through the `log_audit_event` SECURITY DEFINER function
 * defined in the platform scaffolding migration, so the row records the
 * caller's real `auth.uid()` rather than a client-supplied actor id even
 * when called with the anon/publishable key. The admin-client path below
 * (service role) is for background jobs with no authenticated request
 * context; prefer the RPC path from an authenticated request.
 */

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.login_failed"
  | "auth.mfa_change"
  | "role.grant"
  | "role.revoke"
  | "account.status_change"
  | "data.export"
  | "data.delete"
  | "admin.access"
  | "payment.change"
  | "config.change"
  | "secret.rotate"
  | "integration.change"
  | "ai.publish"
  | "ai.send"
  | "ai.purchase"
  | "ai.delete";

export type AuditEventInput = {
  actorId: string | null;
  action: AuditAction | (string & {});
  resourceTable: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
};

/**
 * Writes an audit row via the service-role client. Use this from
 * background jobs and webhook handlers that have no authenticated user
 * session to call the `log_audit_event` RPC through. `actorId` is
 * trusted input here — only call this path from server code that has
 * already verified the actor, never from a client-supplied value.
 */
export async function logAuditEvent(
  admin: { from: (table: string) => any },
  input: AuditEventInput,
): Promise<void> {
  const { error } = await admin.from("audit_log").insert({
    actor_id: input.actorId,
    action: input.action,
    resource_table: input.resourceTable,
    resource_id: input.resourceId ?? null,
    metadata: input.metadata ?? {},
    ip: input.ip ?? null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Writes an audit row via the authenticated-user client's RPC, so the
 * actor id comes from the caller's real session (`auth.uid()`) rather
 * than being passed in. Prefer this from server functions that already
 * have `context.supabase` from `requireSupabaseAuth`.
 */
export async function logAuditEventAsCaller(
  userSupabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }> },
  input: Omit<AuditEventInput, "actorId" | "ip">,
): Promise<void> {
  const { error } = await userSupabase.rpc("log_audit_event", {
    _action: input.action,
    _resource_table: input.resourceTable,
    _resource_id: input.resourceId ?? null,
    _metadata: input.metadata ?? {},
  });
  if (error)
    throw new Error(
      typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "log_audit_event failed",
    );
}
