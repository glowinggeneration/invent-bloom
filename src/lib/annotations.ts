export type Annotation = {
  id: string;
  /** Chart the note is pinned to, e.g. "confidence". */
  target: string;
  /** What the user believes caused the change. */
  causeType: "persona" | "message" | "other";
  /** Persona name, message snippet, or free text. */
  cause: string;
  note: string;
  createdAt: string;
};

const KEY_PREFIX = "smait:annotations:";
const LEGACY_KEY_PREFIX = "commsiq:annotations:";
const listeners = new Set<() => void>();
const cache = new Map<string, Annotation[]>();

function storageKey(analysisId: string) {
  return `${KEY_PREFIX}${analysisId}`;
}

function legacyStorageKey(analysisId: string) {
  return `${LEGACY_KEY_PREFIX}${analysisId}`;
}

function read(analysisId: string): Annotation[] {
  if (cache.has(analysisId)) return cache.get(analysisId)!;
  let value: Annotation[] = [];
  if (typeof window !== "undefined") {
    try {
      const raw =
        window.localStorage.getItem(storageKey(analysisId)) ??
        window.localStorage.getItem(legacyStorageKey(analysisId));
      if (raw) value = JSON.parse(raw) as Annotation[];
    } catch {
      value = [];
    }
  }
  cache.set(analysisId, value);
  return value;
}

function write(analysisId: string, next: Annotation[]) {
  cache.set(analysisId, next);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey(analysisId), JSON.stringify(next));
    } catch {
      /* storage full or blocked - annotations stay in memory */
    }
  }
  for (const l of listeners) l();
}

export const annotationStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get(analysisId: string) {
    return read(analysisId);
  },
  add(analysisId: string, input: Omit<Annotation, "id" | "createdAt">) {
    const entry: Annotation = {
      ...input,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    write(analysisId, [...read(analysisId), entry]);
    return entry;
  },
  remove(analysisId: string, id: string) {
    write(
      analysisId,
      read(analysisId).filter((a) => a.id !== id),
    );
  },
};

/** Stable-ish id when the caller has no database id for the analysis. */
export function analysisFingerprint(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return `fp${Math.abs(hash).toString(36)}`;
}
