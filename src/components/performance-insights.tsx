import { Activity, Clock3, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import type { PerformanceSummary } from "@/lib/performance";
import { formatCount } from "@/lib/performance";

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function sumDays(days: PerformanceSummary["byDay"]) {
  return days.reduce(
    (acc, day) => ({
      impressions: acc.impressions + day.impressions,
      engagements: acc.engagements + day.engagements,
      reach: acc.reach + day.reach,
    }),
    { impressions: 0, engagements: 0, reach: 0 },
  );
}

function kenyaHour(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-KE", {
    hour: "numeric",
    hour12: true,
    timeZone: "Africa/Nairobi",
  }).format(date);
}

function bestHour(rows: PerformanceSummary["rows"]) {
  const groups = new Map<string, { items: number; engagements: number; impressions: number }>();
  for (const row of rows) {
    const hour = kenyaHour(row.tweetedAt);
    if (!hour) continue;
    const group = groups.get(hour) ?? { items: 0, engagements: 0, impressions: 0 };
    group.items += 1;
    group.engagements += row.engagements;
    group.impressions += row.impressions;
    groups.set(hour, group);
  }
  const ranked = [...groups.entries()]
    .filter(([, value]) => value.items >= 2)
    .map(([hour, value]) => ({
      hour,
      ...value,
      engagementRate:
        value.impressions > 0 ? Math.round((value.engagements / value.impressions) * 1000) / 10 : 0,
      avgEngagements: Math.round(value.engagements / value.items),
    }))
    .sort(
      (a, b) =>
        b.engagementRate - a.engagementRate ||
        b.avgEngagements - a.avgEngagements ||
        b.items - a.items,
    );
  return ranked[0] ?? null;
}

function anomaly(days: PerformanceSummary["byDay"]) {
  if (days.length < 4) return null;
  const values = days.map((day) => day.engagements);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (avg <= 0) return null;
  const latest = days[days.length - 1];
  if (!latest) return null;
  const ratio = latest.engagements / avg;
  if (ratio >= 1.8 && latest.engagements >= 10) {
    return {
      direction: "up" as const,
      date: latest.date,
      value: latest.engagements,
      ratio,
    };
  }
  if (ratio <= 0.45 && avg >= 10) {
    return {
      direction: "down" as const,
      date: latest.date,
      value: latest.engagements,
      ratio,
    };
  }
  return null;
}

function ComparisonRow({
  label,
  current,
  previous,
}: {
  label: string;
  current: number;
  previous: number;
}) {
  const change = pctChange(current, previous);
  const positive = change !== null && change > 0;
  const negative = change !== null && change < 0;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="type-meta text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-right">
        <span className="type-body font-semibold tabular-nums">{formatCount(current)}</span>
        <span
          className={`inline-flex min-w-16 items-center justify-end gap-1 type-meta font-semibold ${
            positive ? "text-emerald-600" : negative ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {positive ? (
            <TrendingUp className="size-3.5" />
          ) : negative ? (
            <TrendingDown className="size-3.5" />
          ) : null}
          {change === null ? "—" : `${change > 0 ? "+" : ""}${change}%`}
        </span>
      </span>
    </div>
  );
}

export function PerformanceInsights({ data }: { data: PerformanceSummary }) {
  const days = data.byDay;
  const recentDays = days.slice(-7);
  const previousDays = days.slice(Math.max(0, days.length - 14), Math.max(0, days.length - 7));
  const recent = sumDays(recentDays);
  const previous = sumDays(previousDays);
  const best = bestHour(data.rows);
  const unusual = anomaly(days);
  const canCompare = previousDays.length > 0;

  if (!canCompare && !best && !unusual) return null;

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {canCompare ? (
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <SectionTitle>How this compares</SectionTitle>
          </div>
          <p className="type-meta mt-1 text-muted-foreground">
            Latest {recentDays.length} recorded days versus the preceding {previousDays.length}.
          </p>
          <div className="mt-3">
            <ComparisonRow
              label="Engagements"
              current={recent.engagements}
              previous={previous.engagements}
            />
            <ComparisonRow
              label="Impressions"
              current={recent.impressions}
              previous={previous.impressions}
            />
            <ComparisonRow label="Reach" current={recent.reach} previous={previous.reach} />
          </div>
        </Card>
      ) : null}

      {best ? (
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-primary" />
            <SectionTitle>Your best time to post</SectionTitle>
          </div>
          <p className="type-display mt-4">{best.hour}</p>
          <p className="type-meta mt-1 text-muted-foreground">
            East Africa Time, from your own published history.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/40 p-3">
              <dt className="type-meta text-muted-foreground">Engagement rate</dt>
              <dd className="type-card mt-1 font-semibold">{best.engagementRate}%</dd>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <dt className="type-meta text-muted-foreground">Items measured</dt>
              <dd className="type-card mt-1 font-semibold">{best.items}</dd>
            </div>
          </dl>
          <p className="type-meta mt-3 text-muted-foreground">
            Based on your own history — not a guarantee for next time.
          </p>
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-4 text-primary" />
          <SectionTitle>Worth watching</SectionTitle>
        </div>
        {unusual ? (
          <>
            <p className="type-card mt-4 font-semibold">
              {unusual.direction === "up" ? "Engagement spiked" : "Engagement dropped"}
            </p>
            <p className="type-meta mt-1 text-muted-foreground">
              {new Date(`${unusual.date}T00:00:00Z`).toLocaleDateString("en-KE", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              recorded {formatCount(unusual.value)} engagements, about {unusual.ratio.toFixed(1)}×
              the average recorded day in this view.
            </p>
          </>
        ) : (
          <p className="type-meta mt-4 text-muted-foreground">
            Nothing unusual to report for this period.
          </p>
        )}
      </Card>
    </section>
  );
}
