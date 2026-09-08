import { useEffect, useState } from "react";

/**
 * Branded full-card loading screen shown while the user is being taken from
 * the "Choose a goal" grid to the dedicated campaign action page.
 */
export function CampaignActionLoading({ label }: { label?: string }) {
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p >= 94 ? 94 : p + Math.max(0.5, (95 - p) / 30)));
    }, 220);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-16 text-center"
    >
      <div className="relative">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
        <img
          src="/smait-logo.svg"
          alt="SMAIT logo"
          className="relative h-14 w-auto animate-pulse object-contain"
        />
      </div>

      <p className="mt-6 text-base font-semibold text-foreground">
        {label ? `Opening ${label}` : "Opening your campaign"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Preparing the tools for this campaign type…
      </p>

      <div className="mt-6 w-full max-w-sm">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>SMAIT</span>
          <span className="tabular-nums">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
}
