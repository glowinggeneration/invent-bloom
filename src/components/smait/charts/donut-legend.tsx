/**
 * Donut with a side legend: the compact composition tile used across the
 * listening and coverage dashboards.
 */
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { ChartEmpty } from "./chart-empty";

export type DonutSlice = { label: string; value: number; color: string };

export const TONE_COLORS = {
  positive: "hsl(142 71% 45%)",
  neutral: "hsl(215 16% 55%)",
  negative: "hsl(0 72% 55%)",
};

export const SERIES_COLORS = [
  "hsl(var(--primary))",
  "hsl(38 92% 50%)",
  "hsl(0 72% 55%)",
  "hsl(215 16% 55%)",
  "hsl(280 55% 55%)",
  "hsl(142 71% 45%)",
  "hsl(199 89% 48%)",
  "hsl(24 90% 55%)",
];

export function DonutLegend({
  slices,
  center,
  centerCaption,
  hint,
}: {
  slices: DonutSlice[];
  center?: string;
  centerCaption?: string;
  hint?: string;
}) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return <ChartEmpty hint={hint} />;

  return (
    <div className="@container flex h-full flex-col gap-2 @[17rem]:flex-row @[17rem]:items-center @[17rem]:gap-4">
      <div className="relative min-h-24 w-full flex-1 @[17rem]:h-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={1}
              stroke="none"
            >
              {slices.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
          </PieChart>
        </ResponsiveContainer>
        {center && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-xl font-semibold tabular-nums text-foreground">
              {center}
            </span>
            {centerCaption && (
              <span className="max-w-[7rem] text-[10px] leading-tight text-muted-foreground">
                {centerCaption}
              </span>
            )}
          </div>
        )}
      </div>

      <ul className="max-h-[45%] shrink-0 space-y-1 overflow-y-auto text-[11px] @[17rem]:max-h-full @[17rem]:w-[46%] @[17rem]:max-w-[13rem] @[17rem]:space-y-1.5">
        {slices.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-foreground">
              {Math.round((d.value / total) * 100)}%
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              ({d.value.toLocaleString()})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
