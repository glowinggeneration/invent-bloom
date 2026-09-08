import { Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
} from "recharts";
import { Activity, Eye, Heart, MessageCircle } from "lucide-react";
import { ChartTooltip } from "@/components/chart-tooltip";
import { Card, SectionTitle } from "@/components/ui-kit";
import {
  changeLabel,
  formatCompact,
  type Delta,
  type OverviewData,
  type SentimentSplit,
} from "@/lib/overview";
import { cn } from "@/lib/utils";

const SENTIMENT_COLOURS = {
  positive: "hsl(152 60% 40%)",
  neutral: "hsl(0 0% 65%)",
  negative: "hsl(var(--destructive))",
} as const;

function DeltaLine({ value, unit }: { value: Delta; unit: string }) {
  const label = changeLabel(value.changePct);
  if (!label) return <span className="text-muted-foreground">No earlier {unit} to compare</span>;
  return (
    <span className={value.changePct! > 0 ? "text-positive" : "text-negative"}>
      {label} vs previous period
    </span>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  delta,
  unit,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  delta: Delta;
  unit: string;
}) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <p className="type-meta truncate">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{formatCompact(value)}</p>
      <p className="type-meta mt-2">
        <DeltaLine value={delta} unit={unit} />
      </p>
    </div>
  );
}

/** Sentiment bar used for the overall split and for each entity. */
export function SentimentBar({ split, className }: { split: SentimentSplit; className?: string }) {
  if (split.total === 0) {
    return <div className={cn("h-2 rounded-full bg-muted", className)} />;
  }
  return (
    <div className={cn("flex h-2 overflow-hidden rounded-full bg-muted", className)}>
      <div style={{ width: `${split.positivePct}%`, background: SENTIMENT_COLOURS.positive }} />
      <div style={{ width: `${split.neutralPct}%`, background: SENTIMENT_COLOURS.neutral }} />
      <div style={{ width: `${split.negativePct}%`, background: SENTIMENT_COLOURS.negative }} />
    </div>
  );
}

function SentimentLegend({ split }: { split: SentimentSplit }) {
  const rows = [
    { key: "positive", label: "Positive", count: split.positive, pct: split.positivePct },
    { key: "neutral", label: "Neutral", count: split.neutral, pct: split.neutralPct },
    { key: "negative", label: "Negative", count: split.negative, pct: split.negativePct },
  ] as const;
  return (
    <ul className="grid gap-1.5">
      {rows.map((row) => (
        <li key={row.key}>
          <Link
            to="/mentions"
            search={{ sentiment: row.key }}
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-muted/60"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: SENTIMENT_COLOURS[row.key] }}
              />
              <span className="type-meta truncate">{row.label}</span>
            </span>
            <span className="type-meta shrink-0 tabular-nums text-muted-foreground">
              {row.count} · {row.pct}%
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Full-width executive KPI strip: health, mentions, engagements, views, sentiment. */
export function OverviewKpis({ data }: { data: OverviewData }) {
  const { health } = data;
  const donut = [
    { name: "Positive", value: health.sentiment.positive, fill: SENTIMENT_COLOURS.positive },
    { name: "Neutral", value: health.sentiment.neutral, fill: SENTIMENT_COLOURS.neutral },
    { name: "Negative", value: health.sentiment.negative, fill: SENTIMENT_COLOURS.negative },
  ].filter((d) => d.value > 0);

  const scoreTone =
    health.score === null
      ? "text-muted-foreground"
      : health.score >= 70
        ? "text-positive"
        : health.score >= 45
          ? "text-foreground"
          : "text-negative";

  const previousScore = health.previousSentiment.total
    ? Math.round(health.previousSentiment.positivePct + health.previousSentiment.neutralPct * 0.5)
    : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="size-4 shrink-0" aria-hidden="true" />
            <p className="type-meta truncate">Brand health</p>
          </div>
          <p className={cn("mt-3 text-2xl font-semibold tracking-tight", scoreTone)}>
            {health.score === null ? "—" : `${health.score}/100`}
          </p>
          <p className="type-meta mt-2 text-muted-foreground">
            {health.score === null
              ? "Nothing here yet"
              : previousScore === null
                ? "Positive and neutral share of conversation"
                : `Previously ${previousScore}/100`}
          </p>
        </div>
        <Metric
          label="Mentions"
          value={health.mentions.value}
          icon={MessageCircle}
          delta={health.mentions}
          unit="mentions"
        />
        <Metric
          label="Engagements"
          value={health.engagements.value}
          icon={Heart}
          delta={health.engagements}
          unit="engagement"
        />
        <Metric
          label="Views"
          value={health.views.value}
          icon={Eye}
          delta={health.views}
          unit="views"
        />
      </div>

      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <SectionTitle>Sentiment</SectionTitle>
          <p className="type-meta text-muted-foreground">
            {health.sentiment.total} scored {health.sentiment.total === 1 ? "post" : "posts"}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-4">
          <div className="h-24">
            {donut.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donut}
                    dataKey="value"
                    innerRadius={30}
                    outerRadius={46}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {donut.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <RTooltip
                    content={
                      <ChartTooltip
                        valueLabel="posts"
                        help="Share of collected conversation carrying this tone."
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-full border border-dashed border-border text-muted-foreground">
                <span className="type-meta">Nothing here yet</span>
              </div>
            )}
          </div>
          <SentimentLegend split={health.sentiment} />
        </div>
      </Card>
    </div>
  );
}

/** Left rail: where the conversation happened, compact. */
export function ConversationMixCard({ data }: { data: OverviewData }) {
  const total = data.platforms.reduce((sum, p) => sum + p.count, 0);
  return (
    <Card className="p-4">
      <SectionTitle className="type-card">Conversation mix</SectionTitle>
      {data.platforms.length === 0 ? (
        <p className="type-meta mt-2 text-muted-foreground">Nothing here yet.</p>
      ) : (
        <>
          <ul className="mt-3 grid gap-2">
            {data.platforms.map((p) => (
              <li key={p.platform}>
                <Link
                  to="/mentions"
                  search={{ platform: p.filter }}
                  className="block rounded-lg px-1.5 py-1 transition-colors hover:bg-muted/60"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="type-meta truncate">{p.platform}</span>
                    <span className="type-meta shrink-0 tabular-nums text-muted-foreground">
                      {p.count} · {p.sharePct}%
                    </span>
                  </div>
                  <SentimentBar split={p.sentiment} className="mt-1.5 h-1.5" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-border pt-2">
            <span className="type-meta">Total</span>
            <span className="type-meta tabular-nums text-muted-foreground">{total}</span>
          </div>
        </>
      )}
    </Card>
  );
}

/** Left rail: organisation vs key-figure focus. */
export function EntityFocusCard({ data }: { data: OverviewData }) {
  const rows = [
    { label: data.entityLabels.org, split: data.entities.org },
    ...(data.entityLabels.keyFigure
      ? [{ label: data.entityLabels.keyFigure, split: data.entities.keyFigure }]
      : []),
  ];
  return (
    <Card className="p-4">
      <SectionTitle className="type-card">Conversation focus</SectionTitle>
      <div className="mt-3 grid gap-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="type-meta truncate">{row.label}</p>
              <p className="type-meta shrink-0 tabular-nums text-muted-foreground">
                {row.split.total}
              </p>
            </div>
            <SentimentBar split={row.split} className="mt-1.5 h-1.5" />
            <p className="type-meta mt-1 text-muted-foreground">
              {row.split.total === 0
                ? "No mentions in this window"
                : `${row.split.positivePct}% positive · ${row.split.negativePct}% negative`}
            </p>
          </div>
        ))}
        {!data.entityLabels.keyFigure && (
          <p className="type-meta text-muted-foreground">
            No key figures configured yet.{" "}
            <a href="/setup?edit=true" className="underline underline-offset-2">
              Add one in setup
            </a>{" "}
            to track them here.
          </p>
        )}
      </div>
    </Card>
  );
}

/** Centre: the conversation volume chart. */
export function VolumeCard({ data }: { data: OverviewData }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle>Conversation volume</SectionTitle>
        <p className="type-meta text-muted-foreground">
          {data.volume.today} in 24h · {data.volume.thisWeek} in 7 days ·{" "}
          <span className="tabular-nums">
            {changeLabel(data.volume.total.changePct) || "no earlier data"}
          </span>
        </p>
      </div>
      <div className="mt-4 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="overview-volume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.28} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <RTooltip
              content={
                <ChartTooltip
                  valueLabel="posts"
                  help="Posts collected across every connected platform in this time slice."
                />
              }
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              fill="url(#overview-volume)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
