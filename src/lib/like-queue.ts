/**
 * Persisted queue of tweet links every persona should engage with.
 * Survives refresh so a long run can be resumed.
 */
export type QueuedLink = {
  url: string;
  status: "pending" | "running" | "done" | "failed";
  ok: number;
  failed: number;
  error?: string;
};

const KEY = "fkf.publish.like-queue.v1";

export function parseLinks(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\/\S+\/status\/\d+/i.test(s) || /^\d{8,}$/.test(s)),
    ),
  ];
}

export function loadLikeQueue(): QueuedLink[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedLink[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.url === "string")
      .map((l) => ({
        url: l.url,
        status: l.status === "running" ? "pending" : (l.status ?? "pending"),
        ok: l.ok ?? 0,
        failed: l.failed ?? 0,
        ...(l.error ? { error: l.error } : {}),
      }));
  } catch {
    return [];
  }
}

export function saveLikeQueue(items: QueuedLink[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)));
  } catch {
    /* storage unavailable */
  }
}
