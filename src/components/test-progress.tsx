import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

type Stage = { label: string; detail: string; weight: number };

export type TestPhase = "analysis" | "recommendations";

const ANALYSIS_STAGES: Stage[] = [
  { label: "Preparing your message", detail: "Reading text and attachments", weight: 8 },
  { label: "Briefing the persona panel", detail: "Loading 100 Kenyan personas", weight: 12 },
  {
    label: "Collecting persona reactions",
    detail: "Simulating how each persona responds",
    weight: 30,
  },
  {
    label: "Scoring clarity, trust & cultural fit",
    detail: "Computing confidence metrics",
    weight: 18,
  },
  { label: "Generating charts & clusters", detail: "Building the visual breakdown", weight: 17 },
  {
    label: "Drafting three stronger versions",
    detail: "Writing recommendations you can copy",
    weight: 15,
  },
];

const RECOMMENDATION_STAGES: Stage[] = [
  { label: "Reviewing panel reactions", detail: "Re-reading risks and objections", weight: 18 },
  { label: "Rewriting your message", detail: "Drafting three stronger versions", weight: 34 },
  {
    label: "Projecting persona response",
    detail: "Estimating confidence and share probability",
    weight: 28,
  },
  { label: "Ranking the options", detail: "Ordering by projected uplift", weight: 20 },
];

function stageIndexFor(progress: number, stages: Stage[], total: number) {
  let acc = 0;
  for (let i = 0; i < stages.length; i++) {
    acc += ((stages[i]?.weight ?? 0) / total) * 100;
    if (progress < acc) return i;
  }
  return stages.length - 1;
}

export function TestProgress({ label, phase = "analysis" }: { label?: string; phase?: TestPhase }) {
  const stages = phase === "recommendations" ? RECOMMENDATION_STAGES : ANALYSIS_STAGES;
  const total = stages.reduce((sum, s) => sum + s.weight, 0);
  const [progress, setProgress] = useState(4);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p >= 95 ? 95 : p + Math.max(0.6, (96 - p) / 28)));
    }, 220);
    const clock = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearInterval(id);
      clearInterval(clock);
    };
  }, []);

  const active = stageIndexFor(progress, stages, total);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const STAGES = stages;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-border bg-card px-6 py-10 duration-500 sm:px-10"
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
          <img
            src="/smait-logo.svg"
            alt="SMAIT logo"
            className="relative h-14 w-auto animate-pulse object-contain"
          />
        </div>

        <p className="mt-6 text-base font-semibold text-foreground">
          {label ??
            (phase === "recommendations"
              ? "Writing three stronger versions of your message"
              : "Running your message past all 100 personas")}
        </p>
        <p
          key={active}
          className="animate-in fade-in mt-1 text-sm text-muted-foreground duration-300"
        >
          {STAGES[active]?.detail}
        </p>

        <div className="mt-6 w-full max-w-md">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>
              Step {active + 1} of {STAGES.length} · {mins > 0 ? `${mins}m ` : ""}
              {secs}s elapsed
            </span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      <ul className="mx-auto mt-8 w-full max-w-md space-y-2.5">
        {STAGES.map((stage, i) => {
          const done = i < active;
          const isActive = i === active;
          return (
            <li
              key={stage.label}
              className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-sm transition-colors ${
                isActive
                  ? "border-primary/30 bg-primary/5 text-foreground"
                  : done
                    ? "border-transparent bg-muted/40 text-muted-foreground"
                    : "border-transparent text-muted-foreground/70"
              }`}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "text-primary"
                      : "bg-muted"
                }`}
              >
                {done ? (
                  <Check className="size-3" />
                ) : isActive ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
              </span>
              <span className={isActive ? "font-medium" : undefined}>{stage.label}</span>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-center text-xs text-muted-foreground">Keep this tab open - SMAIT</p>
    </div>
  );
}
