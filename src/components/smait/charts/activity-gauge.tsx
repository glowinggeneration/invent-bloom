import { useId } from "react";
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "@/lib/utils";

export type ActivityGaugeDatum = {
  name: string;
  value: number;
  color?: string;
};

export type ActivityGaugeProps = {
  title: string;
  subtitle?: string;
  data: ActivityGaugeDatum[];
  max?: number;
  height?: number;
  className?: string;
};

export function ActivityGauge({
  title,
  subtitle,
  data,
  max = 100,
  height = 220,
  className,
}: ActivityGaugeProps) {
  const labelId = useId();
  const chartData = data.map((item, index) => ({
    ...item,
    value: Math.min(Math.max(item.value, 0), max),
    fill: item.color ?? `var(--chart-${(index % 5) + 1})`,
  }));

  return (
    <div className={cn("w-full", className)} role="img" aria-labelledby={labelId}>
      <span id={labelId} className="sr-only">
        {subtitle ? `${subtitle}: ` : ""}
        {title}. {chartData.map((item) => `${item.name} ${item.value}`).join(", ")}.
      </span>
      <ResponsiveContainer width="100%" height={height}>
        <RadialBarChart
          data={chartData}
          innerRadius="54%"
          outerRadius="88%"
          startAngle={90}
          endAngle={-270}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <PolarAngleAxis tick={false} domain={[0, max]} type="number" />
          <Tooltip
            formatter={(value: number) => [value.toLocaleString(), "Value"]}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
          />
          <RadialBar
            dataKey="value"
            cornerRadius={999}
            background={{ fill: "var(--muted)" }}
            isAnimationActive={false}
          />
          <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle">
            <tspan x="50%" className="fill-foreground text-xl font-semibold">
              {title}
            </tspan>
            {subtitle ? (
              <tspan x="50%" dy="1.8em" className="fill-muted-foreground text-xs">
                {subtitle}
              </tspan>
            ) : null}
          </text>
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}
