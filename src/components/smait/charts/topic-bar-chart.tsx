import { cn } from "@/lib/utils";
import { CATEGORICAL_PALETTE, CHART_COLORS } from "./chart-theme";

export interface TopicDatum {
  label: string;
  value: number;
  tone?: "positive" | "neutral" | "negative" | "warning" | "primary";
}

export interface TopicBarChartProps {
  data: TopicDatum[];
  max?: number;
  className?: string;
  valueSuffix?: string;
  colored?: boolean;
}

const TONE_MAP = {
  positive: CHART_COLORS.positive,
  neutral: CHART_COLORS.neutral,
  negative: CHART_COLORS.negative,
  warning: CHART_COLORS.warning,
  primary: CHART_COLORS.primary,
} as const;

/** Horizontal bar chart for topic/keyword rankings. */
export function TopicBarChart({
  data,
  max,
  className,
  valueSuffix = "",
  colored = false,
}: TopicBarChartProps) {
  const cap = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className={cn("space-y-2", className)}>
      {data.map((d, i) => {
        const pct = Math.max(0, Math.min(1, d.value / cap));
        const color = d.tone
          ? TONE_MAP[d.tone]
          : colored
            ? CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]
            : CHART_COLORS.primary;
        return (
          <li key={d.label}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="truncate text-foreground">{d.label}</span>
              <span className="font-semibold tabular-nums text-muted-foreground">
                {d.value.toLocaleString()}
                {valueSuffix}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="chart-bar-anim h-full rounded-full"
                style={{ width: `${pct * 100}%`, background: color, animationDelay: `${i * 60}ms` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
