/**
 * Fixed-window rate limiting shared across server instances.
 * Backs Application Build Master Rules §6.5. Scaffold — see
 * src/lib/platform/README.md for wiring instructions. Not called from any
 * route yet.
 *
 * Usage once wired in:
 *
 *   const result = await checkRateLimit(store, {
 *     bucketKey: `login:ip:${ip}`,
 *     ...RATE_LIMIT_PRESETS.login,
 *   });
 *   if (!result.allowed) return respondRateLimited(result.retryAfterMs);
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Milliseconds until the caller can retry, present only when denied. */
  retryAfterMs?: number;
};

/** Minimal store contract so this logic is testable without a real database. */
export interface RateLimitStore {
  /** Count hits for `bucketKey` recorded within `windowMs` of `now`. */
  countRecent(bucketKey: string, windowMs: number, now: number): Promise<number>;
  /** Record one hit for `bucketKey` at `now`. */
  recordHit(bucketKey: string, now: number): Promise<void>;
}

export type RateLimitConfig = {
  /** Maximum hits allowed inside the window. */
  limit: number;
  windowMs: number;
};

/**
 * Presets for the endpoint families Master Rules §6.5 calls out explicitly.
 * Tune per deployment; these are conservative starting points, not
 * measured production values.
 */
export const RATE_LIMIT_PRESETS = {
  login: { limit: 10, windowMs: 5 * 60 * 1000 },
  signup: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
  otpVerify: { limit: 5, windowMs: 10 * 60 * 1000 },
  export: { limit: 10, windowMs: 60 * 60 * 1000 },
  aiGenerate: { limit: 30, windowMs: 60 * 1000 },
  notificationSend: { limit: 100, windowMs: 60 * 1000 },
} as const satisfies Record<string, RateLimitConfig>;

export async function checkRateLimit(
  store: RateLimitStore,
  input: RateLimitConfig & { bucketKey: string; now?: number },
): Promise<RateLimitResult> {
  const now = input.now ?? Date.now();
  const count = await store.countRecent(input.bucketKey, input.windowMs, now);

  if (count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      limit: input.limit,
      retryAfterMs: input.windowMs,
    };
  }

  await store.recordHit(input.bucketKey, now);
  return {
    allowed: true,
    remaining: Math.max(0, input.limit - count - 1),
    limit: input.limit,
  };
}

/**
 * Supabase-backed store using the `rate_limit_hits` table. Cast at the
 * client boundary until that migration is applied and types are
 * regenerated (see src/lib/platform/README.md). Prune old rows on a
 * schedule with `public.prune_rate_limit_hits()` rather than per request.
 */
export function createSupabaseRateLimitStore(admin: {
  from: (table: string) => any;
}): RateLimitStore {
  return {
    async countRecent(bucketKey, windowMs, now) {
      const since = new Date(now - windowMs).toISOString();
      const { count } = await admin
        .from("rate_limit_hits")
        .select("id", { count: "exact", head: true })
        .eq("bucket_key", bucketKey)
        .gte("created_at", since);
      return count ?? 0;
    },
    async recordHit(bucketKey, now) {
      const { error } = await admin
        .from("rate_limit_hits")
        .insert({ bucket_key: bucketKey, created_at: new Date(now).toISOString() });
      if (error) throw new Error(error.message);
    },
  };
}

/** In-memory store for local development or tests. Not shared across instances. */
export function createInMemoryRateLimitStore(): RateLimitStore {
  const hits = new Map<string, number[]>();
  return {
    async countRecent(bucketKey, windowMs, now) {
      const list = (hits.get(bucketKey) ?? []).filter((t) => t > now - windowMs);
      hits.set(bucketKey, list);
      return list.length;
    },
    async recordHit(bucketKey, now) {
      const list = hits.get(bucketKey) ?? [];
      list.push(now);
      hits.set(bucketKey, list);
    },
  };
}
