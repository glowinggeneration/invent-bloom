import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "danger";

const TONE_PILL: Record<Tone, string> = {
  default: "bg-pastel-sky/70 text-foreground",
  success: "bg-pastel-mint/70 text-foreground",
  warning: "bg-pastel-peach/70 text-foreground",
  danger: "bg-pastel-coral/70 text-foreground",
};

const TONE_BAR: Record<Tone, string> = {
  default: "bg-foreground/70",
  success: "bg-emerald-500/80",
  warning: "bg-amber-500/80",
  danger: "bg-rose-500/80",
};

export function KpiTile({
  label,
  value,
  suffix,
  trend,
  tone = "default",
  icon,
  sparkline,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: number;
  tone?: Tone;
  icon?: ReactNode;
  sparkline?: number[];
}) {
  const bars =
    sparkline && sparkline.length > 1
      ? sparkline
      : Array.from(
          { length: 32 },
          (_, i) =>
            0.3 +
            0.7 * Math.abs(Math.sin(i * 0.9 + (typeof value === "number" ? value : 0) * 0.01)),
        );

  const max = Math.max(...bars);

  return (
    <div className="group relative flex flex-col justify-between rounded-3xl bg-card p-5 shadow-card backdrop-blur-md transition-shadow hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1 min-w-0">
            <span
              className={cn(
                "font-display font-semibold tracking-tight tabular-nums text-foreground truncate",
                typeof value === "number" ? "text-4xl md:text-5xl" : "text-2xl md:text-3xl",
              )}
            >
              {typeof value === "number" ? String(value).padStart(2, "0") : value}
            </span>
            {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
        {icon && (
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
              TONE_PILL[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="mt-5 flex h-8 items-end gap-[3px]" aria-hidden="true">
        {bars.map((v, i) => (
          <span
            key={i}
            className={cn("chart-bar-anim-y w-full rounded-full", TONE_BAR[tone])}
            style={{
              height: `${Math.max(8, (v / max) * 100)}%`,
              opacity: 0.35 + (v / max) * 0.65,
              transformOrigin: "bottom",
              animationDelay: `${i * 20}ms`,
            }}
          />
        ))}
      </div>

      {typeof trend === "number" && (
        <div className="mt-3 flex items-center gap-1 text-[11px]">
          {trend > 0 ? (
            <TrendingUp className="h-3 w-3 text-emerald-600" />
          ) : trend < 0 ? (
            <TrendingDown className="h-3 w-3 text-rose-600" />
          ) : (
            <Minus className="h-3 w-3 text-muted-foreground" />
          )}
          <span
            className={cn(
              "font-medium tabular-nums",
              trend > 0
                ? "text-emerald-600"
                : trend < 0
                  ? "text-rose-600"
                  : "text-muted-foreground",
            )}
          >
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
          <span className="text-muted-foreground">vs. last 30d</span>
        </div>
      )}
    </div>
  );
}
