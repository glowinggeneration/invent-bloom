import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADAPTIVE,
  FIELD_PLASTICITY,
  MAX_DELTA_PER_UPDATE,
  applyOutcome,
  driftAction,
  similarityPenalty,
  type PersonaStateRow,
} from "./persona-learning";

function state(overrides: Partial<PersonaStateRow> = {}): PersonaStateRow {
  return {
    personaId: "test",
    adaptive: { ...DEFAULT_ADAPTIVE, recentPhrases: [] },
    learningRate: 0.1,
    personaVersion: 1,
    driftScore: 0,
    frozen: false,
    ...overrides,
  };
}

describe("adaptive persona learning", () => {
  it("never moves identity/biography fields", () => {
    expect(FIELD_PLASTICITY.biography).toBe(0);
    expect(FIELD_PLASTICITY.coreValue).toBeLessThanOrEqual(0.05);
  });

  it("caps how far a persona can move in one update", () => {
    const { changes } = applyOutcome(state(), "rejected_false_information", {
      evidenceStrength: 1,
      confidence: 1,
    });
    for (const c of changes) {
      expect(Math.abs(c.delta)).toBeLessThanOrEqual(MAX_DELTA_PER_UPDATE);
    }
  });

  it("loses trust faster than it gains it", () => {
    const down = applyOutcome(state(), "rejected_false_information", { confidence: 1 });
    const trustDrop = down.changes.find((c) => c.field === "institutionalTrust");
    expect(trustDrop).toBeDefined();
    expect(trustDrop!.delta).toBeLessThan(0);
  });

  it("freezes learning once drift is too high", () => {
    expect(driftAction(0.2)).toBe("ok");
    expect(driftAction(0.4)).toBe("human_review");
    expect(driftAction(0.6)).toBe("freeze");
    const frozen = applyOutcome(state({ frozen: true }), "approved_unchanged");
    expect(frozen.changes).toHaveLength(0);
  });

  it("detects personas converging on the same voice", () => {
    const same = similarityPenalty([
      "stadium tickets should be cheaper",
      "stadium tickets should be cheaper",
    ]);
    const different = similarityPenalty([
      "stadium tickets should be cheaper",
      "referee decisions ruined yesterday",
    ]);
    expect(same).toBeGreaterThan(different);
  });
});
