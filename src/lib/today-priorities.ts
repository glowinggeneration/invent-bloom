/**
 * Per-user display preference for how many active priorities Today shows
 * before the rest count as backlog. Client-only by design, matching the
 * notification-preferences convention: this is a personal display choice,
 * not permission-relevant or shared state, so it doesn't need a server
 * column - every read of the priorities themselves still goes through
 * RLS-scoped server functions regardless of this number.
 */

export const DEFAULT_PRIORITY_LIMIT = 3;
export const MIN_PRIORITY_LIMIT = 1;
export const MAX_PRIORITY_LIMIT = 7;

const STORAGE_KEY = "smait.today.priority-limit.v1";

function scopedKey(scope?: string | null) {
  const safe = String(scope || "default")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);
  return `${STORAGE_KEY}.${safe}`;
}

export function readPriorityLimit(scope?: string | null): number {
  if (typeof window === "undefined") return DEFAULT_PRIORITY_LIMIT;
  try {
    const raw = window.localStorage.getItem(scopedKey(scope));
    const parsed = raw ? Number(raw) : DEFAULT_PRIORITY_LIMIT;
    if (!Number.isFinite(parsed)) return DEFAULT_PRIORITY_LIMIT;
    return Math.min(MAX_PRIORITY_LIMIT, Math.max(MIN_PRIORITY_LIMIT, Math.round(parsed)));
  } catch {
    return DEFAULT_PRIORITY_LIMIT;
  }
}

export function savePriorityLimit(limit: number, scope?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const clamped = Math.min(MAX_PRIORITY_LIMIT, Math.max(MIN_PRIORITY_LIMIT, Math.round(limit)));
    window.localStorage.setItem(scopedKey(scope), String(clamped));
  } catch {
    // Best-effort - a blocked/private-mode store just keeps the default.
  }
}
