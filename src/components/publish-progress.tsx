import { useEffect, useState } from "react";

const STAGES = [
  "Preparing your posts…",
  "Signing in to personas…",
  "Publishing tweets and comments…",
  "Cross-liking, retweeting and bookmarking…",
  "Following personas…",
  "Engaging monitored accounts…",
];

/**
 * Non-blocking publish indicator. Docks to the bottom-right so the run keeps
 * going in the background while the user composes and queues more tasks.
 */
export function PublishProgress({ label }: { label?: string }) {
  const [progress, setProgress] = useState(3);

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p >= 96 ? 96 : p + Math.max(0.4, (97 - p) / 34)));
    }, 240);
    return () => clearInterval(id);
  }, []);

  const stage = STAGES[Math.min(STAGES.length - 1, Math.floor((progress / 100) * STAGES.length))];

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex justify-center sm:inset-x-auto sm:right-5 sm:bottom-5 sm:justify-end"
    >
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur surface-elevated">
        <div className="relative shrink-0">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
          <img
            src="/smait-logo.svg"
            alt="SMAIT logo"
            className="relative h-8 w-auto animate-pulse object-contain"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {label ?? "Publishing across your personas"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{stage}</p>

          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
