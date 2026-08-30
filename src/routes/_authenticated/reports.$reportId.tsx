import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { WorkspaceShell } from "@/components/workspace-shell";
import { EmptyState, SectionTitle, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { ReportCsvMenu, StatusPill } from "@/components/reports/report-parts";
import { getReport } from "@/lib/reports.functions";
import { formatReportDate, type ReportRecord } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/reports/$reportId")({
  head: () => ({
    meta: [
      { title: "Daily report - FKF CommsIQ" },
      {
        name: "description",
        content:
          "A single day of FKF conversation, sentiment, campaign execution and persona activity, with insights and recommendations.",
      },
      { property: "og:title", content: "Daily report - FKF CommsIQ" },
      {
        property: "og:description",
        content: "What was said, what we ran and what worked — for one reporting day.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportDetailPage,
});

function num(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString();
}

function TopicList({ rows }: { rows: ReportRecord["conversation"]["topics"] }) {
  if (!rows.length)
    return <p className="type-meta text-muted-foreground">Nothing had enough volume yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.slice(0, 6).map((t) => (
        <li key={t.topic} className="flex items-center justify-between gap-3">
          <span className="type-body min-w-0 truncate">{t.topic}</span>
          <span className="type-meta shrink-0 text-muted-foreground">
            {num(t.volume)}
            {t.changePct !== null
              ? ` · ${t.changePct > 0 ? "↑" : "↓"} ${Math.abs(t.changePct)}%`
              : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReportDetailPage() {
  const { reportId } = Route.useParams();
  const load = useServerFn(getReport);
  const { data, isLoading } = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => load({ data: { id: reportId } }),
  });

  const report = data?.report ?? null;

  return (
    <WorkspaceShell>
      <div className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:p-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/reports">
            <ArrowLeft className="size-4" />
            All reports
          </Link>
        </Button>

        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : !report ? (
          <EmptyState
            title="We couldn't find this report"
            description="It may have been replaced by a newer run."
          />
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="type-meta uppercase tracking-wide text-muted-foreground">
                  {report.kind === "daily" ? "Daily report" : `${report.kind} report`}
                </p>
                <h1 className="type-title">{formatReportDate(report.reportDate)}</h1>
                <div className="mt-2 flex items-center gap-2">
                  <StatusPill status={report.status} />
                  <span className="type-meta text-muted-foreground">
                    Generated {new Date(report.generatedAt).toLocaleString("en-GB")}
                  </span>
                </div>
              </div>
              <ReportCsvMenu reportId={report.id} />
            </header>

            {report.sourceErrors.length ? (
              <div className="card-surface border-neutral/40 p-4">
                <p className="type-card">This report is incomplete</p>
                <ul className="type-meta mt-2 list-disc pl-5 text-muted-foreground">
                  {report.sourceErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <section className="space-y-3">
              <SectionTitle>Overview</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Mentions"
                  value={num(report.metrics.mentions)}
                  hint={
                    report.metrics.mentionsChangePct !== null
                      ? `${report.metrics.mentionsChangePct > 0 ? "↑" : "↓"} ${Math.abs(report.metrics.mentionsChangePct)}% vs previous period`
                      : "No earlier period to compare"
                  }
                />
                <StatCard
                  label="Sentiment"
                  value={`${report.metrics.sentiment.positivePct}% positive`}
                  hint={`${report.metrics.sentiment.neutralPct}% neutral · ${report.metrics.sentiment.negativePct}% negative`}
                  tone="positive"
                />
                <StatCard
                  label="Engagements"
                  value={num(report.metrics.engagements)}
                  hint="Public engagement on collected posts"
                />
                <StatCard
                  label="Views"
                  value={num(report.metrics.views)}
                  hint="Where the platform reports them"
                />
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle>Conversation</SectionTitle>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="card-surface p-5">
                  <p className="type-card mb-3">Top topics</p>
                  <TopicList rows={report.conversation.topics} />
                  <div className="type-meta mt-4 space-y-1 text-muted-foreground">
                    {report.conversation.mostDiscussed ? (
                      <p>Most discussed: {report.conversation.mostDiscussed}</p>
                    ) : null}
                    {report.conversation.fastestGrowing ? (
                      <p>Fastest growing: {report.conversation.fastestGrowing}</p>
                    ) : null}
                    {report.conversation.mostEngagedPlatform ? (
                      <p>Most engaged platform: {report.conversation.mostEngagedPlatform}</p>
                    ) : null}
                  </div>
                </div>

                <div className="card-surface p-5">
                  <p className="type-card mb-3">Top platforms</p>
                  {report.conversation.platforms.length ? (
                    <ul className="space-y-2">
                      {report.conversation.platforms.slice(0, 6).map((p) => (
                        <li key={p.platform} className="flex items-center justify-between gap-3">
                          <span className="type-body min-w-0 truncate">{p.platform}</span>
                          <span className="type-meta shrink-0 text-muted-foreground">
                            {num(p.count)} · {p.sharePct}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="type-meta text-muted-foreground">
                      Nothing was collected in this period.
                    </p>
                  )}
                </div>

                <div className="card-surface p-5 lg:col-span-2">
                  <p className="type-card mb-3">Top posts</p>
                  {report.conversation.topPosts.length ? (
                    <ul className="divide-y divide-border">
                      {report.conversation.topPosts.map((p) => (
                        <li key={p.url} className="flex items-start justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="type-body line-clamp-2">{p.title}</p>
                            <p className="type-meta mt-1 text-muted-foreground">
                              {p.platform} · {p.author || p.handle} · {num(p.engagements)}{" "}
                              engagements
                            </p>
                          </div>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            className="type-meta inline-flex shrink-0 items-center gap-1 text-primary"
                          >
                            Open <ExternalLink className="size-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="type-meta text-muted-foreground">No posts were collected.</p>
                  )}
                </div>

                <div className="card-surface p-5 lg:col-span-2">
                  <p className="type-card mb-3">Worth watching</p>
                  {report.conversation.issues.length ? (
                    <TopicList rows={report.conversation.issues} />
                  ) : (
                    <p className="type-meta text-muted-foreground">
                      Nothing negative gained traction.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle>Campaign activity</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Campaigns run" value={num(report.campaigns.total)} />
                <StatCard
                  label="Actions completed"
                  value={num(report.campaigns.completedActions)}
                />
                <StatCard label="Personas used" value={num(report.personas.active)} />
                <StatCard
                  label="Successful actions"
                  value={num(report.personas.successful)}
                  tone="positive"
                />
                <StatCard label="Actions in progress" value={num(report.personas.failed)} />
              </div>

              {report.campaigns.runs.length ? (
                <div className="card-surface overflow-x-auto p-0">
                  <table className="w-full min-w-[640px] text-left">
                    <thead className="type-meta text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="p-3 font-normal">Campaign</th>
                        <th className="p-3 font-normal">Type</th>
                        <th className="p-3 font-normal">Status</th>
                        <th className="p-3 font-normal">Personas</th>
                        <th className="p-3 font-normal">Completed</th>
                        <th className="p-3 font-normal">Failed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.campaigns.runs.map((r) => (
                        <tr
                          key={`${r.source}:${r.campaignId}`}
                          className="border-b border-border last:border-0"
                        >
                          <td className="type-body max-w-[240px] truncate p-3">{r.campaignName}</td>
                          <td className="type-meta p-3 text-muted-foreground">{r.campaignType}</td>
                          <td className="type-meta p-3 text-muted-foreground">{r.status}</td>
                          <td className="type-meta p-3 text-muted-foreground">
                            {num(r.personasUsed)}
                          </td>
                          <td className="type-meta p-3 text-muted-foreground">
                            {num(r.completedActions)}
                          </td>
                          <td className="type-meta p-3 text-muted-foreground">
                            {num(r.failedActions)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="type-meta text-muted-foreground">
                  No campaign actions ran in this period.
                </p>
              )}
            </section>

            <section className="space-y-3">
              <SectionTitle>Insights</SectionTitle>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="card-surface p-5">
                  <p className="type-card mb-3">Key insights</p>
                  {report.insights.length ? (
                    <ul className="space-y-2">
                      {report.insights.map((i) => (
                        <li key={i.text} className="type-body">
                          {i.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="type-meta text-muted-foreground">Not enough data yet.</p>
                  )}
                </div>
                <div className="card-surface p-5">
                  <p className="type-card mb-3">What to do next</p>
                  {report.recommendations.length ? (
                    <ul className="space-y-4">
                      {report.recommendations.map((r) => (
                        <li key={r.headline}>
                          <span className="type-meta rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                            {r.category}
                          </span>
                          <p className="type-body mt-2 font-medium">{r.headline}</p>
                          <p className="type-meta text-muted-foreground">{r.action}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="type-meta text-muted-foreground">
                      Nothing to recommend for this period.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}
