/**
 * Minimal feature flag evaluator for gradual/flagged releases (Application
 * Build Master Rules §13). Scaffold — no flags are defined yet.
 *
 * Deliberately simple: an env-driven default plus an optional per-context
 * override function, so this can start as a couple of environment
 * variables and grow into a real flag service later without changing call
 * sites. Call sites use `isEnabled("flag_name", context)`, not
 * `process.env` directly, so the swap is transparent.
 *
 * Usage once a flag exists:
 *
 *   export const FLAGS = defineFlags({
 *     new_reply_composer: { default: false },
 *   });
 *   if (isEnabled(FLAGS.new_reply_composer, { userId, org })) { ... }
 */

export type FlagContext = { userId?: string | null; org?: string | null };

export type FlagDefinition = {
  key: string;
  default: boolean;
  /** Optional per-context override, e.g. an allowlist or org rollout percentage. */
  override?: (context: FlagContext) => boolean | undefined;
};

export function defineFlags<T extends Record<string, Omit<FlagDefinition, "key">>>(
  flags: T,
): { [K in keyof T]: FlagDefinition } {
  const result = {} as { [K in keyof T]: FlagDefinition };
  for (const key of Object.keys(flags) as (keyof T)[]) {
    result[key] = { key: String(key), ...flags[key] };
  }
  return result;
}

/**
 * Env var name for a flag's default, e.g. `FLAG_NEW_REPLY_COMPOSER=true`.
 * Lets ops flip a flag without a deploy, per Master Rules §13.
 */
function envOverride(key: string): boolean | undefined {
  const raw = process.env[`FLAG_${key.toUpperCase()}`];
  if (raw === undefined) return undefined;
  return raw === "true" || raw === "1";
}

export function isEnabled(flag: FlagDefinition, context: FlagContext = {}): boolean {
  const contextOverride = flag.override?.(context);
  if (contextOverride !== undefined) return contextOverride;

  const env = envOverride(flag.key);
  if (env !== undefined) return env;

  return flag.default;
}
