import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";
import { CATEGORICAL_PALETTE, CHART_DEFAULTS } from "./chart-theme";

export interface TrendSeries {
  name: string;
  data: number[];
  color?: string;
}

export interface TrendChartProps {
  series: TrendSeries[];
  labels?: string[];
  height?: number;
  className?: string;
  showLegend?: boolean;
  showAxis?: boolean;
  filled?: boolean;
}

/** Multi-series line chart with optional filled areas. Pure SVG, no deps. */
export function TrendChart({
  series,
  labels,
  height = 160,
  className,
  showLegend = true,
  showAxis = true,
  filled = true,
}: TrendChartProps) {
  const gradId = useId().replace(/:/g, "");
  const width = 600;
  const padX = showAxis ? 32 : 4;
  const padY = 8;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const { min, max, ticks } = useMemo(() => {
    const all = series.flatMap((s) => s.data);
    const mn = Math.min(...all, 0);
    const mx = Math.max(...all, 1);
    const range = mx - mn || 1;
    const step = range / 3;
    return {
      min: mn,
      max: mx,
      ticks: [mn, mn + step, mn + step * 2, mx].map((v) => Math.round(v)),
    };
  }, [series]);

  const project = (v: number, i: number, len: number) => {
    const x = padX + (len <= 1 ? innerW / 2 : (i / (len - 1)) * innerW);
    const y = padY + innerH - ((v - min) / (max - min || 1)) * innerH;
    return { x, y };
  };

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" preserveAspectRatio="none">
        <defs>
          {series.map((s, i) => {
            const color = s.color ?? CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length];
            return (
              <linearGradient key={s.name} id={`${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>

        {showAxis &&
          ticks.map((t, i) => {
            const y = padY + innerH - ((t - min) / (max - min || 1)) * innerH;
            return (
              <g key={i}>
                <line
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke={CHART_DEFAULTS.gridStroke}
                  strokeDasharray="2 3"
                  strokeWidth={0.5}
                />
                <text
                  x={padX - 4}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={CHART_DEFAULTS.fontSize - 1}
                  fill={CHART_DEFAULTS.axisTick}
                >
                  {t}
                </text>
              </g>
            );
          })}

        {series.map((s, i) => {
          const color = s.color ?? CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length];
          const pts = s.data.map((v, idx) => project(v, idx, s.data.length));
          const line = pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
          const area =
            pts.length > 0
              ? `${line} L${pts[pts.length - 1]!.x},${padY + innerH} L${pts[0]!.x},${padY + innerH} Z`
              : "";
          return (
            <g key={s.name}>
              {filled && (
                <path
                  d={area}
                  fill={`url(#${gradId}-${i})`}
                  stroke="none"
                  className="chart-fade-anim"
                  style={{ animationDelay: `${i * 120 + 400}ms` }}
                />
              )}
              <path
                d={line}
                fill="none"
                stroke={color}
                strokeWidth={CHART_DEFAULTS.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="chart-line-anim"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            </g>
          );
        })}

        {showAxis && labels && labels.length > 0 && (
          <g>
            {labels.map((l, i) => {
              const len = labels.length;
              const x = padX + (len <= 1 ? innerW / 2 : (i / (len - 1)) * innerW);
              // Show first, last, and one middle label to avoid crowding.
              const show = i === 0 || i === len - 1 || i === Math.floor(len / 2);
              if (!show) return null;
              return (
                <text
                  key={i}
                  x={x}
                  y={height - 1}
                  textAnchor={i === 0 ? "start" : i === len - 1 ? "end" : "middle"}
                  fontSize={CHART_DEFAULTS.fontSize - 1}
                  fill={CHART_DEFAULTS.axisTick}
                >
                  {l}
                </text>
              );
            })}
          </g>
        )}
      </svg>

      {showLegend && series.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {series.map((s, i) => (
            <li key={s.name} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-3 rounded-sm"
                style={{
                  background: s.color ?? CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
                }}
              />
              <span className="text-muted-foreground">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
