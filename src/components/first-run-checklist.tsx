import { Link } from "@tanstack/react-router";
import {
  Check,
  ImagePlus,
  Copy,
  Loader2,
  PenLine,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CornerButton } from "@/components/vengeance/corner-button";
import {
  dismissFirstRun,
  resetFirstRun,
  useFirstRun,
  type FirstRunMeta,
  type FirstRunStep,
} from "@/lib/first-run";

import { recordTipReset, useTipPrefs } from "@/lib/tip-prefs";
import { cn } from "@/lib/utils";

const STEPS: {
  key: FirstRunStep;
  icon: typeof PenLine;
  title: string;
  hint: string;
  optional?: boolean;
}[] = [
  {
    key: "text",
    icon: PenLine,
    title: "Enter your message",
    hint: "Paste the exact copy you plan to publish.",
  },
  {
    key: "image",
    icon: ImagePlus,
    title: "Upload an image",
    hint: "Attach the poster, graphic or brief (optional).",
    optional: true,
  },
  {
    key: "analysis",
    icon: Sparkles,
    title: "Run the analysis",
    hint: "Score the message against 100 Kenyan personas.",
  },
  {
    key: "copy",
    icon: Copy,
    title: "Copy a recommendation",
    hint: "Edit and copy one of the three rewrites.",
  },
];

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Live sub-label for a step, driven by the real run status. */
function stepStatus(
  key: FirstRunStep,
  meta: FirstRunMeta,
): { text: string; tone: "muted" | "running" | "error" | "success" } | null {
  if (key === "analysis") {
    if (meta.analysisStatus === "running") return { text: "Analysis running…", tone: "running" };
    if (meta.analysisStatus === "failed")
      return { text: meta.analysisError ?? "Analysis failed - try again.", tone: "error" };
    if (meta.analysisStatus === "completed")
      return {
        text: `Analysis completed${meta.analysisAt ? ` at ${timeLabel(meta.analysisAt)}` : ""}`,
        tone: "success",
      };
    return null;
  }
  if (key === "copy" && meta.copiedAt) {
    return {
      text: `Copied ${meta.copiedLabel ?? "a recommendation"} at ${timeLabel(meta.copiedAt)}`,
      tone: "success",
    };
  }
  return null;
}

function restartChecklist() {
  resetFirstRun();
  recordTipReset("First analysis checklist");
}

/** Minimum characters before the analysis is worth running. */
export const MIN_ANALYSIS_CHARS = 12;

export type ChecklistDraft = {
  textLength: number;
  hasImage: boolean;
  hasDocument: boolean;
};

/** Validation for the "Run analysis" step: text required, image optional. */
export function analysisBlockers(draft: ChecklistDraft): string[] {
  const blockers: string[] = [];
  if (draft.textLength === 0) {
    blockers.push("Enter the message you want to test in the composer.");
  } else if (draft.textLength < MIN_ANALYSIS_CHARS) {
    blockers.push(
      `Message is too short - add at least ${MIN_ANALYSIS_CHARS - draft.textLength} more character${
        MIN_ANALYSIS_CHARS - draft.textLength === 1 ? "" : "s"
      }.`,
    );
  }
  return blockers;
}

export function FirstRunChecklist({
  threadId,
  draft,
  onRunAnalysis,
  analysisPending,
}: {
  threadId?: string | undefined;
  /** Live composer state, used to validate the "Run analysis" step. */
  draft?: ChecklistDraft;
  onRunAnalysis?: () => void;
  analysisPending?: boolean;
}) {
  const { state, meta, dismissed, done, total } = useFirstRun();
  const tipPrefs = useTipPrefs();

  if (!tipPrefs["first-run-checklist"]) return null;
  if (dismissed) return null;

  const pct = Math.round((done / total) * 100);
  const complete = done === total;
  const blockers = draft ? analysisBlockers(draft) : [];
  const canRun = Boolean(draft) && blockers.length === 0 && !analysisPending;

  if (complete) {
    return (
      <section className="rounded-2xl border border-positive/40 bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Check className="size-4 text-positive" /> You're all set
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              All {total} message testing steps done. You can restart the walkthrough anytime.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label="Dismiss checklist"
            onClick={dismissFirstRun}
          >
            <X className="size-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={restartChecklist}>
          <RotateCcw className="size-4" /> Restart checklist
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Your first message analysis</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {done} of {total} steps done · {pct}%
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Restart checklist"
            title="Restart checklist"
            onClick={restartChecklist}
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Dismiss checklist"
            onClick={dismissFirstRun}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="First analysis progress"
      >
        <div
          className="h-full rounded-full bg-positive transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="mt-4 space-y-2.5">
        {STEPS.map((step) => {
          const complete = state[step.key];
          const status = stepStatus(step.key, meta);
          const running = status?.tone === "running";
          const failed = status?.tone === "error";
          const Icon = complete ? Check : failed ? TriangleAlert : running ? Loader2 : step.icon;
          return (
            <li key={step.key} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  complete
                    ? "border-positive bg-positive text-white"
                    : failed
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : running
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground",
                )}
              >
                <Icon className={cn("size-3.5", running && "animate-spin")} />
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    complete && "text-muted-foreground line-through",
                  )}
                >
                  {step.title}
                  {step.optional && !complete && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      optional
                    </span>
                  )}
                </span>
                {status ? (
                  <span
                    className={cn(
                      "block text-xs",
                      status.tone === "error"
                        ? "text-destructive"
                        : status.tone === "success"
                          ? "text-positive"
                          : status.tone === "running"
                            ? "text-primary"
                            : "text-muted-foreground",
                    )}
                    role={status.tone === "running" ? "status" : undefined}
                    aria-live={status.tone === "running" ? "polite" : undefined}
                  >
                    {status.text}
                  </span>
                ) : (
                  !complete && (
                    <span className="block text-xs text-muted-foreground">{step.hint}</span>
                  )
                )}
                {step.key === "analysis" && !complete && draft && blockers.length > 0 && (
                  <span className="mt-1 block space-y-0.5">
                    {blockers.map((b) => (
                      <span key={b} className="flex items-start gap-1.5 text-xs text-destructive">
                        <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                        {b}
                      </span>
                    ))}
                  </span>
                )}
                {step.key === "image" && !complete && draft && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    No image attached - analysis will run on text only.
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {draft && onRunAnalysis && !state.analysis && (
        <div className="mt-4">
          <CornerButton
            wrapperClassName="w-full flex justify-center"
            className="w-full justify-center"
            accentColor="var(--primary)"
            icon={analysisPending ? <Loader2 className="size-4 animate-spin" /> : undefined}
            onClick={onRunAnalysis}
            disabled={!canRun}
            aria-describedby={blockers.length ? "run-analysis-hints" : undefined}
          >
            {analysisPending ? "Running analysis…" : "Run analysis"}
          </CornerButton>
          <p
            id="run-analysis-hints"
            className="mt-1.5 text-center text-xs text-muted-foreground"
            aria-live="polite"
          >
            {analysisPending
              ? "Scoring against the persona panel…"
              : blockers.length
                ? blockers[0]
                : draft.hasImage
                  ? "Message and image ready."
                  : "Message ready - image is optional."}
          </p>
        </div>
      )}

      {state.analysis && !state.copy && threadId && (
        <Button asChild size="sm" className="mt-4 w-full">
          <Link to="/recommendations/$threadId" params={{ threadId }}>
            Open recommendations
          </Link>
        </Button>
      )}
    </section>
  );
}
