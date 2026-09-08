import { useEffect, useState } from "react";

export type FirstRunStep = "text" | "image" | "analysis" | "copy";

export type FirstRunState = Record<FirstRunStep, boolean>;

/** Live status of the analysis run, so the checklist mirrors reality. */
export type AnalysisStatus = "idle" | "running" | "completed" | "failed";

export type FirstRunMeta = {
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  analysisAt: string | null;
  copiedLabel: string | null;
  copiedAt: string | null;
};

const KEY = "smait.firstRun.checklist";
const META_KEY = "smait.firstRun.meta";
const DISMISS_KEY = "smait.firstRun.checklistDismissed";
const EVENT = "smait:first-run-change";

export const EMPTY_FIRST_RUN: FirstRunState = {
  text: false,
  image: false,
  analysis: false,
  copy: false,
};

export const EMPTY_FIRST_RUN_META: FirstRunMeta = {
  analysisStatus: "idle",
  analysisError: null,
  analysisAt: null,
  copiedLabel: null,
  copiedAt: null,
};

export function readFirstRunMeta(): FirstRunMeta {
  if (typeof window === "undefined") return EMPTY_FIRST_RUN_META;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return EMPTY_FIRST_RUN_META;
    return { ...EMPTY_FIRST_RUN_META, ...(JSON.parse(raw) as Partial<FirstRunMeta>) };
  } catch {
    return EMPTY_FIRST_RUN_META;
  }
}

function writeMeta(meta: FirstRunMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Record the real analysis lifecycle; "completed" also ticks the step. */
export function setAnalysisStatus(status: AnalysisStatus, error?: string) {
  if (typeof window === "undefined") return;
  const meta = readFirstRunMeta();
  writeMeta({
    ...meta,
    analysisStatus: status,
    analysisError: status === "failed" ? (error ?? "Analysis failed.") : null,
    analysisAt: status === "running" ? meta.analysisAt : new Date().toISOString(),
  });
  if (status === "completed") setFirstRunStep("analysis", true);
  if (status === "running" || status === "failed") setFirstRunStep("analysis", false);
}

/** Confirm a recommendation actually reached the clipboard. */
export function recordRecommendationCopied(label: string) {
  if (typeof window === "undefined") return;
  writeMeta({
    ...readFirstRunMeta(),
    copiedLabel: label,
    copiedAt: new Date().toISOString(),
  });
  setFirstRunStep("copy", true);
}

export function readFirstRun(): FirstRunState {
  if (typeof window === "undefined") return EMPTY_FIRST_RUN;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_FIRST_RUN;
    const parsed = JSON.parse(raw) as Partial<FirstRunState>;
    return { ...EMPTY_FIRST_RUN, ...parsed };
  } catch {
    return EMPTY_FIRST_RUN;
  }
}

function write(state: FirstRunState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function setFirstRunStep(step: FirstRunStep, done: boolean) {
  if (typeof window === "undefined") return;
  const current = readFirstRun();
  if (current[step] === done) return;
  write({ ...current, [step]: done });
}

export function markFirstRunStep(step: FirstRunStep) {
  setFirstRunStep(step, true);
}

export function isFirstRunDismissed() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissFirstRun() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function resetFirstRun() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(DISMISS_KEY);
    localStorage.removeItem(META_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useFirstRun() {
  const [state, setState] = useState<FirstRunState>(EMPTY_FIRST_RUN);
  const [meta, setMeta] = useState<FirstRunMeta>(EMPTY_FIRST_RUN_META);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    function sync() {
      setState(readFirstRun());
      setMeta(readFirstRunMeta());
      setDismissed(isFirstRunDismissed());
    }
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const steps: FirstRunStep[] = ["text", "image", "analysis", "copy"];
  const done = steps.filter((s) => state[s]).length;

  return { state, meta, dismissed, done, total: steps.length };
}
