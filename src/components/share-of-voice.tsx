import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AccountIdentity } from "@/components/account-identity";

export type ShareOfVoiceEntry = {
  handle: string;
  name: string;
  posts: number;
  reach: number;
  share: number;
};

const SOV_BARS = ["hsl(var(--primary))", "#16a34a", "#0ea5e9", "#f59e0b", "#a855f7"];

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

/**
 * Share of voice — which personas drove the most reach in this window.
 * Quiet rows with slim bars; exact counts, shares and handles appear on hover,
 * the same pattern used on the Mentions and Brand health side panels.
 */
export function ShareOfVoice({ entries }: { entries: ShareOfVoiceEntry[] }) {
  const totalReach = entries.reduce((n, e) => n + e.reach, 0);
  const maxReach = entries.length > 0 ? Math.max(...entries.map((e) => e.reach)) : 0;

  const donut = entries
    .filter((e) => e.reach > 0)
    .map((e, i) => ({ name: e.name, value: e.reach, fill: SOV_BARS[i % SOV_BARS.length] }));

  const leader = entries[0];
  const meaning =
    totalReach === 0
      ? "No reach recorded in this window yet."
      : `${leader?.name ?? "—"} contributed the largest share of overall reach, accounting for ${leader?.share ?? 0}% of total impressions.`;

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-default items-center gap-2">
            <BarChart3 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold leading-tight">Share of voice</h3>
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
          <p className="text-lg font-semibold leading-none tabular-nums">{compact(totalReach)}</p>
          <p className="text-[11px] text-muted-foreground">total reach</p>
        </div>
      </div>

      <ul className="mt-3 grid gap-1.5">
        {entries.map((row, i) => (
          <li key={row.handle}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <AccountIdentity
                        handle={row.handle}
                        avatarClassName="size-4 rounded-full"
                        nameClassName="truncate text-muted-foreground"
                      />
                    </span>
                    <span className="shrink-0 tabular-nums font-medium">
                      {row.share}% · {compact(row.reach)} reach
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${maxReach > 0 ? Math.max((row.reach / maxReach) * 100, 2) : 0}%`,
                        backgroundColor: SOV_BARS[i % SOV_BARS.length],
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
                    <dt className="text-[11px] text-muted-foreground">Reach</dt>
                    <dd className="text-[11px] font-medium tabular-nums">
                      {row.reach.toLocaleString()} of {totalReach.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <dt className="text-[11px] text-muted-foreground">Share</dt>
                    <dd className="text-[11px] font-medium tabular-nums">{row.share}%</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <dt className="text-[11px] text-muted-foreground">Posts</dt>
                    <dd className="text-[11px] font-medium tabular-nums">{row.posts}</dd>
                  </div>
                </dl>
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </section>
  );
}
