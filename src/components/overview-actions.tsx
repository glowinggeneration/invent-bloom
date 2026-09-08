import { Link } from "@tanstack/react-router";
import { FileDown, Megaphone, Sparkles, TestTube2 } from "lucide-react";
import { BRAND, BrandPdf } from "@/lib/pdf-brand";
import { Button } from "@/components/ui/button";
import { useOverviewIntelligence } from "@/components/overview-intelligence";
import type { OverviewIntelligence } from "@/lib/overview-intelligence.functions";
import type { BrandHealthSummary } from "@/lib/brand-health";

function fmt(n: number): string {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : String(n);
}

type NextMove = {
  title: string;
  reason: string;
  message: string;
  kind: "Respond" | "Amplify" | "Join" | "Publish";
};

/** The next move is decided by what the conversation is doing, not by system health. */
function recommendation(intel?: OverviewIntelligence): NextMove {
  const risk = intel?.risks?.[0];
  const opportunity = intel?.opportunities?.[0];
  const lead = intel?.narratives?.[0];

  const negativeSpike =
    (intel?.negativeShift ?? 0) >= 5 || (intel?.currentNegativeShare ?? 0) >= 25;

  if (risk && negativeSpike) {
    return {
      kind: "Respond",
      title: `Address the conversation about ${risk.title}`,
      reason: `${risk.detail} Negative share is now ${intel?.currentNegativeShare ?? 0}% of monitored mentions.`,
      message:
        `We are aware of the questions being raised about ${risk.title.toLowerCase()}. ` +
        "We are addressing them directly, and we will keep supporters updated with clear and accurate information.",
    };
  }

  if (opportunity) {
    return {
      kind: "Amplify",
      title: `Build on the positive conversation about ${opportunity.title}`,
      reason: `${opportunity.detail} This is the clearest positive momentum in the monitored conversation right now.`,
      message:
        `The response to ${opportunity.title.toLowerCase()} shows what Kenyan football can build on. ` +
        "We will keep investing in the work that brings players, clubs and supporters closer to the game.",
    };
  }

  if (risk) {
    return {
      kind: "Respond",
      title: `Prepare a position on ${risk.title}`,
      reason: `${risk.detail} It is not yet dominant, but it is the most likely conversation to escalate.`,
      message: `We are following the discussion around ${risk.title.toLowerCase()} closely and will share a clear update as soon as the facts are confirmed.`,
    };
  }

  if (lead) {
    return {
      kind: "Join",
      title: `Join the conversation on ${lead.label}`,
      reason: `${lead.label} is the leading narrative with ${lead.mentions} mentions and is currently ${lead.velocity.toLowerCase()}.`,
      message: `We are part of the conversation on ${lead.label.toLowerCase()}, and remains focused on the decisions and progress that matter most to supporters.`,
    };
  }

  return {
    kind: "Publish",
    title: "Set the agenda while the conversation is quiet",
    reason:
      "No narrative is spiking in this window, so the federation can lead with its own story.",
    message:
      "Kenyan football grows when players, coaches, clubs and supporters have a clear pathway to participate, develop and be heard.",
  };
}

async function generateOverviewPdf(
  data: BrandHealthSummary,
  rangeLabel: string,
  intel?: OverviewIntelligence,
) {
  const pdf = new BrandPdf();
  await pdf.cover({
    title: "Brand Health & Communications Intelligence Report",
    periodLabel: `Reporting period: ${rangeLabel}`,
    subtitle: "Audience response, persona testing and delivery health for the selected period.",
  });

  pdf.heading("Headline");
  pdf.statCards([
    { label: "Brand health", value: `${data.score}/100`, tone: "green" },
    { label: "Reach", value: fmt(data.reach.reach), tone: "ink" },
    { label: "Engagements", value: fmt(data.reach.engagements), tone: "green" },
    { label: "Engagement rate", value: `${data.reach.engagementRate}%` },
    { label: "Tests run", value: String(data.tests.total), tone: "ink" },
    { label: "Active campaigns", value: String(data.campaigns.active), tone: "green" },
  ]);

  const dayLabel = (date: string) => {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime())
      ? date
      : parsed.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
  };

  pdf.heading("Trends");
  pdf.lineChart(
    "Persona confidence trend",
    data.tests.trend.map((point) => ({ label: dayLabel(point.date), value: point.confidence })),
    BRAND.green,
  );
  pdf.lineChart(
    "Reach trend",
    data.reach.byDay.map((point) => ({ label: dayLabel(point.date), value: point.reach })),
    BRAND.red,
  );
  pdf.columnChart(
    "Messages sent by day",
    data.outbound.byDay.map((point) => ({ label: dayLabel(point.date), value: point.sent })),
    BRAND.ink,
  );

  pdf.heading("Delivery");
  pdf.barChart("Outbound activity", [
    { label: "Posts", value: data.outbound.posts, color: BRAND.red },
    { label: "Replies", value: data.outbound.replies, color: BRAND.green },
    { label: "Failed sends", value: data.outbound.failed, color: BRAND.amber },
    { label: "Ready accounts", value: data.outbound.activeAccounts, color: BRAND.ink },
  ]);

  const rec = recommendation(intel);
  pdf.heading("What to do next");
  pdf.callout(rec.title, `${rec.reason}\n\nSuggested message: ${rec.message}`, "green");

  pdf.save(`SMAIT-Brand-Health-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function OverviewNextMove({
  data,
  rangeLabel,
}: {
  data: BrandHealthSummary;
  rangeLabel: string;
}) {
  const { data: intel } = useOverviewIntelligence();
  const rec = recommendation(intel);

  return (
    <section className="card-surface p-4">
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 text-primary" />
        <p className="type-card">What to do next</p>
      </div>
      <p className="mt-2 type-body font-semibold">{rec.title}</p>
      <p className="mt-1 type-meta text-muted-foreground">{rec.reason}</p>

      <div className="mt-3 rounded-xl bg-muted/45 p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <p className="type-meta font-semibold">Suggested message</p>
        </div>
        <p className="mt-1.5 type-meta leading-relaxed">{rec.message}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/new" search={{ text: rec.message }}>
            <TestTube2 className="size-3.5" /> Test
          </Link>
        </Button>
        <Button asChild size="sm" className="gap-1.5">
          <Link
            to="/campaign/$action"
            params={{ action: "post" }}
            search={{ text: rec.message, link: "" }}
          >
            <Megaphone className="size-3.5" /> Campaign
          </Link>
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full gap-2"
        onClick={() => void generateOverviewPdf(data, rangeLabel, intel)}
      >
        <FileDown className="size-3.5" /> Create report
      </Button>
    </section>
  );
}

export function OverviewActions({
  data,
  rangeLabel,
}: {
  data: BrandHealthSummary;
  rangeLabel: string;
}) {
  const { data: intel } = useOverviewIntelligence();
  const rec = recommendation(intel);
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="type-meta font-semibold uppercase tracking-wide text-primary">
            What to do next
          </p>
          <h2 className="mt-1 type-card">{rec.title}</h2>
          <p className="mt-1 type-body text-muted-foreground">{rec.reason}</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => void generateOverviewPdf(data, rangeLabel, intel)}
        >
          <FileDown className="size-4" /> Create report
        </Button>
      </div>

      <div className="mt-4 rounded-xl bg-muted/45 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <p className="text-sm font-semibold">Suggested message</p>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed">{rec.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/new" search={{ text: rec.message }}>
              <TestTube2 className="size-4" /> Test with personas
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link
              to="/campaign/$action"
              params={{ action: "post" }}
              search={{ text: rec.message, link: "" }}
            >
              <Megaphone className="size-4" /> Run campaign
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
