import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PersonaLearningItem = {
  personaId: string;
  personaVersion: number;
  driftScore: number;
  frozen: boolean;
  communicationHabit: number;
  topicInterest: number;
  institutionalTrust: number;
  approvals: number;
  rejections: number;
  updatedAt: string;
};

/** Read-only view of how each persona has evolved so far. */
export const listPersonaLearning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PersonaLearningItem[]> => {
    const { data, error } = await context.supabase
      .from("persona_state")
      .select("persona_id, adaptive, persona_version, drift_score, frozen, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const a = (row.adaptive ?? {}) as Record<string, number>;
      return {
        personaId: row.persona_id,
        personaVersion: row.persona_version,
        driftScore: Number(row.drift_score),
        frozen: row.frozen,
        communicationHabit: Number(a["communicationHabit"] ?? 0.5),
        topicInterest: Number(a["topicInterest"] ?? 0.5),
        institutionalTrust: Number(a["institutionalTrust"] ?? 0.5),
        approvals: Number(a["approvals"] ?? 0),
        rejections: Number(a["rejections"] ?? 0),
        updatedAt: row.updated_at,
      };
    });
  });
