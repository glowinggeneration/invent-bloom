import { PERSONAS } from "./personas";
import {
  DEFAULT_ADAPTIVE,
  applyOutcome,
  learningRateFor,
  type AdaptiveState,
  type LearningOutcome,
  type PersonaStateRow,
} from "./persona-learning";

type Row = {
  persona_id: string;
  adaptive: unknown;
  learning_rate: number | string;
  persona_version: number;
  drift_score: number | string;
  frozen: boolean;
};

function toState(row: Row): PersonaStateRow {
  const raw = (row.adaptive ?? {}) as Partial<AdaptiveState>;
  return {
    personaId: row.persona_id,
    adaptive: {
      ...DEFAULT_ADAPTIVE,
      ...raw,
      recentPhrases: Array.isArray(raw.recentPhrases) ? raw.recentPhrases.slice(0, 8) : [],
    },
    learningRate: Number(row.learning_rate),
    personaVersion: row.persona_version,
    driftScore: Number(row.drift_score),
    frozen: row.frozen,
  };
}

function defaultState(personaId: string): PersonaStateRow {
  const persona = PERSONAS.find((p) => p.id === personaId);
  return {
    personaId,
    adaptive: { ...DEFAULT_ADAPTIVE, recentPhrases: [] },
    learningRate: persona ? learningRateFor(persona) : 0.1,
    personaVersion: 1,
    driftScore: 0,
    frozen: false,
  };
}

/** Loads adaptive state for the given personas, filling gaps with defaults. */
export async function loadPersonaStates(
  personaIds: string[],
): Promise<Map<string, PersonaStateRow>> {
  const map = new Map<string, PersonaStateRow>();
  for (const id of personaIds) map.set(id, defaultState(id));
  if (!personaIds.length) return map;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("persona_state")
      .select("persona_id, adaptive, learning_rate, persona_version, drift_score, frozen")
      .in("persona_id", personaIds);
    if (error) {
      console.error("[persona-learning] load failed", error.message);
      return map;
    }
    for (const row of (data ?? []) as Row[]) map.set(row.persona_id, toState(row));
  } catch (e) {
    console.error("[persona-learning] load threw", e);
  }
  return map;
}

/**
 * Records one reviewer/engagement outcome for a persona and persists the
 * resulting adaptive state plus an audit event. Never throws - learning must
 * not break the user-facing flow.
 */
export async function recordPersonaOutcome(input: {
  personaId: string;
  outcome: LearningOutcome;
  userId?: string | null;
  note?: string;
  recentPhrase?: string;
  evidenceStrength?: number;
  confidence?: number;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const current =
      (await loadPersonaStates([input.personaId])).get(input.personaId) ??
      defaultState(input.personaId);

    const { next, changes } = applyOutcome(current, input.outcome, {
      ...(input.evidenceStrength === undefined ? {} : { evidenceStrength: input.evidenceStrength }),
      ...(input.confidence === undefined ? {} : { confidence: input.confidence }),
    });

    if (input.recentPhrase) {
      next.adaptive.recentPhrases = [
        input.recentPhrase.slice(0, 60),
        ...next.adaptive.recentPhrases,
      ]
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 8);
    }

    const { error } = await supabaseAdmin.from("persona_state").upsert(
      {
        persona_id: next.personaId,
        adaptive: JSON.parse(JSON.stringify(next.adaptive)),
        learning_rate: next.learningRate,
        persona_version: next.personaVersion,
        drift_score: next.driftScore,
        frozen: next.frozen,
      },
      { onConflict: "persona_id" },
    );
    if (error) console.error("[persona-learning] upsert failed", error.message);

    if (changes.length) {
      const { error: evtError } = await supabaseAdmin.from("persona_learning_events").insert(
        changes.map((c) => ({
          persona_id: next.personaId,
          user_id: input.userId ?? null,
          outcome: input.outcome,
          weight: 0,
          field: c.field,
          delta: c.delta,
          note: input.note ?? null,
        })),
      );
      if (evtError) console.error("[persona-learning] event insert failed", evtError.message);
    }
  } catch (e) {
    console.error("[persona-learning] record threw", e);
  }
}
