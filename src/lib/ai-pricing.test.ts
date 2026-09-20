import { describe, expect, it } from "vitest";
import { estimateCostUsd, formatUsdEstimate } from "./ai-pricing";

describe("estimateCostUsd", () => {
  it("returns null for a model with no pricing entry, never a fabricated 0", () => {
    expect(estimateCostUsd("some/unknown-model", 1000, 1000)).toBeNull();
  });

  it("computes a positive cost for a priced model with real token counts", () => {
    const cost = estimateCostUsd("google/gemini-3.6-flash", 1000, 1000);
    expect(cost).not.toBeNull();
    expect(cost!).toBeGreaterThan(0);
  });

  it("treats null token counts as zero rather than throwing", () => {
    expect(estimateCostUsd("google/gemini-3.6-flash", null, null)).toBe(0);
  });

  it("output tokens are weighted more than input tokens for this model (published rate)", () => {
    const inputOnly = estimateCostUsd("google/gemini-3.6-flash", 1000, 0)!;
    const outputOnly = estimateCostUsd("google/gemini-3.6-flash", 0, 1000)!;
    expect(outputOnly).toBeGreaterThan(inputOnly);
  });
});

describe("formatUsdEstimate", () => {
  it("renders null as an explicit unavailable state, never as $0.00", () => {
    expect(formatUsdEstimate(null)).toBe("Not available");
  });

  it("renders a tiny positive amount without misleadingly rounding to $0.00", () => {
    expect(formatUsdEstimate(0.001)).toBe("< $0.01");
  });

  it("renders a normal amount to two decimal places", () => {
    expect(formatUsdEstimate(4.5)).toBe("$4.50");
  });
});
