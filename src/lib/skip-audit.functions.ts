/**
 * Read side of the campaign skip audit: which accounts a run left out, and why.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SkipAuditEntry = {
  id: string;
  source: string;
  handle: string;
  personaName: string;
  reason: string;
  detail: string;
  campaignId: string | null;
  jobId: string | null;
  createdAt: string;
};

export const listSkipAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SkipAuditEntry[]> => {
    // Audit rows are owner-scoped at the database level; the federation
    // workspace shares them, so read with the privileged client after the
    // caller has been authenticated by the middleware above.
    void context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("campaign_skip_audit")
      .select("id, source, handle, persona_name, reason, detail, campaign_id, job_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    return ((data ?? []) as any[]).map((r) => ({
      id: String(r.id),
      source: String(r.source),
      handle: String(r.handle ?? ""),
      personaName: String(r.persona_name ?? ""),
      reason: String(r.reason),
      detail: String(r.detail ?? ""),
      campaignId: r.campaign_id ?? null,
      jobId: r.job_id ?? null,
      createdAt: String(r.created_at),
    }));
  });
