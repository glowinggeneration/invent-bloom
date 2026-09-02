import type { ReactElement } from "react";
import { useId } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { cn } from "@/lib/utils";

export type RadarSeries = {
  dataKey: string;
  label: string;
  color?: string | undefined;
};

export type ComparisonRadarChartProps = {
  data: Array<Record<string, string | number>>;
  labelKey: string;
  series: RadarSeries[];
  max?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
  tooltipContent?: ReactElement;
  onLabelSelect?: (label: string) => void;
};

/** One or more series compared across the same set of qualitative dimensions. */
export function ComparisonRadarChart({
  data,
  labelKey,
  series,
  max = 100,
  height = 320,
  className,
  ariaLabel = "Radar chart",
  tooltipContent,
  onLabelSelect,
}: ComparisonRadarChartProps) {
  const labelId = useId();

  return (
    <div className={cn("w-full", className)} role="img" aria-labelledby={labelId}>
      <span id={labelId} className="sr-only">
        {ariaLabel}. {data.map((item) => String(item[labelKey])).join(", ")}.
      </span>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart
          data={data}
          outerRadius="72%"
          margin={{ top: 10, right: 24, bottom: series.length > 1 ? 20 : 0, left: 24 }}
          {...(onLabelSelect ? { className: "cursor-pointer" } : {})}
          onClick={(state: { activeLabel?: string }) => {
            if (state?.activeLabel) onLabelSelect?.(state.activeLabel);
          }}
        >
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey={labelKey}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
          />
          <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
          {series.length > 1 ? (
            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: 11 }}
            />
          ) : null}
          <Tooltip
            {...(tooltipContent ? { content: tooltipContent } : {})}
            formatter={(value: number, name: string) => [value.toLocaleString(), name]}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
          />
          {series.map((item, index) => {
            const color = item.color ?? `var(--chart-${(index % 5) + 1})`;
            return (
              <Radar
                key={item.dataKey}
                dataKey={item.dataKey}
                name={item.label}
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                fill={color}
                fillOpacity={0.18}
                isAnimationActive={false}
                activeDot={{ r: 4, fill: "var(--background)", stroke: color, strokeWidth: 2 }}
              />
            );
          })}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
