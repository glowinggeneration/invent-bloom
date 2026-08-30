/**
 * Idempotency keys for retryable state-changing operations.
 * Backs Application Build Master Rules §8.1. Scaffold — see
 * src/lib/platform/README.md for wiring instructions. Not called from any
 * route yet.
 *
 * Usage once wired in:
 *
 *   const result = await withIdempotencyKey(
 *     { key: idempotencyKeyFromHeader, userId, payload: requestBody },
 *     async () => sendCampaignReply(requestBody),
 *   );
 *
 * `payload` is fingerprinted (SHA-256) so a reused key with a different
 * body is rejected rather than silently returning a stale result.
 */
import { createHash } from "node:crypto";

export type IdempotencyStatus = "in_progress" | "completed" | "failed";

export type IdempotencyRecord = {
  key: string;
  userId: string | null;
  requestFingerprint: string;
  status: IdempotencyStatus;
  result: unknown;
  createdAt: string;
  completedAt: string | null;
};

/** Minimal store contract so this logic is testable without a real database. */
export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | null>;
  createInProgress(key: string, userId: string | null, fingerprint: string): Promise<void>;
  complete(key: string, status: "completed" | "failed", result: unknown): Promise<void>;
}

export function fingerprintPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload ?? null))
    .digest("hex");
}

export class IdempotencyKeyConflictError extends Error {
  constructor(key: string) {
    super(`Idempotency key "${key}" was reused with a different request payload.`);
    this.name = "IdempotencyKeyConflictError";
  }
}

export class IdempotencyInProgressError extends Error {
  constructor(key: string) {
    super(`Idempotency key "${key}" is already being processed.`);
    this.name = "IdempotencyInProgressError";
  }
}

/**
 * Runs `operation` at most once per idempotency key. A repeated request
 * with a matching payload returns the original result; a repeated request
 * with a different payload is rejected; a concurrent request for the same
 * in-progress key is rejected rather than double-running the operation.
 */
export async function withIdempotencyKey<T>(
  store: IdempotencyStore,
  input: { key: string; userId: string | null; payload: unknown },
  operation: () => Promise<T>,
): Promise<T> {
  const fingerprint = fingerprintPayload(input.payload);
  const existing = await store.get(input.key);

  if (existing) {
    if (existing.requestFingerprint !== fingerprint) {
      throw new IdempotencyKeyConflictError(input.key);
    }
    if (existing.status === "in_progress") {
      throw new IdempotencyInProgressError(input.key);
    }
    if (existing.status === "completed") {
      return existing.result as T;
    }
    // status === "failed": fall through and retry the operation.
  } else {
    await store.createInProgress(input.key, input.userId, fingerprint);
  }

  try {
    const result = await operation();
    await store.complete(input.key, "completed", result);
    return result;
  } catch (error) {
    await store.complete(input.key, "failed", null);
    throw error;
  }
}

/**
 * Supabase-backed store. Cast at the client boundary until the
 * `idempotency_keys` migration is applied and types are regenerated (see
 * src/lib/platform/README.md).
 */
export function createSupabaseIdempotencyStore(admin: {
  from: (table: string) => any;
}): IdempotencyStore {
  return {
    async get(key) {
      const { data } = await admin
        .from("idempotency_keys")
        .select("key, user_id, request_fingerprint, status, result, created_at, completed_at")
        .eq("key", key)
        .maybeSingle();
      if (!data) return null;
      return {
        key: data.key,
        userId: data.user_id,
        requestFingerprint: data.request_fingerprint,
        status: data.status,
        result: data.result,
        createdAt: data.created_at,
        completedAt: data.completed_at,
      };
    },
    async createInProgress(key, userId, fingerprint) {
      const { error } = await admin.from("idempotency_keys").insert({
        key,
        user_id: userId,
        request_fingerprint: fingerprint,
        status: "in_progress",
      });
      if (error) throw new Error(error.message);
    },
    async complete(key, status, result) {
      const { error } = await admin
        .from("idempotency_keys")
        .update({ status, result, completed_at: new Date().toISOString() })
        .eq("key", key);
      if (error) throw new Error(error.message);
    },
  };
}
