import { useEffect, useState } from "react";

export type TipId = "first-run-checklist";

export const TIP_DEFS: { id: TipId; title: string; description: string }[] = [
  {
    id: "first-run-checklist",
    title: "First analysis checklist",
    description:
      "The guided checklist (enter text, upload image, run analysis, copy a recommendation).",
  },
];

const KEY = "fkf.tips.prefs";
const EVENT = "fkf:tip-prefs-change";

export type TipPrefs = Record<TipId, boolean>;

export const DEFAULT_TIP_PREFS: TipPrefs = {
  "first-run-checklist": true,
};

export function readTipPrefs(): TipPrefs {
  if (typeof window === "undefined") return DEFAULT_TIP_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_TIP_PREFS;
    const parsed = JSON.parse(raw) as Partial<TipPrefs>;
    return { ...DEFAULT_TIP_PREFS, ...parsed };
  } catch {
    return DEFAULT_TIP_PREFS;
  }
}

export function setTipEnabled(id: TipId, enabled: boolean) {
  if (typeof window === "undefined") return;
  const next = { ...readTipPrefs(), [id]: enabled };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function setAllTips(enabled: boolean) {
  if (typeof window === "undefined") return;
  const next = TIP_DEFS.reduce((acc, t) => ({ ...acc, [t.id]: enabled }), {} as TipPrefs);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useTipPrefs(): TipPrefs {
  const [prefs, setPrefs] = useState<TipPrefs>(DEFAULT_TIP_PREFS);
  useEffect(() => {
    function sync() {
      setPrefs(readTipPrefs());
    }
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return prefs;
}

export function replayTip(id: TipId) {
  if (typeof window === "undefined") return;
  setTipEnabled(id, true);
  const def = TIP_DEFS.find((t) => t.id === id);
  recordTipReset(def ? def.title : id);
}

export type TipResetEntry = { label: string; at: string };

const HISTORY_KEY = "fkf.tips.resetHistory";
const HISTORY_EVENT = "fkf:tip-reset-history-change";
const HISTORY_LIMIT = 10;

export function readTipResetHistory(): TipResetEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TipResetEntry[];
    return Array.isArray(parsed) ? parsed.filter((e) => e && e.label && e.at) : [];
  } catch {
    return [];
  }
}

export function recordTipReset(label: string) {
  if (typeof window === "undefined") return;
  const next = [{ label, at: new Date().toISOString() }, ...readTipResetHistory()].slice(
    0,
    HISTORY_LIMIT,
  );
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

export function clearTipResetHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

export function useTipResetHistory(): TipResetEntry[] {
  const [history, setHistory] = useState<TipResetEntry[]>([]);
  useEffect(() => {
    function sync() {
      setHistory(readTipResetHistory());
    }
    sync();
    window.addEventListener(HISTORY_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(HISTORY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return history;
}
