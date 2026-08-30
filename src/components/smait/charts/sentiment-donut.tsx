import { useMemo } from "react";
import { SENTIMENT_COLORS, type SentimentKey } from "./chart-theme";
import { cn } from "@/lib/utils";

export interface SentimentDonutProps {
  positive: number;
  neutral: number;
  negative: number;
  size?: number;
  stroke?: number;
  centerLabel?: string;
  className?: string;
  showLegend?: boolean;
}

/** Compact donut for a 3-way sentiment split. Values are normalised to 100%. */
export function SentimentDonut({
  positive,
  neutral,
  negative,
  size = 140,
  stroke = 16,
  centerLabel,
  className,
  showLegend = true,
}: SentimentDonutProps) {
  const parts = useMemo(() => {
    const total = Math.max(1, positive + neutral + negative);
    return (
      [
        { key: "positive", value: positive },
        { key: "neutral", value: neutral },
        { key: "negative", value: negative },
      ] as { key: SentimentKey; value: number }[]
    ).map((p) => ({ ...p, pct: p.value / total }));
  }, [positive, neutral, negative]);

  const r = 50 - stroke / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
          />
          {parts.map((p, idx) => {
            const dash = p.pct * c;
            const seg = (
              <circle
                key={p.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={SENTIMENT_COLORS[p.key]}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                className="chart-donut-anim"
                style={{ animationDelay: `${idx * 180}ms` }}
              />
            );
            offset += dash;
            return seg;
          })}
        </svg>
        {centerLabel && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center text-xs font-semibold text-muted-foreground">
              {centerLabel}
            </div>
          </div>
        )}
      </div>
      {showLegend && (
        <ul className="space-y-1.5 text-xs">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: SENTIMENT_COLORS[p.key] }}
              />
              <span className="capitalize text-muted-foreground">{p.key}</span>
              <span className="ml-1 font-semibold tabular-nums">{Math.round(p.pct * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
