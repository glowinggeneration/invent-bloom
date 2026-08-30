import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  Gauge,
  LayoutList,
  MessageSquare,
  RefreshCw,
  Settings2,
  Users,
} from "lucide-react";

import { DataFreshness } from "@/components/data-freshness";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, EmptyState, PageTitle, StatCard } from "@/components/ui-kit";
import {
  CommandGrid,
  RailAction,
  RailBar,
  RailCard,
  RailStat,
  RailStatList,
} from "@/components/command-layout";
import { Button } from "@/components/ui/button";
import { downloadCommandReportPdf } from "@/lib/command-report-pdf";
import { getCampaignReport, listManagedCampaigns } from "@/lib/campaign-manager.functions";
import { ACTION_KIND_LABELS, type CampaignSource } from "@/lib/campaign-manager";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/campaign-proof")({
  validateSearch: (search: Record<string, unknown>): { campaign?: string | undefined } => ({
    campaign:
      typeof search["campaign"] === "string" && search["campaign"].trim()
        ? (search["campaign"] as string)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Campaign Proof - CommsIQ" },
      {
        name: "description",
        content:
          "A permanent operational record of what a campaign was asked to do, what completed and what measurable result followed.",
      },
    ],
  }),
  component: CampaignProofPage,
});

function CampaignProofPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const fetchCampaigns = useServerFn(listManagedCampaigns);
  const fetchReport = useServerFn(getCampaignReport);
  const [selectedKey, setSelectedKey] = useState(search.campaign ?? "");

  const campaigns = useQuery({
    queryKey: ["campaign-proof", "campaigns"],
    queryFn: () => fetchCampaigns(),
  });

  useEffect(() => {
    const rows = campaigns.data ?? [];
    if (!rows.length) return;
    if (search.campaign && rows.some((campaign) => campaign.key === search.campaign)) {
      if (selectedKey !== search.campaign) setSelectedKey(search.campaign);
      return;
    }
    if (!selectedKey || !rows.some((campaign) => campaign.key === selectedKey)) {
      const fallback = rows[0]!.key;
      setSelectedKey(fallback);
      void navigate({ to: "/campaign-proof", search: { campaign: fallback }, replace: true });
    }
  }, [campaigns.data, navigate, search.campaign, selectedKey]);

  const selected = campaigns.data?.find((campaign) => campaign.key === selectedKey) ?? null;
  const report = useQuery({
    queryKey: ["campaign-proof", selected?.key ?? ""],
    queryFn: () =>
      fetchReport({ data: { source: selected!.source as CampaignSource, id: selected!.id } }),
    enabled: Boolean(selected),
  });

  const proof = report.data;
  const accounts = proof?.byAccount ?? [];
  const topContent = proof?.content.slice(0, 5) ?? [];
  const completionRate =
    selected && selected.planned > 0
      ? Math.round((selected.completed / selected.planned) * 100)
      : selected?.status === "completed"
        ? 100
        : 0;

  const timeline = useMemo(() => {
    if (!selected) return [];
    return [
      { label: "Created", value: new Date(selected.startedAt).toLocaleString() },
      {
        label: "Current status",
        value: selected.status.charAt(0).toUpperCase() + selected.status.slice(1),
      },
      ...(selected.completedAt
        ? [{ label: "Completed", value: new Date(selected.completedAt).toLocaleString() }]
        : []),
      ...(proof?.duration ? [{ label: "Duration", value: proof.duration }] : []),
    ];
  }, [selected, proof?.duration]);

  const download = () => {
    if (!selected || !proof) return;
    void downloadCommandReportPdf({
      title: "FKF Campaign Record",
      subtitle: `${selected.name} · ${selected.type}`,
      filename: `FKF-Campaign-Record-${
        selected.name
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 48) || selected.id
      }.pdf`,
      generatedAt: selected.completedAt ?? selected.startedAt,
      sections: [
        {
          heading: "Campaign brief",
          lines: [
            `Name: ${selected.name}.`,
            `Type: ${selected.type}.`,
            `Summary: ${selected.summary || "No additional summary stored."}`,
            `Status: ${selected.status}.`,
            `Duration: ${proof.duration}.`,
          ],
        },
        {
          heading: "Execution",
          stats: [
            { label: "Planned", value: String(selected.planned), tone: "ink" as const },
            { label: "Completed", value: String(selected.completed), tone: "green" as const },
            { label: "In progress", value: String(selected.failed) },
          ],
          chart: {
            title: "Completed actions by type",
            rows: selected.breakdown.map((item) => ({
              label: ACTION_KIND_LABELS[item.kind],
              value: item.completed,
            })),
          },
          lines: [
            `${selected.planned} actions planned.`,
            `${selected.completed} actions completed.`,
            `${selected.failed} actions still in progress.`,
            `${selected.remaining} actions remain.`,
            ...selected.breakdown.map(
              (item) =>
                `${ACTION_KIND_LABELS[item.kind]}: ${item.completed}/${item.planned} completed, ${item.failed} in progress.`,
            ),
          ],
        },
        {
          heading: "Target",
          lines: proof.target
            ? [
                proof.target.tweetUrl ? `Target post: ${proof.target.tweetUrl}` : "",
                proof.target.handles.length
                  ? `Target accounts: ${proof.target.handles.map((handle) => `@${handle}`).join(", ")}`
                  : "",
              ].filter(Boolean)
            : ["No single target was stored for this campaign."],
        },
        {
          heading: "Measured result",
          lines: [
            `${proof.performance.impressions.toLocaleString()} impressions.`,
            `${proof.performance.reach.toLocaleString()} estimated reach.`,
            `${proof.performance.engagements.toLocaleString()} engagements.`,
            `${proof.performance.engagementRate}% engagement rate.`,
            `${proof.performance.likes.toLocaleString()} likes, ${proof.performance.retweets.toLocaleString()} reposts, ${proof.performance.repliesReceived.toLocaleString()} replies received.`,
          ],
        },
        {
          heading: "Account participation",
          lines: accounts
            .slice(0, 20)
            .map(
              (account) =>
                `@${account.handle}: ${account.actions} actions, ${account.engagements.toLocaleString()} engagements, ${account.impressions.toLocaleString()} impressions.`,
            ),
        },
      ],
    });
  };

  function chooseCampaign(key: string) {
    setSelectedKey(key);
    void navigate({ to: "/campaign-proof", search: { campaign: key }, replace: true });
  }

  return (
    <WorkspaceShell title="Campaign Proof" wide>
      <PageTitle
        description="A defensible record of campaign intent, execution and measured result. Nothing here changes the campaign itself."
        actions={
          <DataFreshness
            at={selected?.completedAt ?? selected?.startedAt}
            label="Campaign record"
            staleMinutes={1440}
          />
        }
      >
        Campaign Proof
      </PageTitle>

      {campaigns.isLoading || (selected && report.isLoading) ? (
        <div className="mt-5 grid gap-3" aria-label="Loading campaign record">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : campaigns.isError ? (
        <div className="mt-5">
          <EmptyState
            title="Campaign records could not be loaded"
            description={friendlyError(campaigns.error, { action: "load campaign records" })}
            action={
              <Button variant="outline" size="sm" onClick={() => void campaigns.refetch()}>
                <RefreshCw className="size-4" /> Try again
              </Button>
            }
          />
        </div>
      ) : !selected ? (
        <div className="mt-5">
          <EmptyState
            title="No campaign record available yet"
            description="Campaign records appear here after an approved campaign is scheduled or completed."
            action={
              <Button asChild size="sm">
                <Link to="/publish" search={{ choose: true }}>
                  Create a campaign
                </Link>
              </Button>
            }
          />
        </div>
      ) : report.isError ? (
        <div className="mt-5">
          <EmptyState
            title="This campaign record needs another check"
            description={friendlyError(report.error, { action: "load this campaign record" })}
            action={
              <Button variant="outline" size="sm" onClick={() => void report.refetch()}>
                <RefreshCw className="size-4" /> Check again
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Completion"
              value={`${completionRate}%`}
              icon={Gauge}
              tone={selected.status === "completed" ? "positive" : "neutral"}
            />
            <StatCard label="Completed actions" value={selected.completed} icon={CheckCircle2} />
            <StatCard label="Participating accounts" value={accounts.length} icon={Users} />
            <StatCard
              label="Measured engagements"
              value={proof ? proof.performance.engagements.toLocaleString() : "—"}
              icon={MessageSquare}
            />
          </div>

          {!proof ? (
            <div className="mt-5">
              <EmptyState
                title="Results are not available yet"
                description="This campaign record is saved. Execution or measured performance will appear here after the next confirmed update."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/campaign-manager">Open Campaigns</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-5">
              <CommandGrid
                left={
                  <>
                    <RailCard title="Campaign" icon={Settings2}>
                      <label
                        className="type-meta font-semibold text-muted-foreground"
                        htmlFor="proof-campaign"
                      >
                        Select campaign
                      </label>
                      <select
                        id="proof-campaign"
                        value={selectedKey}
                        onChange={(event) => chooseCampaign(event.target.value)}
                        className="mt-2 h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {(campaigns.data ?? []).map((campaign) => (
                          <option key={campaign.key} value={campaign.key}>
                            {campaign.name} · {campaign.type} · {campaign.status}
                          </option>
                        ))}
                      </select>
                    </RailCard>

                    <RailCard title="Delivery counts" icon={LayoutList}>
                      <RailStatList>
                        <RailStat label="Planned" value={selected.planned} />
                        <RailStat label="Completed" value={selected.completed} tone="positive" />
                        <RailStat label="In progress" value={selected.failed} tone="neutral" />
                        <RailStat label="Remaining" value={selected.remaining} />
                      </RailStatList>
                      {selected.breakdown.length ? (
                        <div className="mt-2 space-y-1">
                          {selected.breakdown.map((item) => (
                            <RailBar
                              key={item.kind}
                              label={ACTION_KIND_LABELS[item.kind]}
                              value={item.completed}
                              total={item.planned || 1}
                              valueLabel={`${item.completed}/${item.planned}`}
                            />
                          ))}
                        </div>
                      ) : null}
                    </RailCard>

                    <RailCard title="Persona / account counts" icon={Users}>
                      <RailStatList>
                        <RailStat label="Participating accounts" value={accounts.length} />
                        {accounts.slice(0, 6).map((account) => (
                          <RailStat
                            key={account.handle}
                            label={`@${account.handle}`}
                            value={`${account.actions} actions`}
                          />
                        ))}
                      </RailStatList>
                      {!accounts.length ? (
                        <p className="type-meta text-muted-foreground">
                          No participating account rows are available yet.
                        </p>
                      ) : null}
                    </RailCard>

                    <RailCard title="Date window" icon={CalendarClock}>
                      <RailStatList>
                        {timeline.map((item) => (
                          <RailStat key={item.label} label={item.label} value={item.value} />
                        ))}
                      </RailStatList>
                    </RailCard>
                  </>
                }
                right={
                  <>
                    <RailCard title="Actions" icon={Download}>
                      <div className="space-y-2">
                        <Button
                          className="w-full"
                          variant="outline"
                          size="sm"
                          onClick={download}
                          disabled={!proof}
                        >
                          <Download className="size-4" /> Download proof PDF
                        </Button>
                        <Button
                          className="w-full"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void campaigns.refetch();
                            void report.refetch();
                          }}
                        >
                          <RefreshCw className="size-4" /> Check for updates
                        </Button>
                      </div>
                    </RailCard>

                    <RailCard title="Shortcuts" icon={ExternalLink}>
                      <div className="space-y-2">
                        <RailAction
                          to="/campaign-manager"
                          icon={FileCheck2}
                          title="Campaign manager"
                          description="Back to campaign controls"
                        />
                        <RailAction
                          to="/performance"
                          icon={BarChart3}
                          title="Performance"
                          description="See broader performance trends"
                        />
                      </div>
                    </RailCard>
                  </>
                }
              >
                <Card>
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="size-5 text-primary" />
                    <h2 className="type-section">Execution record</h2>
                  </div>
                  <p className="mt-2 type-body font-semibold">{selected.name}</p>
                  <p className="mt-1 type-meta text-muted-foreground">
                    {selected.summary || selected.type}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {selected.breakdown.map((item) => (
                      <div key={item.kind} className="rounded-xl border border-border p-3">
                        <p className="type-meta font-semibold">{ACTION_KIND_LABELS[item.kind]}</p>
                        <p className="mt-1 text-xl font-semibold">
                          {item.completed}/{item.planned}
                        </p>
                        <p className="type-meta text-muted-foreground">
                          completed · {item.failed} in progress
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <h2 className="type-section">Measured result</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      ["Impressions", proof.performance.impressions.toLocaleString()],
                      ["Reach", proof.performance.reach.toLocaleString()],
                      ["Engagements", proof.performance.engagements.toLocaleString()],
                      ["Engagement rate", `${proof.performance.engagementRate}%`],
                      ["Likes", proof.performance.likes.toLocaleString()],
                      ["Reposts", proof.performance.retweets.toLocaleString()],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-muted/50 p-3">
                        <p className="type-meta text-muted-foreground">{label}</p>
                        <p className="mt-1 type-card font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {topContent.length ? (
                  <Card>
                    <h2 className="type-section">Campaign content</h2>
                    <div className="mt-3 divide-y divide-border">
                      {topContent.map((content) => (
                        <div key={content.tweetId} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="type-meta font-semibold">@{content.handle}</p>
                              <p className="mt-1 line-clamp-3 type-body text-muted-foreground">
                                {content.text}
                              </p>
                              <p className="mt-1 type-meta text-muted-foreground">
                                {content.impressions.toLocaleString()} impressions ·{" "}
                                {content.engagements.toLocaleString()} engagements
                              </p>
                            </div>
                            <a
                              href={content.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Open post"
                              className="shrink-0 text-primary"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                <Card>
                  <h2 className="type-section">Target</h2>
                  {proof.target ? (
                    <div className="mt-3 space-y-2">
                      {proof.target.tweetUrl ? (
                        <a
                          className="block break-all type-meta font-medium text-primary hover:underline"
                          href={proof.target.tweetUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {proof.target.tweetUrl}
                        </a>
                      ) : null}
                      {proof.target.handles.length ? (
                        <p className="type-meta break-words text-muted-foreground">
                          {proof.target.handles.map((handle) => `@${handle}`).join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 type-meta text-muted-foreground">
                      No single external target was stored for this campaign.
                    </p>
                  )}
                </Card>

                <Card>
                  <h2 className="type-section">Account participation</h2>
                  <div className="mt-3 space-y-2">
                    {accounts.slice(0, 10).map((account) => (
                      <div
                        key={account.handle}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2"
                      >
                        <span className="truncate type-meta font-semibold">@{account.handle}</span>
                        <span className="type-meta shrink-0 text-muted-foreground">
                          {account.actions} actions
                        </span>
                      </div>
                    ))}
                    {!accounts.length ? (
                      <p className="type-meta text-muted-foreground">
                        No participating account rows are available yet.
                      </p>
                    ) : null}
                  </div>
                </Card>
              </CommandGrid>
            </div>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}
