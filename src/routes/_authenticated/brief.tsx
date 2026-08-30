import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  Calendar,
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
import {
  CommandGrid,
  RailAction,
  RailCard,
  RailStat,
  RailStatList,
} from "@/components/command-layout";
import { Card, PageTitle, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { downloadCommandReportPdf } from "@/lib/command-report-pdf";
import { getOverview } from "@/lib/overview.functions";
import { getOverviewIntelligence } from "@/lib/overview-intelligence.functions";

export const Route = createFileRoute("/_authenticated/brief")({
  head: () => ({
    meta: [
      { title: "Executive Brief - FKF CommsIQ" },
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
      title: "FKF Executive Communications Brief",
      subtitle:
        "A concise leadership view of the current monitored conversation and recommended communication priorities.",
      filename: `FKF-Executive-Brief-${new Date().toISOString().slice(0, 10)}.pdf`,
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

  const share = () => {
    if (typeof window !== "undefined") {
      void navigator.clipboard?.writeText(window.location.href);
    }
  };

  const leftRail = (
    <>
      <RailCard title="Period" icon={Calendar}>
        <RailStatList>
          <RailStat label="Window" value="Last 24h" />
          <RailStat
            label="Generated"
            value={
              data?.generatedAt
                ? new Date(data.generatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"
            }
          />
        </RailStatList>
      </RailCard>

      <RailCard title="Conversation counts" icon={MessageSquare}>
        <RailStatList>
          <RailStat label="Mentions" value={data?.health.mentions.value ?? "—"} />
          <RailStat label="Views" value={data?.health.views.value.toLocaleString() ?? "—"} />
          <RailStat label="Engagements" value={data?.health.engagements.value ?? "—"} />
        </RailStatList>
      </RailCard>

      <RailCard title="Sentiment mix" icon={ShieldAlert}>
        <RailStatList>
          <RailStat
            label="Positive"
            value={data ? `${data.health.sentiment.positivePct}%` : "—"}
            tone="positive"
          />
          <RailStat
            label="Neutral"
            value={data ? `${data.health.sentiment.neutralPct}%` : "—"}
            tone="neutral"
          />
          <RailStat
            label="Negative"
            value={data ? `${data.health.sentiment.negativePct}%` : "—"}
            tone="negative"
          />
        </RailStatList>
      </RailCard>
    </>
  );

  const rightRail = (
    <>
      <RailCard title="Actions" icon={Sparkles}>
        <div className="grid gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={download}
            disabled={!data}
            className="justify-start"
          >
            <Download className="size-4" /> Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={share} className="justify-start">
            <Share2 className="size-4" /> Copy share link
          </Button>
        </div>
      </RailCard>

      <RailCard title="Shortcuts" icon={ArrowUpRight}>
        <div className="grid gap-2">
          <RailAction
            to="/crisis"
            icon={ShieldAlert}
            title="Crisis Command"
            description="Manage active risks"
          />
          <RailAction
            to="/overview"
            icon={TrendingUp}
            title="Full intelligence"
            description="Explore the overview"
          />
        </div>
      </RailCard>

      <RailCard title="Insight" icon={Sparkles}>
        <p className="type-meta text-muted-foreground">
          {intelligence?.brief?.[0] ??
            "Recommendations will appear here once enough monitoring data has accumulated."}
        </p>
      </RailCard>
    </>
  );

  return (
    <WorkspaceShell title="Executive Brief">
      <PageTitle
        description="What happened, why it matters and what should happen next. Designed for leadership rather than platform operators."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DataFreshness at={data?.generatedAt} label="Brief" staleMinutes={30} />
            <Button variant="outline" size="sm" onClick={download} disabled={!data}>
              <Download className="size-4" /> Download PDF
            </Button>
          </div>
        }
      >
        Executive Brief
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Mentions · 24h"
          value={data?.health.mentions.value ?? "—"}
          icon={MessageSquare}
        />
        <StatCard
          label="Recorded views"
          value={data?.health.views.value.toLocaleString() ?? "—"}
          icon={Eye}
        />
        <StatCard
          label="Negative sentiment"
          value={data ? `${data.health.sentiment.negativePct}%` : "—"}
          icon={ShieldAlert}
          tone={(data?.health.sentiment.negativePct ?? 0) >= 35 ? "negative" : "neutral"}
        />
        <StatCard
          label="Conversation change"
          value={intelligence ? signed(intelligence.mentionChange) : "—"}
          icon={TrendingUp}
        />
      </div>

      <CommandGrid left={leftRail} right={rightRail} className="mt-5">
        <Card>
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="size-5 shrink-0 text-primary" />
            <h2 className="type-section truncate">Today in 5 minutes</h2>
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

        <div className="grid gap-5 md:grid-cols-2">
          <Card className={topRisk ? "min-w-0 border-destructive/20" : "min-w-0"}>
            <p className="type-meta font-semibold uppercase tracking-wide text-muted-foreground">
              Risk requiring attention
            </p>
            <h2 className="mt-2 type-section truncate">
              {topRisk?.title ?? "No priority risk currently detected"}
            </h2>
            <p className="mt-2 type-meta text-muted-foreground">
              {topRisk?.detail ??
                "Continue monitoring and use the full intelligence view for developing signals."}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/crisis">
                Open Crisis Command <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </Card>

          <Card className="min-w-0">
            <p className="type-meta font-semibold uppercase tracking-wide text-muted-foreground">
              Opportunity to use
            </p>
            <h2 className="mt-2 type-section truncate">
              {topOpportunity?.title ?? "Stay ready to amplify positive movement"}
            </h2>
            <p className="mt-2 type-meta text-muted-foreground">
              {topOpportunity?.detail ??
                "Use the Overview intelligence layer to identify the next constructive conversation worth joining."}
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/overview">
                Open full intelligence <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </Card>
        </div>
      </CommandGrid>
    </WorkspaceShell>
  );
}
