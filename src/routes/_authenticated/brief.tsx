import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Download,
  Eye,
  MessageSquare,
  Share2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { DataFreshness } from "@/components/data-freshness";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, PageTitle } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { CopyConfirmationButton } from "@/components/core/copy-confirmation-button";
import { downloadCommandReportPdf } from "@/lib/command-report-pdf";
import { getOverview } from "@/lib/overview.functions";
import { getOverviewIntelligence } from "@/lib/overview-intelligence.functions";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/brief")({
  head: () => ({
    meta: [
      { title: "Executive Brief - SMAIT" },
      {
        name: "description",
        content:
          "A concise daily summary of what happened, why it matters, current risks, opportunities and recommended action.",
      },
    ],
  }),
  component: ExecutiveBriefPage,
});

function signed(value: number, suffix = "%") {
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

function ExecutiveBriefPage() {
  const fetchOverview = useServerFn(getOverview);
  const fetchIntel = useServerFn(getOverviewIntelligence);

  const overview = useQuery({
    queryKey: ["executive-brief", "overview"],
    queryFn: () => fetchOverview({ data: { window: "24h" } }),
    refetchInterval: 10 * 60 * 1000,
  });
  const intel = useQuery({
    queryKey: ["executive-brief", "intelligence"],
    queryFn: () => fetchIntel(),
    refetchInterval: 10 * 60 * 1000,
  });

  const data = overview.data;
  const intelligence = intel.data;
  const topRisk = intelligence?.risks[0] ?? null;
  const topOpportunity = intelligence?.opportunities[0] ?? null;
  const topNarrative = intelligence?.narratives[0] ?? null;

  const brief = useMemo(() => {
    const lines: { heading: string; detail: string; tone: "neutral" | "risk" | "opportunity" }[] =
      [];
    if (data) {
      lines.push({
        heading: "What happened",
        detail: `${data.health.mentions.value.toLocaleString()} monitored mentions were recorded in the last 24 hours, with ${data.health.sentiment.negativePct}% negative and ${data.health.sentiment.positivePct}% positive sentiment.`,
        tone: "neutral",
      });
    }
    if (intelligence) {
      lines.push({
        heading: "What changed",
        detail:
          intelligence.whatChanged[0]?.detail ||
          `Conversation volume moved ${signed(intelligence.mentionChange)} against the previous comparison period.`,
        tone: "neutral",
      });
    }
    if (topNarrative) {
      lines.push({
        heading: "Leading narrative",
        detail: `${topNarrative.label} is ${topNarrative.velocity.toLowerCase()} and classified ${topNarrative.importance.toLowerCase()}, with ${topNarrative.mentions} monitored mentions and ${topNarrative.views.toLocaleString()} recorded views.`,
        tone: topNarrative.importance === "Critical" ? "risk" : "neutral",
      });
    }
    if (topRisk)
      lines.push({ heading: "Risk", detail: `${topRisk.title}. ${topRisk.detail}`, tone: "risk" });
    if (topOpportunity)
      lines.push({
        heading: "Opportunity",
        detail: `${topOpportunity.title}. ${topOpportunity.detail}`,
        tone: "opportunity",
      });
    const recommendation = intelligence?.brief?.[0];
    if (recommendation)
      lines.push({ heading: "Recommended today", detail: recommendation, tone: "opportunity" });
    return lines.slice(0, 8);
  }, [data, intelligence, topNarrative, topRisk, topOpportunity]);

  const download = () => {
    void downloadCommandReportPdf({
      title: "Executive Communications Brief",
      subtitle:
        "A concise leadership view of the current monitored conversation and recommended communication priorities.",
      filename: `Executive-Brief-${new Date().toISOString().slice(0, 10)}.pdf`,
      generatedAt: data?.generatedAt ?? null,
      sections: [
        {
          heading: "Executive brief",
          lines: brief.map((item) => `${item.heading}: ${item.detail}`),
        },
        {
          heading: "Key indicators",
          stats: [
            { label: "Mentions (24h)", value: String(data?.health.mentions.value ?? 0) },
            {
              label: "Engagements",
              value: String(data?.health.engagements.value ?? 0),
              tone: "green" as const,
            },
            { label: "Views", value: String(data?.health.views.value ?? 0), tone: "ink" as const },
            {
              label: "Positive share",
              value: `${data?.health.sentiment.positivePct ?? 0}%`,
              tone: "green" as const,
            },
            {
              label: "Neutral share",
              value: `${data?.health.sentiment.neutralPct ?? 0}%`,
              tone: "ink" as const,
            },
            { label: "Negative share", value: `${data?.health.sentiment.negativePct ?? 0}%` },
          ],
          chart: {
            title: "Sentiment share of monitored conversation",
            rows: [
              { label: "Positive", value: data?.health.sentiment.positivePct ?? 0 },
              { label: "Neutral", value: data?.health.sentiment.neutralPct ?? 0 },
              { label: "Negative", value: data?.health.sentiment.negativePct ?? 0 },
            ],
            suffix: "%",
          },
          lines: [
            `${data?.health.mentions.value ?? 0} mentions in the last 24 hours.`,
            `${data?.health.engagements.value ?? 0} recorded engagements.`,
            `${data?.health.views.value ?? 0} recorded views.`,
            `${data?.health.sentiment.negativePct ?? 0}% negative sentiment share.`,
          ],
        },
      ],
    });
  };

  const share = async () => {
    if (typeof window === "undefined") return;
    await navigator.clipboard.writeText(window.location.href);
  };

  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Loading";

  return (
    <WorkspaceShell title="Executive Brief">
      <PageTitle
        description="A leadership view of what changed, what matters and what should happen next."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DataFreshness at={data?.generatedAt} label="Brief" staleMinutes={30} />
            <CopyConfirmationButton
              variant="outline"
              size="sm"
              icon={Share2}
              label="Copy share link"
              copy={share}
              onCopyError={(error) =>
                toast.error(friendlyError(error, { action: "copy this share link" }))
              }
            />
            <Button variant="outline" size="sm" onClick={download} disabled={!data}>
              <Download className="size-4" /> Download PDF
            </Button>
          </div>
        }
      >
        Executive Brief
      </PageTitle>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 type-meta text-muted-foreground">
          <span>
            Reporting window: <strong className="text-foreground">Last 24 hours</strong>
          </span>
          <span>
            Generated at <strong className="text-foreground">{generatedAt}</strong>
          </span>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          <BriefMetric
            label="Mentions"
            value={data?.health.mentions.value ?? "Loading"}
            icon={MessageSquare}
          />
          <BriefMetric
            label="Recorded views"
            value={data?.health.views.value.toLocaleString() ?? "Loading"}
            icon={Eye}
          />
          <BriefMetric
            label="Negative sentiment"
            value={data ? `${data.health.sentiment.negativePct}%` : "Loading"}
            icon={ShieldAlert}
            tone={(data?.health.sentiment.negativePct ?? 0) >= 35 ? "negative" : "neutral"}
          />
          <BriefMetric
            label="Conversation change"
            value={intelligence ? signed(intelligence.mentionChange) : "Loading"}
            icon={TrendingUp}
          />
        </div>
      </Card>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.75fr)]">
        <Card>
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="size-5 shrink-0 text-primary" />
            <h2 className="type-section">Today in 5 minutes</h2>
          </div>
          <div className="mt-4 divide-y divide-border">
            {brief.length ? (
              brief.map((item, index) => (
                <div
                  key={`${item.heading}-${index}`}
                  className="grid min-w-0 gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)]"
                >
                  <p
                    className={`type-meta font-semibold ${item.tone === "risk" ? "text-destructive" : item.tone === "opportunity" ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}
                  >
                    {item.heading}
                  </p>
                  <p className="type-body min-w-0 text-muted-foreground">{item.detail}</p>
                </div>
              ))
            ) : (
              <p className="type-meta text-muted-foreground">
                The brief is being assembled from the latest stored monitoring data.
              </p>
            )}
          </div>
        </Card>

        <Card className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="type-section">Decision summary</h2>
          </div>

          <section className="mt-5">
            <p className="type-meta font-semibold uppercase tracking-wide text-muted-foreground">
              Risk requiring attention
            </p>
            <h3 className="mt-2 type-card">
              {topRisk?.title ?? "No priority risk currently detected"}
            </h3>
            <p className="mt-2 type-meta leading-relaxed text-muted-foreground">
              {topRisk?.detail ??
                "Continue monitoring and use the full intelligence view for developing signals."}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/crisis">
                Open Crisis Command <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </section>

          <section className="mt-6 border-t border-border pt-6">
            <p className="type-meta font-semibold uppercase tracking-wide text-muted-foreground">
              Opportunity to use
            </p>
            <h3 className="mt-2 type-card">
              {topOpportunity?.title ?? "Stay ready to amplify positive movement"}
            </h3>
            <p className="mt-2 type-meta leading-relaxed text-muted-foreground">
              {topOpportunity?.detail ??
                "Use the Overview intelligence layer to identify the next constructive conversation worth joining."}
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/overview">
                Open full intelligence <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </section>
        </Card>
      </div>
    </WorkspaceShell>
  );
}

function BriefMetric({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: typeof MessageSquare;
  tone?: "default" | "negative" | "neutral";
}) {
  const valueClass =
    tone === "negative"
      ? "text-destructive"
      : tone === "neutral"
        ? "text-muted-foreground"
        : "text-foreground";

  return (
    <div className="min-w-0 bg-card px-5 py-4">
      <div className="flex items-center gap-2 type-meta text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
