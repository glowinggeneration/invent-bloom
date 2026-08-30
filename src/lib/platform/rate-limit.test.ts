import { describe, expect, it } from "vitest";
import { checkRateLimit, createInMemoryRateLimitStore } from "./rate-limit.server";

describe("checkRateLimit", () => {
  it("allows requests under the limit and counts down remaining", async () => {
    const store = createInMemoryRateLimitStore();
    const config = { limit: 3, windowMs: 60_000 };
    const now = 1_000_000;

    const first = await checkRateLimit(store, { bucketKey: "a", ...config, now });
    const second = await checkRateLimit(store, { bucketKey: "a", ...config, now: now + 1 });
    const third = await checkRateLimit(store, { bucketKey: "a", ...config, now: now + 2 });

    expect(first).toMatchObject({ allowed: true, remaining: 2 });
    expect(second).toMatchObject({ allowed: true, remaining: 1 });
    expect(third).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("denies once the limit is reached inside the window", async () => {
    const store = createInMemoryRateLimitStore();
    const config = { limit: 2, windowMs: 60_000 };
    const now = 1_000_000;

    await checkRateLimit(store, { bucketKey: "b", ...config, now });
    await checkRateLimit(store, { bucketKey: "b", ...config, now: now + 1 });
    const denied = await checkRateLimit(store, { bucketKey: "b", ...config, now: now + 2 });

    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterMs).toBe(config.windowMs);
  });

  it("resets once hits age out of the window", async () => {
    const store = createInMemoryRateLimitStore();
    const config = { limit: 1, windowMs: 1_000 };
    const now = 1_000_000;

    await checkRateLimit(store, { bucketKey: "c", ...config, now });
    const denied = await checkRateLimit(store, { bucketKey: "c", ...config, now: now + 500 });
    const allowedAgain = await checkRateLimit(store, {
      bucketKey: "c",
      ...config,
      now: now + 1_500,
    });

    expect(denied.allowed).toBe(false);
    expect(allowedAgain.allowed).toBe(true);
  });

  it("keeps separate buckets independent", async () => {
    const store = createInMemoryRateLimitStore();
    const config = { limit: 1, windowMs: 60_000 };
    const now = 1_000_000;

    await checkRateLimit(store, { bucketKey: "user:1", ...config, now });
    const otherUser = await checkRateLimit(store, { bucketKey: "user:2", ...config, now });

    expect(otherUser.allowed).toBe(true);
  });
});
