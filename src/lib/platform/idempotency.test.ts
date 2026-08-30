import { describe, expect, it, vi } from "vitest";
import {
  IdempotencyInProgressError,
  IdempotencyKeyConflictError,
  fingerprintPayload,
  withIdempotencyKey,
  type IdempotencyRecord,
  type IdempotencyStore,
} from "./idempotency.server";

function createFakeStore(initial?: IdempotencyRecord): IdempotencyStore & {
  records: Map<string, IdempotencyRecord>;
} {
  const records = new Map<string, IdempotencyRecord>();
  if (initial) records.set(initial.key, initial);
  return {
    records,
    async get(key) {
      return records.get(key) ?? null;
    },
    async createInProgress(key, userId, fingerprint) {
      records.set(key, {
        key,
        userId,
        requestFingerprint: fingerprint,
        status: "in_progress",
        result: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
    },
    async complete(key, status, result) {
      const existing = records.get(key);
      if (!existing) return;
      records.set(key, { ...existing, status, result, completedAt: new Date().toISOString() });
    },
  };
}

describe("withIdempotencyKey", () => {
  it("runs the operation once for a new key", async () => {
    const store = createFakeStore();
    const operation = vi.fn().mockResolvedValue({ ok: true });

    const result = await withIdempotencyKey(
      store,
      { key: "k1", userId: "u1", payload: { a: 1 } },
      operation,
    );

    expect(result).toEqual({ ok: true });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(store.records.get("k1")?.status).toBe("completed");
  });

  it("returns the original result for a repeated matching request instead of re-running it", async () => {
    const store = createFakeStore();
    const operation = vi.fn().mockResolvedValue({ id: 42 });
    const call = () =>
      withIdempotencyKey(store, { key: "k2", userId: "u1", payload: { a: 1 } }, operation);

    const first = await call();
    const second = await call();

    expect(first).toEqual(second);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("rejects a reused key with a different payload", async () => {
    const store = createFakeStore();
    await withIdempotencyKey(
      store,
      { key: "k3", userId: "u1", payload: { a: 1 } },
      async () => "first",
    );

    await expect(
      withIdempotencyKey(
        store,
        { key: "k3", userId: "u1", payload: { a: 2 } },
        async () => "second",
      ),
    ).rejects.toThrow(IdempotencyKeyConflictError);
  });

  it("rejects a concurrent request for a key still in progress", async () => {
    const store = createFakeStore({
      key: "k4",
      userId: "u1",
      requestFingerprint: fingerprintPayload({ a: 1 }),
      status: "in_progress",
      result: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });

    await expect(
      withIdempotencyKey(store, { key: "k4", userId: "u1", payload: { a: 1 } }, async () => "x"),
    ).rejects.toThrow(IdempotencyInProgressError);
  });

  it("allows retrying after a previous failure", async () => {
    const store = createFakeStore();
    const failing = vi.fn().mockRejectedValueOnce(new Error("boom"));
    const key = "k5";
    const payload = { a: 1 };

    await expect(
      withIdempotencyKey(store, { key, userId: "u1", payload }, failing),
    ).rejects.toThrow("boom");
    expect(store.records.get(key)?.status).toBe("failed");

    const retry = vi.fn().mockResolvedValue("recovered");
    const result = await withIdempotencyKey(store, { key, userId: "u1", payload }, retry);

    expect(result).toBe("recovered");
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
