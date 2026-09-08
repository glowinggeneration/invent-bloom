import { readWithLegacyKey } from "@/lib/legacy-storage";

export type ActiveTestStatus = "running" | "interrupted" | "done";

export type ActiveTest = {
  status: ActiveTestStatus;
  /** Set once the server has created (or is continuing) a thread. */
  threadId: string | null;
  /** Short preview of the message being tested, for the resume banner. */
  preview: string;
  startedAt: string;
};

const KEY = "smait.activeTest";
const LEGACY_KEY = "fkf.activeTest";
/** A run older than this is stale - never resume it. */
const MAX_AGE_MS = 30 * 60 * 1000;

export function readActiveTest(): ActiveTest | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readWithLegacyKey(KEY, LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveTest>;
    if (!parsed.status || !parsed.startedAt) return null;
    if (Date.now() - new Date(parsed.startedAt).getTime() > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return {
      status: parsed.status,
      threadId: typeof parsed.threadId === "string" ? parsed.threadId : null,
      preview: typeof parsed.preview === "string" ? parsed.preview : "",
      startedAt: parsed.startedAt,
    };
  } catch {
    return null;
  }
}

function write(value: ActiveTest | null) {
  if (typeof window === "undefined") return;
  try {
    if (!value) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Called when a test run starts. `threadId` is null for a brand-new test. */
export function startActiveTest(input: { threadId?: string | null; text: string }) {
  write({
    status: "running",
    threadId: input.threadId ?? null,
    preview: input.text.slice(0, 160),
    startedAt: new Date().toISOString(),
  });
}

/** Called when the run finishes - keeps the thread so deep links resume it. */
export function completeActiveTest(threadId: string) {
  const current = readActiveTest();
  write({
    status: "done",
    threadId,
    preview: current?.preview ?? "",
    startedAt: current?.startedAt ?? new Date().toISOString(),
  });
}

/** Called when the run fails, or when the page unloads mid-run. */
export function interruptActiveTest() {
  const current = readActiveTest();
  if (!current || current.status !== "running") return;
  write({ ...current, status: "interrupted" });
}

export function clearActiveTest() {
  write(null);
}

/** Thread a deep link should open, if a recent run produced one. */
export function resumableThreadId(): string | null {
  const active = readActiveTest();
  return active?.threadId ?? null;
}
