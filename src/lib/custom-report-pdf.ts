import { BRAND, BrandPdf, compactNumber, slugify } from "./pdf-brand";
import type { BrandHealthSummary } from "./brand-health";
import type { OverviewData } from "./overview";
import type { OverviewIntelligence } from "./overview-intelligence.functions";
import type { PerformanceSummary } from "./performance";

export type CustomReportSections = {
  executive: boolean;
  intelligence: boolean;
  messageTesting: boolean;
  campaigns: boolean;
  performance: boolean;
};

export type CustomReportInput = {
  title: string;
  periodLabel: string;
  overview: OverviewData;
  intelligence: OverviewIntelligence | null;
  brandHealth: BrandHealthSummary | null;
  performance: PerformanceSummary | null;
  sections: CustomReportSections;
};

const compact = compactNumber;

function dayLabel(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

/** Builds the branded, chart-led PDF used by the custom report builder. */
export async function downloadCustomReportPdf(input: CustomReportInput) {
  const pdf = new BrandPdf();

  await pdf.cover({
    title: input.title || "Communications Intelligence Report",
    periodLabel: input.periodLabel,
    subtitle: input.overview.empty
      ? "No monitored conversation was collected in the selected window. Figures below reflect the records currently stored by the platform."
      : "Monitored conversation, audience response, campaign delivery and performance for the selected reporting window.",
  });

  if (input.sections.executive) {
    const health = input.overview.health;
    pdf.heading("Executive snapshot");
    pdf.statCards([
      {
        label: "Health score",
        value: health.score === null ? "—" : `${health.score}`,
        tone: "green",
      },
      {
        label: "Mentions",
        value: compact(health.mentions.value),
        hint: `was ${compact(health.mentions.previous)}`,
      },
      {
        label: "Engagements",
        value: compact(health.engagements.value),
        hint: `was ${compact(health.engagements.previous)}`,
        tone: "green",
      },
      {
        label: "Views",
        value: compact(health.views.value),
        hint: `was ${compact(health.views.previous)}`,
        tone: "ink",
      },
      { label: "Positive", value: `${health.sentiment.positivePct}%`, tone: "green" },
      { label: "Negative", value: `${health.sentiment.negativePct}%` },
    ]);

    pdf.donut("Sentiment split", [
      { label: "Positive", value: health.sentiment.positive, color: BRAND.green },
      { label: "Neutral", value: health.sentiment.neutral, color: [140, 142, 150] },
      { label: "Negative", value: health.sentiment.negative, color: BRAND.red },
    ]);

    if (input.overview.series.length > 1) {
      pdf.columnChart(
        "Conversation volume over the window",
        input.overview.series.map((point) => ({ label: point.label, value: point.total })),
        BRAND.red,
      );
    }

    if (input.overview.platforms.length) {
      pdf.barChart(
        "Where the conversation happens",
        input.overview.platforms.slice(0, 7).map((platform) => ({
          label: platform.platform,
          value: platform.count,
        })),
      );
    }

    if (input.overview.momentum.length) {
      pdf.barChart(
        "Leading conversation themes",
        input.overview.momentum.slice(0, 6).map((topic) => ({
          label: topic.topic,
          value: topic.volume,
          color: topic.sentiment.negativePct > 40 ? BRAND.red : BRAND.green,
        })),
      );
      pdf.table(
        ["Theme", "Mentions", "Negative", "Change"],
        input.overview.momentum
          .slice(0, 6)
          .map((topic) => [
            topic.topic,
            compact(topic.volume),
            `${topic.sentiment.negativePct}%`,
            topic.changePct === null ? "—" : `${topic.changePct > 0 ? "+" : ""}${topic.changePct}%`,
          ]),
        [
          pdf.contentWidth * 0.46,
          pdf.contentWidth * 0.18,
          pdf.contentWidth * 0.18,
          pdf.contentWidth * 0.18,
        ],
      );
    }
  }

  if (input.sections.intelligence && input.intelligence) {
    const intel = input.intelligence;
    pdf.heading("Conversation intelligence");
    pdf.statCards([
      { label: "Current mentions", value: compact(intel.currentMentions) },
      {
        label: "Vs previous week",
        value: `${intel.mentionChange > 0 ? "+" : ""}${intel.mentionChange}%`,
        tone: intel.mentionChange >= 0 ? "green" : "red",
      },
      { label: "Negative share", value: `${intel.currentNegativeShare}%`, tone: "red" },
    ]);

    if (intel.brief.length) {
      pdf.callout("Intelligence brief", intel.brief.slice(0, 4).join("  •  "), "green");
    }

    if (intel.narratives.length) {
      pdf.barChart(
        "Priority narratives by volume",
        intel.narratives.slice(0, 6).map((narrative) => ({
          label: narrative.label,
          value: narrative.mentions,
          color: narrative.negative >= 40 ? BRAND.red : BRAND.green,
        })),
      );
      pdf.table(
        ["Narrative", "Mentions", "Negative", "Vs normal"],
        intel.narratives
          .slice(0, 6)
          .map((narrative) => [
            narrative.label,
            compact(narrative.mentions),
            `${narrative.negative}%`,
            `${narrative.vsNormal > 0 ? "+" : ""}${narrative.vsNormal}%`,
          ]),
        [
          pdf.contentWidth * 0.46,
          pdf.contentWidth * 0.18,
          pdf.contentWidth * 0.18,
          pdf.contentWidth * 0.18,
        ],
      );
    }

    intel.risks.slice(0, 3).forEach((item) => pdf.callout(item.title, item.detail, "red"));
    intel.opportunities
      .slice(0, 3)
      .forEach((item) => pdf.callout(item.title, item.detail, "green"));
  }

  if (input.sections.messageTesting && input.brandHealth) {
    const tests = input.brandHealth.tests;
    pdf.heading("Response Studio");
    pdf.statCards([
      { label: "Tests run", value: compact(tests.total) },
      {
        label: "Average confidence",
        value: tests.average === null ? "—" : `${tests.average}%`,
        tone: "green",
      },
      { label: "Strong tests", value: compact(tests.strong), tone: "green" },
      { label: "Tests scored", value: compact(tests.scored), tone: "ink" },
      { label: "Needing work", value: compact(tests.weak) },
    ]);

    if (tests.trend.length > 1) {
      pdf.lineChart(
        "Persona confidence trend",
        tests.trend.map((point) => ({ label: dayLabel(point.date), value: point.confidence })),
        BRAND.green,
      );
    }

    if (tests.recent.length) {
      pdf.barChart(
        "Recent tests by confidence",
        tests.recent.slice(0, 6).map((test) => ({
          label: test.title,
          value: test.confidence ?? 0,
          color:
            (test.confidence ?? 0) >= 75
              ? BRAND.green
              : (test.confidence ?? 0) >= 55
                ? BRAND.amber
                : BRAND.red,
        })),
        { max: 100, format: (value) => `${Math.round(value)}%` },
      );
    }
  }

  if (input.sections.campaigns && input.brandHealth) {
    const campaigns = input.brandHealth.campaigns;
    const outbound = input.brandHealth.outbound;
    pdf.heading("Campaigns and delivery");
    pdf.statCards([
      { label: "Campaigns", value: compact(campaigns.total) },
      { label: "Active", value: compact(campaigns.active), tone: "green" },
      { label: "Replies sent", value: compact(campaigns.replies), tone: "green" },
      { label: "Held replies", value: compact(campaigns.held) },
      { label: "Failed replies", value: compact(campaigns.failed) },
      {
        label: "Ready accounts",
        value: `${outbound.activeAccounts}/${outbound.accounts}`,
        tone: "ink",
      },
    ]);

    pdf.donut("Reply outcomes", [
      {
        label: "Delivered",
        value: Math.max(0, campaigns.replies - campaigns.held - campaigns.failed),
        color: BRAND.green,
      },
      { label: "Held by review", value: campaigns.held, color: BRAND.amber },
      { label: "Failed", value: campaigns.failed, color: BRAND.red },
    ]);

    if (outbound.byDay.length > 1) {
      pdf.columnChart(
        "Messages sent by day",
        outbound.byDay.map((point) => ({ label: dayLabel(point.date), value: point.sent })),
        BRAND.ink,
      );
    }

    if (campaigns.top.length) {
      pdf.barChart(
        "Leading campaigns",
        campaigns.top
          .slice(0, 6)
          .map((campaign) => ({ label: campaign.name, value: campaign.replies })),
      );
    }
  }

  if (input.sections.performance && input.performance) {
    const totals = input.performance.totals;
    pdf.heading("Performance");
    pdf.statCards([
      { label: "Posts", value: compact(totals.posts) },
      { label: "Replies", value: compact(totals.replies) },
      { label: "Impressions", value: compact(totals.impressions), tone: "ink" },
      { label: "Reach", value: compact(totals.reach), tone: "green" },
      { label: "Engagements", value: compact(totals.engagements), tone: "green" },
      { label: "Engagement rate", value: `${totals.engagementRate}%` },
    ]);

    if (input.performance.byDay.length > 1) {
      pdf.lineChart(
        "Reach by day",
        input.performance.byDay.map((point) => ({
          label: dayLabel(point.date),
          value: point.reach,
        })),
        BRAND.red,
      );
      pdf.columnChart(
        "Engagements by day",
        input.performance.byDay.map((point) => ({
          label: dayLabel(point.date),
          value: point.engagements,
        })),
        BRAND.green,
      );
    }

    pdf.barChart("Interaction mix", [
      { label: "Likes", value: totals.likes, color: BRAND.red },
      { label: "Reposts", value: totals.retweets, color: BRAND.green },
      { label: "Replies received", value: totals.repliesReceived, color: [30, 64, 124] },
      { label: "Bookmarks", value: totals.bookmarks, color: BRAND.amber },
    ]);

    const top = [...input.performance.byCampaign]
      .sort((a, b) => b.engagements - a.engagements)
      .slice(0, 6);
    if (top.length) {
      pdf.table(
        ["Campaign", "Engagements", "Reach", "Rate"],
        top.map((campaign) => [
          campaign.name,
          compact(campaign.engagements),
          compact(campaign.reach),
          `${campaign.engagementRate}%`,
        ]),
        [
          pdf.contentWidth * 0.46,
          pdf.contentWidth * 0.2,
          pdf.contentWidth * 0.18,
          pdf.contentWidth * 0.16,
        ],
      );
    }
  }

  pdf.note(
    "This report reflects the data available to SMAIT at generation time. Platform-specific metrics may differ in definition and availability. Intelligence and persona-testing signals are decision support and should be reviewed against the underlying evidence before external action.",
  );

  pdf.save(`${slugify(input.title, "smait-report")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
