import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Activity, CalendarDays, MessageSquare } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ConversationSource = {
  name: string;
  value: number;
  share: number;
};

export type PeakDay = {
  date: string;
  reach: number;
  engagements: number;
};

const SOURCE_BARS = ["hsl(var(--primary))", "#16a34a", "#0ea5e9", "#f59e0b", "#a855f7"];

/**
 * Where the conversation happened — the split between persona posts, campaign
 * replies and scheduled replies — plus the days that carried the most reach.
 * Quiet rows with slim bars; exact counts and shares appear on hover, the same
 * pattern used on the Mentions and Brand health side panels.
 */
export function ConversationSources({
  sources,
  peakDays,
}: {
  sources: ConversationSource[];
  peakDays: PeakDay[];
}) {
  const total = sources.reduce((acc, s) => acc + s.value, 0);

  const donut = sources
    .map((s, i) => ({ name: s.name, value: s.value, fill: SOURCE_BARS[i % SOURCE_BARS.length] }))
    .filter((d) => d.value > 0);

  const leader = [...sources].sort((a, b) => b.value - a.value)[0];
  const meaning =
    total === 0
      ? "No activity in this window yet."
      : `${leader?.name ?? "Persona posts"} led the conversation at ${leader?.share ?? 0}% of all activity.`;

  return (
    <aside className="grid gap-3">
      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default items-center gap-2">
              <MessageSquare className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold leading-tight">
                Where the conversation happened
              </h3>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-56">
            {meaning}
          </TooltipContent>
        </Tooltip>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-16 w-16 shrink-0">
            {donut.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donut}
                    dataKey="value"
                    innerRadius="62%"
                    outerRadius="100%"
                    paddingAngle={1}
                    stroke="none"
                  >
                    {donut.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="size-full rounded-full border-8 border-muted" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-none tabular-nums">{total}</p>
            <p className="text-[11px] text-muted-foreground">items published</p>
          </div>
        </div>

        <ul className="mt-3 grid gap-1.5">
          {sources.map((row, i) => (
            <li key={row.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-default">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-muted-foreground">{row.name}</span>
                      <span className="shrink-0 tabular-nums font-medium">
                        {row.value} · {row.share}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(row.share, 2)}%`,
                          backgroundColor: SOURCE_BARS[i % SOURCE_BARS.length],
                        }}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="w-56 p-0">
                  <div className="border-b border-border px-3 py-2">
                    <p className="truncate text-xs font-semibold">{row.name}</p>
                  </div>
                  <dl className="divide-y divide-border">
                    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                      <dt className="text-[11px] text-muted-foreground">Items</dt>
                      <dd className="text-[11px] font-medium tabular-nums">
                        {row.value} of {total}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                      <dt className="text-[11px] text-muted-foreground">Share</dt>
                      <dd className="text-[11px] font-medium tabular-nums">{row.share}%</dd>
                    </div>
                  </dl>
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </section>

      {peakDays.length > 0 && (
        <section className="rounded-2xl border border-border/60 bg-card p-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex cursor-default items-center gap-2">
                <CalendarDays className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold leading-tight">Peak days</h3>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-56">
              The days that carried the most reach and engagement in this window.
            </TooltipContent>
          </Tooltip>

          <ul className="mt-3 space-y-2">
            {peakDays.map((d) => (
              <li key={d.date}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-default">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate text-muted-foreground">{d.date}</span>
                        <span className="shrink-0 tabular-nums font-medium">
                          {compact(d.reach)} reach
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${peakDays.length > 0 ? Math.max((d.reach / Math.max(...peakDays.map((p) => p.reach))) * 100, 4) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="w-56 p-0">
                    <div className="border-b border-border px-3 py-2">
                      <p className="truncate text-xs font-semibold">{d.date}</p>
                    </div>
                    <dl className="divide-y divide-border">
                      <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <dt className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <Activity className="size-3" /> Reach
                        </dt>
                        <dd className="text-[11px] font-medium tabular-nums">
                          {d.reach.toLocaleString()}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <dt className="text-[11px] text-muted-foreground">Engagements</dt>
                        <dd className="text-[11px] font-medium tabular-nums">
                          {d.engagements.toLocaleString()}
                        </dd>
                      </div>
                    </dl>
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}
