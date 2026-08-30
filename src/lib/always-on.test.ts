import { describe, expect, it } from "vitest";
import {
  ACTIVITY_RANGE,
  buildDailyPlan,
  campaignAllowance,
  reviewCandidate,
  type QualityScores,
} from "./always-on";
import { PERSONAS } from "./personas";

const persona = PERSONAS[0]!;
const good: QualityScores = {
  personaConsistency: 0.95,
  relevance: 0.9,
  originality: 0.9,
  factualIntegrity: 1,
  platformSuitability: 0.98,
};

describe("always-on daily plan", () => {
  it("keeps every day within the persona's activity range and 3-6 posts", () => {
    for (let day = 1; day <= 14; day += 1) {
      const date = `2026-03-${String(day).padStart(2, "0")}`;
      const plan = buildDailyPlan({ persona, accountId: "acc-1", date });
      const [min, max] = ACTIVITY_RANGE[plan.activityType];
      expect(plan.slots.length).toBe(plan.target);
      expect(plan.target).toBeGreaterThanOrEqual(min);
      expect(plan.target).toBeLessThanOrEqual(max);
      expect(plan.target).toBeGreaterThanOrEqual(3);
      expect(plan.target).toBeLessThanOrEqual(6);
    }
  });

  it("is deterministic for the same persona, account and date", () => {
    const a = buildDailyPlan({ persona, accountId: "acc-1", date: "2026-03-04" });
    const b = buildDailyPlan({ persona, accountId: "acc-1", date: "2026-03-04" });
    expect(b.slots.map((s) => s.time)).toEqual(a.slots.map((s) => s.time));
    expect(b.slots.map((s) => s.category)).toEqual(a.slots.map((s) => s.category));
  });

  it("never lets campaign content exceed 40% of the day", () => {
    for (const target of [3, 4, 5, 6]) {
      expect(campaignAllowance(target, 10)).toBeLessThanOrEqual(Math.floor(target * 0.4));
    }
  });

  it("schedules posts in chronological order", () => {
    const plan = buildDailyPlan({ persona, accountId: "acc-9", date: "2026-05-20" });
    const minutes = plan.slots.map((s) => s.minute);
    expect([...minutes].sort((a, b) => a - b)).toEqual(minutes);
  });
});

describe("candidate review gate", () => {
  it("accepts a fresh, on-voice post", () => {
    const verdict = reviewCandidate({
      candidate: {
        content: "Matchday queues moved fast today, the stewards deserve some credit.",
        topic: "matchday-logistics",
        category: "personal_observation",
        quality: good,
      },
      recent: [],
    });
    expect(verdict.ok).toBe(true);
  });

  it("blocks a topic repeated inside the cooldown window", () => {
    const verdict = reviewCandidate({
      candidate: {
        content: "Ticketing queues were smooth again this afternoon.",
        topic: "ticketing",
        category: "personal_observation",
        quality: good,
      },
      recent: [
        {
          content: "Ticketing queues moved quickly this morning.",
          topic: "ticketing",
          category: "personal_observation",
          publishedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
        },
      ],
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons.join(" ")).toMatch(/topic|cooldown|similar/i);
  });

  it("blocks weak persona consistency", () => {
    const verdict = reviewCandidate({
      candidate: {
        content: "Generic corporate announcement about our exciting journey.",
        topic: "announcement",
        category: "professional_perspective",
        quality: { ...good, personaConsistency: 0.4 },
      },
      recent: [],
    });
    expect(verdict.ok).toBe(false);
  });
});
