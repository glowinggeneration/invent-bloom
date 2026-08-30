import { BRAND, BrandPdf, compactNumber, slugify } from "./pdf-brand";
import { formatReportDate, type ReportRecord } from "./reports";

const compact = compactNumber;

/**
 * Branded PDF for a stored platform report (daily or custom period).
 * Uses the same FKF cover, palette and chart kit as every other export.
 */
export async function downloadReportPdf(report: ReportRecord) {
  const pdf = new BrandPdf();
  const title =
    report.kind === "daily"
      ? "Daily Summary"
      : `${report.kind.charAt(0).toUpperCase()}${report.kind.slice(1)} Report`;

  await pdf.cover({
    title,
    periodLabel: formatReportDate(report.reportDate),
    subtitle:
      "What people said, how they felt, and what the federation published during this period.",
  });

  const m = report.metrics;
  pdf.heading("The short version");
  pdf.statCards([
    { label: "Mentions", value: compact(m.mentions), hint: `was ${compact(m.previousMentions)}` },
    { label: "Views", value: compact(m.views), tone: "ink" },
    { label: "Engagements", value: compact(m.engagements), tone: "green" },
    { label: "Positive", value: `${m.sentiment.positivePct}%`, tone: "green" },
    { label: "Negative", value: `${m.sentiment.negativePct}%` },
    { label: "Our posts", value: compact(m.ownPosts), tone: "ink" },
  ]);

  if (m.sentiment.total > 0) {
    pdf.donut("How people felt", [
      { label: "Positive", value: m.sentiment.positive, color: BRAND.green },
      { label: "Neutral", value: m.sentiment.neutral, color: [140, 142, 150] },
      { label: "Negative", value: m.sentiment.negative, color: BRAND.red },
    ]);
  }

  const platforms = report.conversation.platforms.slice(0, 7);
  if (platforms.length) {
    pdf.barChart(
      "Where the conversation happened",
      platforms.map((p) => ({ label: p.platform, value: p.count })),
    );
  }

  const topics = report.conversation.topics.slice(0, 8);
  if (topics.length) {
    pdf.columnChart(
      "What people talked about",
      topics.map((t) => ({ label: t.topic, value: t.volume })),
      BRAND.red,
    );
  }

  if (report.conversation.issues.length) {
    pdf.heading("Worth watching");
    for (const issue of report.conversation.issues.slice(0, 5)) {
      pdf.bullet(
        `${issue.topic} - ${issue.volume} mentions, ${issue.negativePct}% negative${
          issue.changePct === null
            ? ""
            : ` (${issue.changePct > 0 ? "up" : "down"} ${Math.abs(issue.changePct)}%)`
        }`,
      );
    }
  }

  const posts = report.conversation.topPosts.slice(0, 8);
  if (posts.length) {
    pdf.heading("Posts that travelled furthest");
    pdf.table(
      ["Author", "Platform", "Engagements", "Views"],
      posts.map((p) => [
        `${p.author || p.handle}`.slice(0, 40),
        p.platform,
        compact(p.engagements),
        compact(p.views),
      ]),
    );
  }

  pdf.heading("What we published");
  pdf.statCards([
    { label: "Campaigns", value: `${report.campaigns.total}` },
    {
      label: "Actions completed",
      value: compact(report.campaigns.completedActions),
      tone: "green",
    },
    { label: "Replies", value: compact(report.campaigns.replies) },
    { label: "Posts", value: compact(report.campaigns.posts) },
    { label: "Likes", value: compact(report.campaigns.likes), tone: "ink" },
    { label: "Reposts", value: compact(report.campaigns.reposts), tone: "ink" },
  ]);

  const runs = report.campaigns.runs.slice(0, 10);
  if (runs.length) {
    pdf.table(
      ["Campaign", "Type", "Personas", "Actions", "Engagement"],
      runs.map((r) => [
        r.campaignName.slice(0, 34),
        r.campaignType,
        `${r.personasUsed}`,
        `${r.completedActions}`,
        compact(r.engagementGenerated),
      ]),
    );
  }

  const leaders = report.personas.leaderboard.slice(0, 8);
  if (leaders.length) {
    pdf.heading("Personas doing the work");
    pdf.barChart(
      "Actions by persona",
      leaders.map((p) => ({ label: p.persona || p.handle, value: p.actions, color: BRAND.green })),
    );
  }

  if (report.insights.length) {
    pdf.heading("What this means");
    for (const insight of report.insights.slice(0, 8)) pdf.bullet(insight.text);
  }

  if (report.recommendations.length) {
    pdf.heading("What to do next");
    for (const rec of report.recommendations.slice(0, 6)) {
      pdf.callout(
        `${rec.category} - ${rec.headline}`,
        rec.action,
        rec.category === "RESPOND" ? "red" : rec.category === "WATCH" ? "amber" : "green",
      );
    }
  }

  pdf.note(
    `Created ${new Date().toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })} - FKF CommsIQ, powered by Persona_Voices.`,
  );

  pdf.save(`${slugify(`fkf-${title}-${report.reportDate}`, "fkf-report")}.pdf`);
}
