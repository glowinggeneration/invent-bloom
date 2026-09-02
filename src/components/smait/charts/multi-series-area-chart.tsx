import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

export type MultiSeriesArea = {
  dataKey: string;
  label: string;
  color?: string;
};

export type MultiSeriesAreaChartProps = {
  data: Array<Record<string, string | number>>;
  series: MultiSeriesArea[];
  labelKey: string;
  height?: number;
  className?: string;
  formatLabel?: (value: string) => string;
  formatValue?: (value: number) => string;
};

export function MultiSeriesAreaChart({
  data,
  series,
  labelKey,
  height = 288,
  className,
  formatLabel = String,
  formatValue = (value) => value.toLocaleString(),
}: MultiSeriesAreaChartProps) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ left: -12, right: 4, top: 12, bottom: 0 }}>
          <defs>
            {series.map((item, index) => (
              <linearGradient
                key={item.dataKey}
                id={`${gradientId}-${index}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={item.color ?? `var(--chart-${(index % 5) + 1})`}
                  stopOpacity={0.24}
                />
                <stop
                  offset="95%"
                  stopColor={item.color ?? `var(--chart-${(index % 5) + 1})`}
                  stopOpacity={0}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey={labelKey}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: string) => formatLabel(value)}
            minTickGap={28}
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={42}
            tickFormatter={(value: number) => formatValue(value)}
          />
          <Tooltip
            formatter={(value: number, name: string) => [formatValue(value), name]}
            labelFormatter={(value: string) => formatLabel(value)}
            cursor={{ stroke: "var(--primary)", strokeWidth: 1.5 }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((item, index) => {
            const color = item.color ?? `var(--chart-${(index % 5) + 1})`;
            return (
              <Area
                key={item.dataKey}
                type="monotone"
                dataKey={item.dataKey}
                name={item.label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId}-${index})`}
                activeDot={{ r: 4, fill: "var(--background)", stroke: color, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
