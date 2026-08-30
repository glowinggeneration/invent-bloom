import { describe, expect, it, vi } from "vitest";
import { generateWithFallback, type AiProvider } from "./ai-provider.server";

function makeProvider(name: string, behavior: "succeed" | "fail"): AiProvider {
  return {
    name,
    model: `${name}-model`,
    generate: vi.fn(async () => {
      if (behavior === "fail") throw new Error(`${name} failed`);
      return { content: `response from ${name}`, provider: name, model: `${name}-model` };
    }),
  };
}

describe("generateWithFallback", () => {
  it("uses the first provider when it succeeds, without touching the fallback", async () => {
    const primary = makeProvider("primary", "succeed");
    const fallback = makeProvider("fallback", "succeed");

    const outcome = await generateWithFallback([primary, fallback], { messages: [] });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.response.provider).toBe("primary");
      expect(outcome.fallbackUsed).toBe(false);
      expect(outcome.attempts).toBe(1);
    }
    expect(fallback.generate).not.toHaveBeenCalled();
  });

  it("falls back to the next provider when the first fails", async () => {
    const primary = makeProvider("primary", "fail");
    const fallback = makeProvider("fallback", "succeed");

    const outcome = await generateWithFallback([primary, fallback], { messages: [] });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.response.provider).toBe("fallback");
      expect(outcome.fallbackUsed).toBe(true);
      expect(outcome.attempts).toBe(2);
    }
  });

  it("fails after exhausting every provider, bounding cost to the provider count", async () => {
    const a = makeProvider("a", "fail");
    const b = makeProvider("b", "fail");

    const outcome = await generateWithFallback([a, b], { messages: [] });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.attempts).toBe(2);
      expect(outcome.error).toContain("b failed");
    }
  });

  it("fails immediately with no providers configured", async () => {
    const outcome = await generateWithFallback([], { messages: [] });
    expect(outcome).toEqual({ ok: false, error: "No AI providers configured.", attempts: 0 });
  });

  it("reports each attempt through the callback", async () => {
    const a = makeProvider("a", "fail");
    const b = makeProvider("b", "succeed");
    const onAttempt = vi.fn();

    await generateWithFallback([a, b], { messages: [] }, { onAttempt });

    expect(onAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "a", attempt: 1, error: "a failed" }),
    );
  });
});
