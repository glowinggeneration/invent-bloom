import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  delta?: number;
  deltaLabel?: string;
  invertDelta?: boolean; // when true, negative delta is good (e.g. risk)
  icon?: ReactNode;
  hint?: string;
  className?: string;
  onClick?: () => void;
}

/** Dense metric card - a lighter, more compact alternative to KpiTile. */
export function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  invertDelta,
  icon,
  hint,
  className,
  onClick,
}: MetricCardProps) {
  const hasDelta = typeof delta === "number" && !Number.isNaN(delta);
  const isFlat = hasDelta && Math.abs(delta!) < 0.05;
  const positive = hasDelta && (invertDelta ? delta! < 0 : delta! > 0);
  const negative = hasDelta && !isFlat && !positive;
  const deltaTone = isFlat
    ? "text-muted-foreground"
    : positive
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  const Wrap: React.ElementType = onClick ? "button" : "div";
  return (
    <Wrap
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-colors",
        onClick &&
          "hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </div>
      <div className="text-2xl font-bold tabular-nums leading-none">{value}</div>
      {(hasDelta || hint) && (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          {hasDelta && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", deltaTone)}>
              {isFlat ? (
                <Minus className="h-3 w-3" />
              ) : positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(delta!).toFixed(1)}%
              {deltaLabel && <span className="ml-1 text-muted-foreground">{deltaLabel}</span>}
            </span>
          )}
          {hint && !hasDelta && <span className="text-muted-foreground">{hint}</span>}
          {hint && hasDelta && <span className="truncate text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Wrap>
  );
}
