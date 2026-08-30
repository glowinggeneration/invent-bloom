import type { Persona } from "./personas";

/**
 * Adaptive Persona Learning Engine (spec: "Adaptive Persona Evolution Engine").
 *
 * Three layers per persona:
 *  - Identity layer      - immutable, editorial change only.
 *  - Adaptive behaviour  - moves slowly under the update formula below.
 *  - Conversation memory - short lived, decays quickly.
 *
 * Everything here is pure so it can run on the server and be unit tested.
 */

/** 7.1 - reviewer outcome signals and their learning weights. */
export const OUTCOME_WEIGHTS = {
  approved_unchanged: 1.0,
  approved_minor_edits: 0.65,
  approved_major_edits: 0.25,
  regenerated: -0.4,
  rejected_tone: -0.7,
  rejected_persona_mismatch: -0.85,
  rejected_false_information: -1.0,
} as const;

export type LearningOutcome = keyof typeof OUTCOME_WEIGHTS;

/** 9 - base plasticity per adaptive field. Biography and identity never move. */
export const FIELD_PLASTICITY = {
  recentVocabulary: 0.8,
  topicInterest: 0.6,
  communicationHabit: 0.45,
  institutionalTrust: 0.25,
  coreValue: 0.05,
  biography: 0,
} as const;

export type AdaptiveField = keyof typeof FIELD_PLASTICITY;
/** Fields the engine may actually move (biography has zero plasticity). */
export type MutableField = Exclude<AdaptiveField, "biography">;

/** 24 - learning rate by persona temperament. */
export function learningRateFor(persona: Persona): number {
  const style = `${persona.decisionStyle} ${persona.vibe}`.toLowerCase();
  if (/spontaneous|bold|impulsive/.test(style)) return 0.14;
  if (/social|expressive|extrovert/.test(style)) return 0.12;
  if (/deliberate|cautious|analytical/.test(style)) return 0.07;
  if (/traditional|faith|elder|conservative/.test(style)) return 0.05;
  return 0.1;
}

/** Adaptive behaviour layer stored per persona. Values are 0..1. */
export type AdaptiveState = {
  recentVocabulary: number;
  topicInterest: number;
  communicationHabit: number;
  institutionalTrust: number;
  coreValue: number;
  /** Rolling counters used for reinforcement thresholds (section 10). */
  approvals: number;
  rejections: number;
  /** Phrases used recently - suppressed to avoid repetitive speech (15). */
  recentPhrases: string[];
};

export const DEFAULT_ADAPTIVE: AdaptiveState = {
  recentVocabulary: 0.5,
  topicInterest: 0.5,
  communicationHabit: 0.5,
  institutionalTrust: 0.5,
  coreValue: 0.5,
  approvals: 0,
  rejections: 0,
  recentPhrases: [],
};

export type PersonaStateRow = {
  personaId: string;
  adaptive: AdaptiveState;
  learningRate: number;
  personaVersion: number;
  driftScore: number;
  frozen: boolean;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** 8 - the adaptive update formula, with a hard per-update cap. */
export const MAX_DELTA_PER_UPDATE = 0.05;

export function computeDelta(input: {
  learningRate: number;
  evidenceStrength: number; // 0..1 - how meaningful the interaction was
  outcomeValue: number; // -1..1
  confidence: number; // 0..1
  field: AdaptiveField;
}): number {
  const raw =
    input.learningRate *
    clamp01(input.evidenceStrength) *
    Math.max(-1, Math.min(1, input.outcomeValue)) *
    clamp01(input.confidence) *
    FIELD_PLASTICITY[input.field];
  return Math.max(-MAX_DELTA_PER_UPDATE, Math.min(MAX_DELTA_PER_UPDATE, raw));
}

/** 11 - trust falls faster than it rises. */
function trustAsymmetry(delta: number) {
  return delta < 0 ? delta * 1.6 : delta;
}

/** 12/13 - inactive interests and emotions decay back toward baseline. */
export const INTEREST_DECAY = 0.995;
export const EMOTION_DECAY = 0.85;

export function decayTowardBaseline(current: number, baseline = 0.5, rate = EMOTION_DECAY) {
  return clamp01(baseline + (current - baseline) * rate);
}

/** 22 - drift from the identity baseline; high drift halts learning. */
export function driftScore(state: AdaptiveState): number {
  const fields: MutableField[] = [
    "recentVocabulary",
    "topicInterest",
    "communicationHabit",
    "institutionalTrust",
    "coreValue",
  ];
  const total = fields.reduce((sum, f) => sum + Math.abs(state[f] - DEFAULT_ADAPTIVE[f]), 0);
  return Number((total / fields.length).toFixed(3));
}

export type DriftAction = "ok" | "human_review" | "freeze";

export function driftAction(score: number): DriftAction {
  if (score > 0.5) return "freeze";
  if (score >= 0.36) return "human_review";
  return "ok";
}

/** Which adaptive fields a given outcome is allowed to move. */
const FIELDS_BY_OUTCOME: Record<LearningOutcome, MutableField[]> = {
  approved_unchanged: ["recentVocabulary", "topicInterest", "communicationHabit"],
  approved_minor_edits: ["recentVocabulary", "communicationHabit"],
  approved_major_edits: ["communicationHabit"],
  regenerated: ["recentVocabulary", "communicationHabit"],
  rejected_tone: ["communicationHabit", "recentVocabulary"],
  rejected_persona_mismatch: ["communicationHabit", "topicInterest"],
  rejected_false_information: ["institutionalTrust", "communicationHabit"],
};

export type LearningUpdate = {
  next: PersonaStateRow;
  changes: { field: MutableField; delta: number }[];
  action: DriftAction;
};

/**
 * 27 - applies one outcome signal to a persona state. Identity fields are never
 * touched, deltas are capped, and updates freeze once drift is too high.
 */
export function applyOutcome(
  state: PersonaStateRow,
  outcome: LearningOutcome,
  options: { evidenceStrength?: number; confidence?: number } = {},
): LearningUpdate {
  const weight = OUTCOME_WEIGHTS[outcome];
  const adaptive: AdaptiveState = { ...state.adaptive };
  const changes: { field: MutableField; delta: number }[] = [];

  if (state.frozen) {
    return { next: state, changes, action: "freeze" };
  }

  for (const field of FIELDS_BY_OUTCOME[outcome]) {
    let delta = computeDelta({
      learningRate: state.learningRate,
      evidenceStrength: options.evidenceStrength ?? 0.6,
      outcomeValue: weight,
      confidence: options.confidence ?? 0.7,
      field,
    });
    if (field === "institutionalTrust") delta = trustAsymmetry(delta);
    if (delta === 0) continue;
    adaptive[field] = clamp01(adaptive[field] + delta);
    changes.push({ field, delta: Number(delta.toFixed(4)) });
  }

  if (weight > 0) adaptive.approvals += 1;
  else adaptive.rejections += 1;

  const drift = driftScore(adaptive);
  const action = driftAction(drift);

  return {
    next: {
      ...state,
      adaptive,
      driftScore: drift,
      frozen: action === "freeze",
      // 10 - a habit only becomes procedural after 20 approvals.
      personaVersion:
        adaptive.approvals > 0 && adaptive.approvals % 20 === 0
          ? state.personaVersion + 1
          : state.personaVersion,
    },
    changes,
    action,
  };
}

/**
 * Turns the adaptive layer into a short instruction block for the generator,
 * so learned behaviour actually shows up in the next reply.
 */
export function adaptiveBrief(state: PersonaStateRow | undefined): string {
  if (!state) return "";
  const a = state.adaptive;
  const bits: string[] = [];
  bits.push(
    a.communicationHabit > 0.6
      ? "leans more direct than baseline"
      : a.communicationHabit < 0.4
        ? "has become softer and more careful"
        : "keeps their baseline directness",
  );
  bits.push(
    a.topicInterest > 0.6
      ? "increasingly engaged with this subject"
      : a.topicInterest < 0.4
        ? "cooling on this subject"
        : "normal interest level",
  );
  bits.push(
    a.institutionalTrust > 0.6
      ? "currently trusts official sources"
      : a.institutionalTrust < 0.4
        ? "currently sceptical of official statements"
        : "neutral on official sources",
  );
  if (a.recentPhrases.length) {
    bits.push(`avoid reusing: ${a.recentPhrases.slice(0, 5).join(", ")}`);
  }
  return `learned state (v${state.personaVersion}): ${bits.join("; ")}`;
}

/** 23 - penalise a batch where personas are converging on one voice. */
export function similarityPenalty(texts: string[]): number {
  const sets = texts.map(
    (t) =>
      new Set(
        t
          .toLowerCase()
          .replace(/[^a-z\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3),
      ),
  );
  let pairs = 0;
  let total = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i]!;
      const b = sets[j]!;
      const inter = [...a].filter((w) => b.has(w)).length;
      const union = new Set([...a, ...b]).size || 1;
      total += inter / union;
      pairs += 1;
    }
  }
  return pairs ? Number((total / pairs).toFixed(3)) : 0;
}
