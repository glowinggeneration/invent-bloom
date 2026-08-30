/**
 * Campaign pacing utilities.
 *
 * Timing is used to smooth operational load and respect account-level
 * cooldowns. It is intentionally deterministic and must not be described as a
 * way to imitate human behaviour or evade platform enforcement.
 */

export const SPREAD_OPTIONS = [0, 1, 2, 4, 8, 12, 24, 48] as const;
export type SpreadHours = (typeof SPREAD_OPTIONS)[number];

export function spreadLabel(hours: number) {
  if (hours === 0) return "Queue now with safe pacing";
  return hours === 1 ? "Spread over 1h" : `Spread over ${hours}h`;
}

/** Returns `count` ascending delays evenly distributed across `hours`. */
export function spreadOffsets(count: number, hours: number): number[] {
  if (count <= 0) return [];
  if (hours <= 0) return Array.from({ length: count }, (_, index) => index * 60_000);

  const windowMs = hours * 60 * 60 * 1000;
  if (count === 1) return [0];
  const step = windowMs / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(i * step));
}

/** Absolute ISO timestamps for `count` actions spread across `hours`. */
export function spreadTimes(count: number, hours: number, from = Date.now()): string[] {
  return spreadOffsets(count, hours).map((ms) => new Date(from + ms).toISOString());
}

/**
 * Default queue pacing when the operator chooses "now". Account-specific
 * cooldowns are enforced again by the compliance scheduler before insertion.
 */
export function paceTimes(count: number, from = Date.now()): string[] {
  return Array.from({ length: count }, (_, i) => new Date(from + i * 60_000).toISOString());
}

/** Times for `count` actions: spread across `hours`, or paced when hours is 0. */
export function runTimesFor(count: number, hours: number, from = Date.now()): string[] {
  return hours > 0 ? spreadTimes(count, hours, from) : paceTimes(count, from);
}

/** Compatibility helper used by older queue code. */
export function followUpDelay(index: number) {
  return (10 + index * 5) * 60 * 1000;
}
