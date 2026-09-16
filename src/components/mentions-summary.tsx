import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Frown, Meh, MessageSquare, MessageSquareReply, Smile } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type MentionsSummaryCounts = {
  positive: number;
  neutral: number;
  negative: number;
  directReplies: number;
  all: number;
};

type FilterKey = "all" | "positive" | "neutral" | "negative" | "direct-replies";

/**
 * Right-hand read on the mention mix: one row per sentiment, a donut and a
 * plain-language line saying what the split means.
 */
export function MentionsSummary({
  counts,
  activeFilter,
  onSelect,
}: {
  counts: MentionsSummaryCounts;
  activeFilter?: FilterKey;
  onSelect?: (key: FilterKey) => void;
}) {
  const total = counts.all || 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const rows = [
    {
      key: "positive" as const,
      label: "Positive",
      count: counts.positive,
      icon: Smile,
      accent: "bg-positive",
      chip: "bg-positive/10 text-positive dark:text-positive",
      dot: "var(--positive)",
      dotClass: "bg-positive",
    },
    {
      key: "neutral" as const,
      label: "Neutral",
      count: counts.neutral,
      icon: Meh,
      accent: "bg-info",
      chip: "bg-info/10 text-info dark:text-info",
      dot: "var(--info)",
      dotClass: "bg-info",
    },
    {
      key: "negative" as const,
      label: "Negative",
      count: counts.negative,
      icon: Frown,
      accent: "bg-negative",
      chip: "bg-negative/10 text-negative dark:text-negative",
      dot: "var(--negative)",
      dotClass: "bg-negative",
    },
  ];

  const donut = rows
    .map((r) => ({ name: r.label, value: r.count, fill: r.dot }))
    .filter((d) => d.value > 0);

  const leader = [...rows].sort((a, b) => b.count - a.count)[0] ?? rows[0]!;
  const meaning =
    total === 0
      ? "No mentions in this window yet."
      : `${leader.label === "Neutral" ? "There are more neutral mentions than positive or negative." : `${leader.label} mentions lead this window at ${pct(leader.count)}%.`}${
          counts.directReplies > 0
            ? ` ${counts.directReplies} ${counts.directReplies === 1 ? "user" : "users"} engaged directly with replies.`
            : ""
        }`;

  return (
    <aside className="grid gap-3">
      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default items-center gap-2">
              <MessageSquare className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold leading-tight">Sentiment</h3>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-56">
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
            <p className="text-[11px] text-muted-foreground">mentions in view</p>
          </div>
        </div>

        <ul className="mt-3 grid gap-1.5">
          {[
            ...rows,
            {
              key: "direct-replies" as const,
              label: "Direct replies",
              count: counts.directReplies,
              icon: MessageSquareReply,
              accent: "bg-primary",
              chip: "bg-primary/10 text-primary",
              dot: "hsl(var(--primary))",
              dotClass: "bg-primary",
            },
          ].map((row) => {
            const Icon = row.icon;
            const active = activeFilter === row.key;
            return (
              <li key={row.key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelect?.(active ? "all" : row.key)}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        active ? "border-foreground/30 bg-muted/30" : "border-transparent"
                      }`}
                    >
                      <Icon
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <span
                          className={`size-2 shrink-0 rounded-full ${row.dotClass}`}
                          aria-hidden="true"
                        />
                        {row.label}
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums">
                        {row.count}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="w-56 p-0">
                    <div className="border-b border-border px-3 py-2">
                      <p className="truncate text-xs font-semibold">{row.label}</p>
                    </div>
                    <dl className="divide-y divide-border">
                      <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <dt className="text-[11px] text-muted-foreground">
                          {row.key === "direct-replies" ? "People" : "Mentions"}
                        </dt>
                        <dd className="text-[11px] font-medium tabular-nums">
                          {row.count}
                          {row.key === "direct-replies" ? "" : ` of ${total}`}
                        </dd>
                      </div>
                      {row.key !== "direct-replies" && (
                        <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                          <dt className="text-[11px] text-muted-foreground">Share</dt>
                          <dd className="text-[11px] font-medium tabular-nums">
                            {pct(row.count)}%
                          </dd>
                        </div>
                      )}
                    </dl>
                    <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
                      Click to filter
                    </p>
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
