import type { ReactElement } from "react";
import { useId } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "@/lib/utils";

export type CompactPieDatum = {
  name: string;
  value: number;
  color?: string | undefined;
};

export type CompactPieChartProps = {
  data: CompactPieDatum[];
  height?: number;
  className?: string;
  showLegend?: boolean;
  innerRadius?: number | string;
  outerRadius?: number | string;
  ariaLabel?: string;
  tooltipContent?: ReactElement;
  onSliceClick?: (name: string) => void;
};

/** A reusable donut chart for compact composition and share summaries. */
export function CompactPieChart({
  data,
  height = 120,
  className,
  showLegend = true,
  innerRadius = "50%",
  outerRadius = "82%",
  ariaLabel = "Distribution",
  tooltipContent,
  onSliceClick,
}: CompactPieChartProps) {
  const labelId = useId();
  const visibleData = data.filter((item) => item.value > 0);

  if (visibleData.length === 0) {
    return (
      <div
        role="img"
        aria-label={`${ariaLabel}. No data available.`}
        className={cn("grid place-items-center", className)}
        style={{ height }}
      >
        <span className="size-12 rounded-full border-8 border-muted" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} role="img" aria-labelledby={labelId}>
      <span id={labelId} className="sr-only">
        {ariaLabel}. {visibleData.map((item) => `${item.name}: ${item.value}`).join(", ")}.
      </span>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          {showLegend ? (
            <Legend
              verticalAlign="middle"
              align="right"
              layout="vertical"
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
          <Pie
            data={visibleData}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={1.5}
            stroke="none"
            isAnimationActive={false}
            {...(onSliceClick ? { className: "cursor-pointer" } : {})}
            onClick={(entry: CompactPieDatum) => onSliceClick?.(entry.name)}
          >
            {visibleData.map((item, index) => (
              <Cell key={item.name} fill={item.color ?? `var(--chart-${(index % 5) + 1})`} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
