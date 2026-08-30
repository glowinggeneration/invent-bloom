import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  id: string;
  label: string;
  description?: string;
}

export interface ProgressStepperProps {
  steps: StepperStep[];
  currentIndex: number;
  orientation?: "horizontal" | "vertical";
  className?: string;
  onStepClick?: (index: number) => void;
}

/** Numbered stepper showing a linear workflow. */
export function ProgressStepper({
  steps,
  currentIndex,
  orientation = "horizontal",
  className,
  onStepClick,
}: ProgressStepperProps) {
  const vertical = orientation === "vertical";
  return (
    <ol
      className={cn(vertical ? "flex flex-col gap-4" : "flex w-full items-center gap-2", className)}
      aria-label="Progress"
    >
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const state: "done" | "active" | "pending" = done ? "done" : active ? "active" : "pending";
        const dot = (
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-colors",
              state === "done" && "border-emerald-500 bg-emerald-500 text-white",
              state === "active" &&
                "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
              state === "pending" && "border-border bg-card text-muted-foreground",
            )}
            aria-current={active ? "step" : undefined}
          >
            {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
        );
        const label = (
          <div className={cn("min-w-0", vertical ? "" : "flex-1")}>
            <div
              className={cn(
                "text-xs font-semibold",
                state === "pending" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {s.label}
            </div>
            {s.description && (
              <div className="mt-0.5 text-[11px] text-muted-foreground">{s.description}</div>
            )}
          </div>
        );
        const clickable = !!onStepClick;
        return (
          <li
            key={s.id}
            className={cn(vertical ? "flex items-start gap-3" : "flex flex-1 items-center gap-2")}
          >
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick(i)}
                className={cn(
                  "flex items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  vertical ? "" : "flex-1",
                )}
              >
                {dot}
                {label}
              </button>
            ) : (
              <div className={cn("flex items-center gap-2", vertical ? "" : "flex-1")}>
                {dot}
                {label}
              </div>
            )}
            {!vertical && i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1 transition-colors",
                  done ? "bg-emerald-500/60" : "bg-border",
                )}
              />
            )}
            {vertical && i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute ml-3.5 mt-8 h-6 w-px",
                  done ? "bg-emerald-500/60" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
