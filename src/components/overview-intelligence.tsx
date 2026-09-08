import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  History,
  Lightbulb,
  Radar,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui-kit";
import { SourceAuthorityPanel } from "@/components/source-authority-panel";
import { getOverviewIntelligence } from "@/lib/overview-intelligence.functions";

const importanceStyle = {
  Critical: "bg-destructive/10 text-destructive",
  "High impact": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Relevant: "bg-primary/10 text-primary",
  "Low signal": "bg-muted text-muted-foreground",
} as const;

function changeLabel(value: number): string {
  if (value > 0) return `+${value}%`;
  if (value < 0) return `${value}%`;
  return "Normal";
}

/** One shared query for every intelligence surface on the Overview page. */
export function useOverviewIntelligence() {
  const fetchIntelligence = useServerFn(getOverviewIntelligence);
  return useQuery({
    queryKey: ["overview-intelligence"],
    queryFn: () => fetchIntelligence(),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-muted ${className ?? "h-40"}`} />;
}

/** Left rail: how this week compares with the stored baseline. */
export function ComparedWithNormalCard() {
  const { data, isPending } = useOverviewIntelligence();
  if (isPending) return <Skeleton className="h-48" />;
  if (!data) return null;

  const rows = [
    {
      label: "Mentions",
      value: data.currentMentions.toLocaleString(),
      change: changeLabel(data.comparedWithNormal.mentionVsNormal),
      normal: `${data.comparedWithNormal.normalWeeklyMentions} per week`,
    },
    {
      label: "Negative share",
      value: `${data.currentNegativeShare}%`,
      change: `${data.comparedWithNormal.negativeVsNormal > 0 ? "+" : ""}${data.comparedWithNormal.negativeVsNormal} pts`,
      normal: `${data.comparedWithNormal.normalNegativeShare}%`,
    },
    {
      label: "Recorded views",
      value: data.currentViews.toLocaleString(),
      change: changeLabel(data.comparedWithNormal.viewsVsNormal),
      normal: `${data.comparedWithNormal.normalWeeklyViews.toLocaleString()} per week`,
    },
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <History className="size-4 text-muted-foreground" aria-hidden="true" />
        <SectionTitle className="type-card">Compared with normal</SectionTitle>
      </div>
      <ul className="mt-3 grid gap-2.5">
        {rows.map((row) => (
          <li key={row.label} className="border-b border-border pb-2.5 last:border-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="type-meta truncate">{row.label}</span>
              <span className="type-meta shrink-0 tabular-nums font-semibold">{row.value}</span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <span className="type-meta text-muted-foreground">Normal: {row.normal}</span>
              <span className="type-meta shrink-0 tabular-nums text-muted-foreground">
                {row.change}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Centre: ranked narrative feed. */
export function TopNarrativesCard() {
  const { data, isPending } = useOverviewIntelligence();
  if (isPending) return <Skeleton className="h-64" />;
  if (!data || data.narratives.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Radar className="size-4 text-muted-foreground" aria-hidden="true" />
            <SectionTitle>What people are talking about</SectionTitle>
          </div>
          <p className="type-meta mt-1 text-muted-foreground">
            The biggest conversations right now, ranked by impact and momentum.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/mentions">View all</Link>
        </Button>
      </div>

      <ul className="mt-4 grid gap-2">
        {data.narratives.map((n, index) => (
          <li key={n.id}>
            <details className="group rounded-xl border border-border/60 px-3 py-3 transition-colors open:bg-muted/30 hover:bg-muted/40">
              <summary className="grid cursor-pointer list-none grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_auto]">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted type-meta font-semibold">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="type-body block truncate font-medium">{n.label}</span>
                  <span className="type-meta text-muted-foreground">
                    {n.mentions} mentions · {n.views.toLocaleString()} views · {n.negative}%
                    negative
                  </span>
                </span>
                <span className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:justify-end">
                  <span className="rounded-full bg-muted px-2 py-0.5 type-meta">{n.velocity}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 type-meta font-semibold ${importanceStyle[n.importance]}`}
                  >
                    {n.importance}
                  </span>
                </span>
              </summary>

              <div className="mt-3 flex flex-wrap gap-2 type-meta">
                <span className="rounded-full bg-muted px-2 py-1">{n.lifecycle}</span>
                <span className="rounded-full bg-muted px-2 py-1">
                  {n.growth > 0 ? "+" : ""}
                  {n.growth}% vs previous week
                </span>
                <span className="rounded-full bg-muted px-2 py-1">
                  {n.vsNormal > 0 ? "+" : ""}
                  {n.vsNormal}% vs normal
                </span>
              </div>
              <Button asChild variant="ghost" size="sm" className="mt-2 gap-1 px-2 text-primary">
                <Link to="/mentions" search={{ topic: n.query }}>
                  Investigate mentions <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </details>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Right rail: what could go wrong. */
export function RisksCard() {
  const { data, isPending } = useOverviewIntelligence();
  if (isPending) return <Skeleton className="h-40" />;
  if (!data) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
        <SectionTitle className="type-card">Risks to watch</SectionTitle>
      </div>
      {data.risks.length ? (
        <ul className="mt-3 grid gap-2.5">
          {data.risks.slice(0, 3).map((risk) => (
            <li key={risk.title} className="rounded-xl bg-destructive/5 p-3">
              <p className="type-body font-semibold">{risk.title}</p>
              <p className="mt-1 type-meta text-muted-foreground">{risk.detail}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/mentions" search={{ topic: risk.query }}>
                    Investigate
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/new"
                    search={{
                      text: `Prepare a response to the emerging conversation about ${risk.title}.`,
                    }}
                  >
                    Respond
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 type-meta text-muted-foreground">
          Nothing negative is picking up speed right now.
        </p>
      )}
    </Card>
  );
}

/** Right rail: where to lean in. */
export function OpportunitiesCard() {
  const { data, isPending } = useOverviewIntelligence();
  if (isPending) return <Skeleton className="h-40" />;
  if (!data) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-4 text-positive" aria-hidden="true" />
        <SectionTitle className="type-card">Opportunities</SectionTitle>
      </div>
      {data.opportunities.length ? (
        <ul className="mt-3 grid gap-2.5">
          {data.opportunities.slice(0, 3).map((item) => (
            <li key={item.title} className="rounded-xl bg-positive/5 p-3">
              <p className="type-body font-semibold">{item.title}</p>
              <p className="mt-1 type-meta text-muted-foreground">{item.detail}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/mentions" search={{ topic: item.query }}>
                    View posts
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link
                    to="/campaign/$action"
                    params={{ action: "post" }}
                    search={{ text: `Build on the positive conversation about ${item.title}.` }}
                  >
                    Amplify
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 type-meta text-muted-foreground">
          Nothing is clearly trending positive yet.
        </p>
      )}
    </Card>
  );
}

/** Deeper band: brief, what changed and (optionally) source authority. */
export function IntelligenceBriefSection({
  includeSourceAuthority = true,
}: { includeSourceAuthority?: boolean } = {}) {
  const { data, isPending } = useOverviewIntelligence();
  if (isPending) return <Skeleton className="h-40" />;
  if (!data) return null;

  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <SectionTitle>What's happening now</SectionTitle>
            <p className="type-meta mt-1 text-muted-foreground">
              The biggest changes happening right now.
            </p>
          </div>
        </div>
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {data.brief.map((point) => (
            <li key={point} className="rounded-xl bg-muted/40 px-4 py-3 type-body">
              {point}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" aria-hidden="true" />
          <SectionTitle>What changed?</SectionTitle>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.whatChanged.map((item) => (
            <article key={item.title} className="rounded-xl border border-border bg-background p-4">
              <p className="type-card font-semibold">{item.title}</p>
              <p className="mt-1 type-meta leading-relaxed text-muted-foreground">{item.detail}</p>
            </article>
          ))}
        </div>
      </Card>

      {includeSourceAuthority ? <SourceAuthorityPanel /> : null}
    </div>
  );
}

/** Legacy composite used on the dashboard: brief, narratives, risks and opportunities. */
export function OverviewIntelligencePanel() {
  return (
    <div className="mt-6 grid gap-4">
      <IntelligenceBriefSection />
      <TopNarrativesCard />
      <div className="grid gap-4 lg:grid-cols-2">
        <RisksCard />
        <OpportunitiesCard />
      </div>
    </div>
  );
}
