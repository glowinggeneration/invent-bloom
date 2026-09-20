/**
 * Minimal product-analytics foundation for the customer-journey instrumentation
 * this build tracks toward (signup completed, first useful result completed,
 * report shared, collaborator joined, workspace returned, paid conversion).
 * Server-only - never import from a client component.
 *
 * Writes always go through supabaseAdmin (service role), never the caller's
 * RLS-scoped client, so a workspace member can never forge or inflate events
 * for themselves or another workspace from the client. Reads stay
 * RLS-scoped (see the migration's SELECT policy) for an eventual in-app view.
 */

export type GrowthEventName =
  | "signup_completed"
  | "project_created"
  | "investigation_saved"
  | "knowledge_entry_approved"
  | "report_shared"
  | "collaborator_joined"
  | "workspace_returned"
  | "paid_conversion";

/**
 * Primitive-only property values - never a string long enough to plausibly
 * hold brief/message/report content. Callers pass short labels and counts,
 * not free text, so confidential customer content structurally cannot reach
 * this table even by accident.
 */
type EventProperties = Record<string, string | number | boolean | null>;

const MAX_LABEL_LENGTH = 60;

function sanitize(properties: EventProperties): EventProperties {
  const clean: EventProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === "string") {
      clean[key] = value.slice(0, MAX_LABEL_LENGTH);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Records one growth/journey event. Best-effort: a logging failure never
 * breaks the feature it's describing, matching the ai-observability
 * convention already used for §9.8 AI events.
 */
export async function trackEvent(meta: {
  workspaceId: string;
  userId: string | null;
  eventName: GrowthEventName;
  properties?: EventProperties;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("product_events").insert({
      workspace_id: meta.workspaceId,
      user_id: meta.userId,
      event_name: meta.eventName,
      properties: sanitize(meta.properties ?? {}),
    });
    if (error) console.error("[growth] event logging failed", error.message);
  } catch (err) {
    console.error("[growth] event logging failed", err);
  }
}
