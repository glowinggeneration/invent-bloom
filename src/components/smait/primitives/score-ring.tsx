import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ScoreRingTone = "primary" | "success" | "warning" | "danger" | "muted";

const TONE_CLASS: Record<ScoreRingTone, string> = {
  primary: "text-primary",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-red-500",
  muted: "text-muted-foreground",
};

function autoTone(pct: number, invert?: boolean): ScoreRingTone {
  const v = invert ? 100 - pct : pct;
  if (v >= 75) return "success";
  if (v >= 55) return "primary";
  if (v >= 35) return "warning";
  return "danger";
}

export interface ScoreRingProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  tone?: ScoreRingTone;
  invert?: boolean;
  animate?: boolean;
  className?: string;
  showValue?: boolean;
  suffix?: string;
}

/** Circular score gauge. Renders a value ring with an optional label. */
export function ScoreRing({
  value,
  max = 100,
  size = 128,
  stroke = 10,
  label,
  sublabel,
  tone,
  invert,
  animate = true,
  className,
  showValue = true,
  suffix,
}: ScoreRingProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  const [anim, setAnim] = useState(animate ? 0 : pct);
  useEffect(() => {
    if (!animate) return setAnim(pct);
    const raf = requestAnimationFrame(() => setAnim(pct));
    return () => cancelAnimationFrame(raf);
  }, [pct, animate]);

  const resolvedTone = tone ?? autoTone(pct * 100, invert);
  const r = 50 - stroke / 2;
  const c = 2 * Math.PI * r;
  const dash = anim * c;

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        label ? `${label}: ${Math.round(value)} of ${max}` : `${Math.round(value)} of ${max}`
      }
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" className="stroke-muted" strokeWidth={stroke} />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          className={cn(
            "stroke-current transition-[stroke-dasharray] duration-700 ease-out",
            TONE_CLASS[resolvedTone],
          )}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          {showValue && (
            <div
              className={cn(
                "text-2xl font-bold tabular-nums leading-none",
                TONE_CLASS[resolvedTone],
              )}
            >
              {Math.round(value)}
              {suffix ? <span className="ml-0.5 text-sm font-semibold">{suffix}</span> : null}
            </div>
          )}
          {label && (
            <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
          )}
          {sublabel && (
            <div className="mt-0.5 text-[10px] text-muted-foreground/80">{sublabel}</div>
          )}
        </div>
      </div>
    </div>
  );
}
