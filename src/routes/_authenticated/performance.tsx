import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountIdentity, useAccountDirectory } from "@/components/account-identity";
import { ExternalIdentity } from "@/components/external-identity";
import { PostCard, formatPostStamp } from "@/components/post-card";
import {
  ToneFilterChips,
  toneCounts,
  matchesToneFilter,
  type ToneFilter,
} from "@/components/tone-filter";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Download,
  Eye,
  ExternalLink,
  Lightbulb,
  Loader2,
  MessageCircle,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  CommandGrid,
  RailAction,
  RailBar,
  RailCard,
  RailStat,
  RailStatList,
} from "@/components/command-layout";
import {
  Card,
  EmptyState,
  LockScreen,
  PageTabs,
  PageTitle,
  PageToolbar,
  SectionTitle,
  StatCard,
} from "@/components/ui-kit";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/filter-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConversationSources } from "@/components/conversation-sources";
import { ShareOfVoice } from "@/components/share-of-voice";
import { CampaignCompare } from "@/components/campaign-compare";
import { CampaignReport } from "@/components/campaign-report";
import { PerformanceGlossary } from "@/components/performance-glossary";
import { getPerformance, refreshPerformance } from "@/lib/performance.functions";
import { formatCount, scopeSummary } from "@/lib/performance";
import { performanceCsv, downloadCsv } from "@/lib/performance-csv";
import { buildPerformanceReport, formatUsd, formatWindow } from "@/lib/performance-report";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/performance")({
  validateSearch: (search: Record<string, unknown>): { campaign?: string } =>
    typeof search["campaign"] === "string" ? { campaign: search["campaign"] as string } : {},
  head: () => ({
    meta: [
      { title: "Performance - CommsIQ" },
      {
        name: "description",
        content:
          "Live engagement, impressions and reach across published posts and replies, organised into familiar performance, campaign and content views.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Performance - CommsIQ" },
      {
        property: "og:description",
        content:
          "Track performance, campaigns and published content from one measurement workspace.",
      },
    ],
  }),
  component: PerformancePage,
});

type PerformanceView = "overview" | "campaigns" | "content" | "breakdown";
type ActivityKind = "post" | "comment" | "campaign";
type ActivityFilter = "all" | ActivityKind;

const ACTIVITY_TABS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "post", label: "Posts" },
  { value: "comment", label: "Comments" },
  { value: "campaign", label: "Campaign replies" },
];

const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  post: "Post",
  comment: "Comment",
  campaign: "Campaign reply",
};

function formatDayLabel(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function activityKindOf(row: { kind: "tweet" | "reply"; campaignId: string | null }): ActivityKind {
  if (row.campaignId) return "campaign";
  return row.kind === "reply" ? "comment" : "post";
}

function PerformancePage() {
  const { campaign: campaignKey } = Route.useSearch();
  const queryClient = useQueryClient();
  const fetchPerformance = useServerFn(getPerformance);
  const runRefresh = useServerFn(refreshPerformance);
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { lookup: lookupAccount } = useAccountDirectory();
  const isAdmin = isAdminEmail(profile?.email);

  const [view, setView] = useState<PerformanceView>(campaignKey ? "campaigns" : "overview");
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<string>(campaignKey ?? "all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [toneFilter, setToneFilter] = useState<ToneFilter>([]);

  const {
    data: rawData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["performance"],
    queryFn: () => fetchPerformance(),
    enabled: !profileLoading && isAdmin,
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!campaignKey) return;
    setCampaignFilter(campaignKey);
    setView("campaigns");
  }, [campaignKey]);

  const data = useMemo(
    () => (rawData ? scopeSummary(rawData, campaignFilter) : undefined),
    [rawData, campaignFilter],
  );

  const campaigns = useMemo(() => rawData?.byCampaign ?? [], [rawData?.byCampaign]);
  const totals = data?.totals;
  const report = useMemo(
    () =>
      data
        ? buildPerformanceReport(data, {
            resolveName: (handle) => lookupAccount(handle)?.displayName || handle,
          })
        : null,
    [data, lookupAccount],
  );

  const byAccountNamed = useMemo(
    () =>
      (data?.byAccount ?? []).map((account) => ({
        ...account,
        name: lookupAccount(account.handle)?.displayName || account.handle,
      })),
    [data?.byAccount, lookupAccount],
  );

  const campaignTotals = useMemo(
    () =>
      campaigns.reduce(
        (acc, campaign) => ({
          replies: acc.replies + campaign.replies,
          impressions: acc.impressions + campaign.impressions,
          engagements: acc.engagements + campaign.engagements,
          reach: acc.reach + campaign.reach,
        }),
        { replies: 0, impressions: 0, engagements: 0, reach: 0 },
      ),
    [campaigns],
  );

  const activityCounts = useMemo(() => {
    const list = data?.rows ?? [];
    const counts = { all: list.length, post: 0, comment: 0, campaign: 0 };
    for (const row of list) counts[activityKindOf(row)] += 1;
    return counts as Record<ActivityFilter, number>;
  }, [data?.rows]);

  const preToneRows = useMemo(() => {
    const list = data?.rows ?? [];
    const q = query.trim().toLowerCase();
    return list
      .filter((row) => activityFilter === "all" || activityKindOf(row) === activityFilter)
      .filter(
        (row) =>
          !q ||
          row.content.toLowerCase().includes(q) ||
          row.handle.toLowerCase().includes(q) ||
          (row.campaignName ?? "").toLowerCase().includes(q),
      );
  }, [data?.rows, query, activityFilter]);

  const toneTally = useMemo(() => toneCounts(preToneRows.map((row) => row.content)), [preToneRows]);

  const rows = useMemo(
    () => preToneRows.filter((row) => matchesToneFilter(row.content, toneFilter)).slice(0, 100),
    [preToneRows, toneFilter],
  );

  useEffect(() => {
    if (!isAdmin) return;
    const id = setInterval(
      () => {
        void runRefresh()
          .then(() => queryClient.invalidateQueries({ queryKey: ["performance"] }))
          .catch(() => undefined);
      },
      60 * 60 * 1000,
    );
    return () => clearInterval(id);
  }, [isAdmin, runRefresh, queryClient]);

  if (!profileLoading && !isAdmin) {
    return (
      <WorkspaceShell title="Performance" wide>
        <LockScreen title="Performance is restricted to admins" />
      </WorkspaceShell>
    );
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      let synced = 0;
      let total = 0;
      for (let pass = 0; pass < 12; pass += 1) {
        const result = await runRefresh();
        synced += result.updated;
        total = total || result.total;
        await queryClient.invalidateQueries({ queryKey: ["performance"] });
        if (result.remaining === 0) break;
        toast.message(`Updating ${synced} of ${total} posts…`);
      }
      toast.success(`Updated ${synced} posts and replies.`);
    } catch (error) {
      toast.error(friendlyError(error, { action: "check for updates" }));
    } finally {
      setRefreshing(false);
    }
  }

  function handleExportCsv() {
    if (!data) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `fkf-performance-${stamp}.csv`,
      performanceCsv(data, (handle) => lookupAccount(handle)?.displayName || handle),
    );
    toast.success("Performance data downloaded.");
  }

  const pageTabs = [
    { value: "overview" as const, label: "Overview" },
    { value: "campaigns" as const, label: "Campaigns", count: campaigns.length },
    { value: "content" as const, label: "Content", count: data?.rows.length ?? 0 },
    { value: "breakdown" as const, label: "Breakdown" },
  ];

  const topAccounts = byAccountNamed.slice(0, 4);

  const leftRail = (
    <>
      <RailCard title="Scope" icon={Activity}>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger aria-label="Filter by campaign" className="h-9 w-full bg-background">
            <SelectValue placeholder="All campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.campaignId} value={campaign.campaignId}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <RailStatList>
          <RailStat
            label="Window"
            value={report ? formatWindow(report.window.start, report.window.end) : "—"}
          />
          <RailStat
            label="Last refreshed"
            value={
              data?.lastRefreshed
                ? new Date(data.lastRefreshed).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"
            }
          />
        </RailStatList>
      </RailCard>

      <RailCard title="Activity mix" icon={MessageCircle}>
        <RailBar label="Posts" value={activityCounts.post} total={activityCounts.all} />
        <RailBar label="Comments" value={activityCounts.comment} total={activityCounts.all} />
        <RailBar
          label="Campaign replies"
          value={activityCounts.campaign}
          total={activityCounts.all}
        />
      </RailCard>

      <RailCard title="Tone tally" icon={TrendingUp}>
        <RailStatList>
          {(Object.keys(toneTally) as (keyof typeof toneTally)[]).map((tone) => (
            <RailStat key={tone} label={tone} value={toneTally[tone]} />
          ))}
        </RailStatList>
      </RailCard>

      <RailCard title="Top accounts" icon={Users}>
        <RailStatList>
          {topAccounts.length ? (
            topAccounts.map((account) => (
              <RailStat
                key={account.handle}
                label={account.name}
                value={formatCount(account.engagements)}
                hint={`${formatCount(account.impressions)} impressions`}
              />
            ))
          ) : (
            <p className="type-meta py-2 text-muted-foreground">No accounts yet.</p>
          )}
        </RailStatList>
      </RailCard>
    </>
  );

  const rightRail = (
    <>
      <RailCard title="Actions" icon={Sparkles}>
        <div className="grid gap-2">
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="justify-start"
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Check for updates
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data}
            onClick={handleExportCsv}
            className="justify-start"
          >
            <Download className="size-4" aria-hidden="true" /> Download CSV
          </Button>
        </div>
        <div className="mt-3">
          <RailAction
            to="/performance/insights"
            icon={Sparkles}
            title="More insights"
            description="See deeper trends"
          />
        </div>
      </RailCard>

      {report ? (
        <RailCard title="What worked" icon={Lightbulb}>
          <ol className="grid gap-3">
            {report.worked.slice(0, 3).map((item, index) => (
              <li key={item.title} className="flex min-w-0 gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 type-meta font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="type-meta truncate font-semibold">{item.title}</p>
                  <p className="type-meta mt-0.5 text-muted-foreground">{item.body}</p>
                </div>
              </li>
            ))}
            {!report.worked.length ? (
              <li className="type-meta text-muted-foreground">Not enough data yet.</li>
            ) : null}
          </ol>
        </RailCard>
      ) : null}

      {report ? (
        <RailCard title="What to do next" icon={Sparkles}>
          <ul className="grid gap-2.5">
            {report.next.slice(0, 3).map((item) => (
              <li key={item.title} className="rounded-xl border border-border p-2.5">
                <p className="type-meta font-semibold">{item.title}</p>
                <p className="type-meta mt-0.5 text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </RailCard>
      ) : null}

      <RailCard title="Reference" icon={BookOpen}>
        <PerformanceGlossary />
      </RailCard>
    </>
  );

  return (
    <WorkspaceShell title="Performance" wide>
      <PageTitle
        description={
          report
            ? `${formatWindow(report.window.start, report.window.end)}${
                data?.lastRefreshed
                  ? ` · Updated ${new Date(data.lastRefreshed).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : ""
              }`
            : "See reach, engagement and campaign results in one place."
        }
      >
        Performance
      </PageTitle>

      {campaignKey ? (
        <div className="mb-5">
          <CampaignReport campaignKey={campaignKey} />
        </div>
      ) : null}

      <PageTabs items={pageTabs} value={view} onChange={setView} ariaLabel="Performance sections" />

      {isLoading ? (
        <div className="mt-5 grid gap-3" aria-label="Loading performance">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="mt-5">
          <EmptyState
            title="Performance could not be loaded"
            description={friendlyError(error, { action: "load performance" })}
            action={
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                <RefreshCw className="size-4" /> Try again
              </Button>
            }
          />
        </div>
      ) : !totals || (totals.posts === 0 && totals.replies === 0) ? (
        <div className="mt-5">
          <EmptyState
            title={
              campaignFilter === "all"
                ? "No measured activity yet"
                : "No results for this campaign yet"
            }
            description={
              campaignFilter === "all"
                ? "Publish an approved post or reply to begin measuring reach and engagement."
                : "Choose another campaign, or return once this campaign has published content."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm">
                  <Link to="/publish" search={{ choose: true }}>
                    Create campaign
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/campaign-manager">Open Campaigns</Link>
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Eye}
              label="Impressions"
              value={formatCount(totals.impressions)}
              hint={`Across ${totals.posts + totals.replies} published items`}
            />
            <StatCard
              icon={Users}
              label="Reach"
              value={formatCount(totals.reach)}
              hint={report ? `${report.headline.personas} participating accounts` : undefined}
            />
            <StatCard
              icon={Activity}
              label="Engagements"
              value={formatCount(totals.engagements)}
              hint={`${totals.engagementRate}% engagement rate`}
            />
            <StatCard
              icon={MessageCircle}
              label="Posts & replies"
              value={formatCount(totals.posts + totals.replies)}
              hint={`${totals.posts} posts · ${totals.replies} replies`}
            />
          </section>

          <CommandGrid left={leftRail} right={rightRail}>
            {view === "overview" ? (
              <div className="grid gap-5">
                <Card>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" />
                    <SectionTitle>Performance summary</SectionTitle>
                  </div>
                  <p className="type-body mt-3 leading-relaxed text-muted-foreground">
                    {report?.summaryParagraph ||
                      "Performance context will appear as activity accumulates."}
                  </p>
                  {report ? (
                    <dl className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/50 p-3">
                        <dt className="type-meta text-muted-foreground">Engagement rate</dt>
                        <dd className="type-card mt-1 font-semibold">
                          {report.headline.engagementRate}%
                        </dd>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3">
                        <dt className="type-meta text-muted-foreground">Campaigns measured</dt>
                        <dd className="type-card mt-1 font-semibold">
                          {report.headline.campaigns}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3">
                        <dt className="type-meta text-muted-foreground">Peak reach</dt>
                        <dd className="type-card mt-1 font-semibold">
                          {report.peakReachDay ? formatCount(report.peakReachDay.reach) : "—"}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3">
                        <dt className="type-meta text-muted-foreground">Earned media value</dt>
                        <dd className="type-card mt-1 font-semibold">
                          {formatUsd(report.headline.aveUsd)}
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                </Card>

                <Card>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <SectionTitle>Performance over time</SectionTitle>
                    <p className="type-meta text-muted-foreground">
                      {data.byDay.length === 1
                        ? "1 day of activity"
                        : `${data.byDay.length} days of activity`}
                    </p>
                  </div>
                  <div className="mt-4 h-64 w-full sm:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={data.byDay}
                        margin={{ left: -12, right: 4, top: 4, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="date"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatDayLabel}
                        />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} width={42} />
                        <Tooltip
                          labelFormatter={(date: string) =>
                            new Date(date).toLocaleDateString(undefined, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })
                          }
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid var(--border)",
                            background: "var(--popover)",
                            color: "var(--popover-foreground)",
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area
                          type="monotone"
                          dataKey="impressions"
                          name="Impressions"
                          stroke="var(--primary)"
                          fill="var(--primary)"
                          fillOpacity={0.12}
                        />
                        <Area
                          type="monotone"
                          dataKey="reach"
                          name="Reach"
                          stroke="var(--chart-2)"
                          fill="var(--chart-2)"
                          fillOpacity={0.08}
                        />
                        <Area
                          type="monotone"
                          dataKey="engagements"
                          name="Engagements"
                          stroke="var(--chart-3)"
                          fill="var(--chart-3)"
                          fillOpacity={0.08}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            ) : null}

            {view === "campaigns" ? (
              <div className="grid gap-5">
                {campaigns.length > 1 ? <CampaignCompare campaigns={campaigns} /> : null}
                <Card className="p-0">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
                    <div className="min-w-0">
                      <SectionTitle>Campaign results</SectionTitle>
                      <p className="type-meta mt-1 text-muted-foreground">
                        {campaigns.length
                          ? `${campaignTotals.replies.toLocaleString()} replies · ${formatCount(campaignTotals.impressions)} impressions · ${formatCount(campaignTotals.engagements)} engagements`
                          : "Campaign performance appears here once published content has metrics."}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/campaign-manager">Open Campaigns</Link>
                    </Button>
                  </div>

                  {!campaigns.length ? (
                    <div className="p-5">
                      <EmptyState
                        title="No campaign results yet"
                        description="Completed campaign replies and their measured performance will appear here."
                      />
                    </div>
                  ) : (
                    <>
                      <ul className="divide-y divide-border md:hidden">
                        {campaigns.map((campaign) => {
                          const selected = campaignFilter === campaign.campaignId;
                          return (
                            <li key={campaign.campaignId}>
                              <button
                                type="button"
                                aria-pressed={selected}
                                onClick={() =>
                                  setCampaignFilter((current) =>
                                    current === campaign.campaignId ? "all" : campaign.campaignId,
                                  )
                                }
                                className={`w-full p-4 text-left transition-colors ${selected ? "bg-primary/5" : "hover:bg-muted/40"}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="type-card truncate font-semibold">
                                      {campaign.name}
                                    </p>
                                    <p className="type-meta mt-1 text-muted-foreground">
                                      {campaign.replies} replies · {campaign.accounts} accounts
                                    </p>
                                  </div>
                                  <span className="type-meta shrink-0 font-semibold text-primary">
                                    {campaign.engagementRate}%
                                  </span>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  <div>
                                    <p className="text-[11px] text-muted-foreground">Impressions</p>
                                    <p className="type-meta mt-0.5 font-semibold">
                                      {formatCount(campaign.impressions)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-muted-foreground">Reach</p>
                                    <p className="type-meta mt-0.5 font-semibold">
                                      {formatCount(campaign.reach)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-muted-foreground">Engagements</p>
                                    <p className="type-meta mt-0.5 font-semibold">
                                      {formatCount(campaign.engagements)}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>

                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[760px] text-left type-body">
                          <thead>
                            <tr className="border-b border-border bg-muted/30 type-meta text-muted-foreground">
                              <th className="px-5 py-3 font-semibold">Campaign</th>
                              <th className="px-3 py-3 text-right font-semibold">Replies</th>
                              <th className="px-3 py-3 text-right font-semibold">Accounts</th>
                              <th className="px-3 py-3 text-right font-semibold">Impressions</th>
                              <th className="px-3 py-3 text-right font-semibold">Reach</th>
                              <th className="px-3 py-3 text-right font-semibold">Engagements</th>
                              <th className="px-5 py-3 text-right font-semibold">Eng. rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {campaigns.map((campaign) => {
                              const selected = campaignFilter === campaign.campaignId;
                              return (
                                <tr
                                  key={campaign.campaignId}
                                  aria-selected={selected}
                                  className={`cursor-pointer border-b border-border/70 last:border-0 ${selected ? "bg-primary/5" : "hover:bg-muted/40"}`}
                                  onClick={() =>
                                    setCampaignFilter((current) =>
                                      current === campaign.campaignId ? "all" : campaign.campaignId,
                                    )
                                  }
                                >
                                  <td className="px-5 py-3 font-semibold">{campaign.name}</td>
                                  <td className="px-3 py-3 text-right tabular-nums">
                                    {campaign.replies}
                                  </td>
                                  <td className="px-3 py-3 text-right tabular-nums">
                                    {campaign.accounts}
                                  </td>
                                  <td className="px-3 py-3 text-right tabular-nums">
                                    {formatCount(campaign.impressions)}
                                  </td>
                                  <td className="px-3 py-3 text-right tabular-nums">
                                    {formatCount(campaign.reach)}
                                  </td>
                                  <td className="px-3 py-3 text-right tabular-nums">
                                    {formatCount(campaign.engagements)}
                                  </td>
                                  <td className="px-5 py-3 text-right font-semibold tabular-nums">
                                    {campaign.engagementRate}%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </Card>
              </div>
            ) : null}

            {view === "content" ? (
              <div className="grid gap-4">
                <PageToolbar>
                  <FilterSelect
                    label="Activity type"
                    value={activityFilter}
                    onChange={setActivityFilter}
                    options={ACTIVITY_TABS.map((tab) => ({
                      value: tab.value,
                      label: tab.label,
                      count: activityCounts[tab.value],
                    }))}
                    triggerClassName="w-full sm:w-52"
                  />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search content, account or campaign…"
                    aria-label="Search published content"
                    className="h-10 w-full sm:max-w-sm"
                  />
                </PageToolbar>

                <ToneFilterChips
                  value={toneFilter}
                  onChange={setToneFilter}
                  counts={toneTally}
                  total={preToneRows.length}
                />

                <div className="min-w-0">
                  <SectionTitle>Published content</SectionTitle>
                  <p className="type-meta mt-1 text-muted-foreground">
                    Showing {rows.length.toLocaleString()} of {preToneRows.length.toLocaleString()}{" "}
                    matching items.
                  </p>
                </div>

                <ul className="grid gap-3 sm:gap-4">
                  {rows.map((row) => (
                    <li key={row.tweetId}>
                      <PostCard
                        author={
                          <AccountIdentity
                            handle={row.handle}
                            avatarClassName="size-10"
                            nameClassName="truncate text-sm font-semibold"
                          />
                        }
                        url={row.url}
                        text={row.content}
                        replyTo={
                          row.targetHandle ? (
                            <span className="flex flex-wrap items-center gap-1">
                              <span className="shrink-0">Replying to</span>
                              <ExternalIdentity
                                handle={row.targetHandle}
                                avatarClassName="size-5"
                                nameClassName="truncate type-meta text-muted-foreground"
                              />
                            </span>
                          ) : undefined
                        }
                        stamp={formatPostStamp(row.tweetedAt)}
                        metrics={[
                          { label: "Views", value: row.impressions },
                          { label: "Reach", value: row.reach },
                          { label: "Engagements", value: row.engagements },
                        ]}
                        badges={
                          <>
                            <span className="rounded-lg border border-border px-2.5 py-1 type-meta text-muted-foreground">
                              {ACTIVITY_LABELS[activityKindOf(row)]}
                            </span>
                            {row.campaignName ? (
                              <span className="rounded-lg bg-muted px-2.5 py-1 type-meta text-muted-foreground">
                                {row.campaignName}
                              </span>
                            ) : null}
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noreferrer"
                              className="sm:ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 type-meta font-medium text-foreground hover:bg-muted"
                            >
                              <ExternalLink className="size-3.5" aria-hidden="true" /> View on X
                            </a>
                          </>
                        }
                      />
                    </li>
                  ))}
                  {!rows.length ? (
                    <li>
                      <EmptyState
                        title="Nothing matches these filters"
                        description="Clear a filter or search for a different term."
                      />
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {view === "breakdown" ? (
              <div className="grid gap-5">
                {report ? (
                  <div className="grid gap-5 md:grid-cols-2">
                    <ConversationSources sources={report.sources} peakDays={report.peakDays} />
                    <ShareOfVoice entries={report.shareOfVoice} />
                  </div>
                ) : null}

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.55fr)]">
                  <Card className="p-0">
                    <div className="border-b border-border p-4 sm:p-5">
                      <SectionTitle>Account performance</SectionTitle>
                      <p className="type-meta mt-1 text-muted-foreground">
                        Accounts ranked by measured engagement in this window.
                      </p>
                    </div>

                    <ul className="divide-y divide-border md:hidden">
                      {byAccountNamed.map((account) => (
                        <li key={account.handle} className="p-4">
                          <AccountIdentity handle={account.handle} avatarClassName="size-9" />
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-[11px] text-muted-foreground">Posts</p>
                              <p className="type-meta font-semibold">{account.posts}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Impressions</p>
                              <p className="type-meta font-semibold">
                                {formatCount(account.impressions)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Engagements</p>
                              <p className="type-meta font-semibold">
                                {formatCount(account.engagements)}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[620px] text-left type-body">
                        <thead>
                          <tr className="border-b border-border bg-muted/30 type-meta text-muted-foreground">
                            <th className="px-5 py-3 font-semibold">Account</th>
                            <th className="px-3 py-3 text-right font-semibold">Posts</th>
                            <th className="px-3 py-3 text-right font-semibold">Impressions</th>
                            <th className="px-3 py-3 text-right font-semibold">Reach</th>
                            <th className="px-5 py-3 text-right font-semibold">Engagements</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byAccountNamed.map((account) => (
                            <tr
                              key={account.handle}
                              className="border-b border-border/70 last:border-0"
                            >
                              <td className="px-5 py-3">
                                <AccountIdentity handle={account.handle} avatarClassName="size-8" />
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums">{account.posts}</td>
                              <td className="px-3 py-3 text-right tabular-nums">
                                {formatCount(account.impressions)}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums">
                                {formatCount(account.reach)}
                              </td>
                              <td className="px-5 py-3 text-right font-semibold tabular-nums">
                                {formatCount(account.engagements)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  <div className="grid content-start gap-5">
                    <Card>
                      <SectionTitle>Engagement mix</SectionTitle>
                      <dl className="mt-4 divide-y divide-border">
                        {[
                          ["Likes", totals.likes],
                          ["Reposts", totals.retweets],
                          ["Replies received", totals.repliesReceived],
                          ["Quotes", totals.quotes],
                          ["Bookmarks", totals.bookmarks],
                        ].map(([label, value]) => (
                          <div
                            key={String(label)}
                            className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                          >
                            <dt className="type-meta text-muted-foreground">{label}</dt>
                            <dd className="type-body font-semibold tabular-nums">
                              {formatCount(Number(value))}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </Card>
                  </div>
                </div>
              </div>
            ) : null}
          </CommandGrid>
        </div>
      )}
    </WorkspaceShell>
  );
}
