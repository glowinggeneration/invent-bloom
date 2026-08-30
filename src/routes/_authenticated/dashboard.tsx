import { useQuery } from "@tanstack/react-query";
import { AccountIdentity } from "@/components/account-identity";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarRange,
  ChevronDown,
  Eye,
  Gauge,
  Heart,
  Loader2,
  MessageSquareText,
  Radar,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { FirstRunChecklist } from "@/components/first-run-checklist";
import { BrandAccounts } from "@/components/brand-accounts";
import { BrandMentions } from "@/components/brand-mentions";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, SectionTitle, StatCard } from "@/components/ui-kit";
import { useProfile } from "@/hooks/use-profile";
import { getBrandHealth } from "@/lib/brand-health.functions";
import { BRAND_HEALTH_PRESETS, healthTone, presetRange } from "@/lib/brand-health";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type DashboardSearch = { range: string; from: string; to: string };

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    range: typeof search["range"] === "string" ? search["range"] : "all",
    from: typeof search["from"] === "string" && DAY_RE.test(search["from"]) ? search["from"] : "",
    to: typeof search["to"] === "string" && DAY_RE.test(search["to"]) ? search["to"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Brand Health - FKF CommsIQ" },
      {
        name: "description",
        content:
          "One view of brand health: message tests, persona confidence, everything your personas published and the reach and engagement it earned.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Brand Health - FKF CommsIQ" },
      {
        property: "og:description",
        content:
          "Tests, persona confidence, linked-account activity, reach and engagement in a single dashboard.",
      },
    ],
  }),
  component: BrandHealthPage,
});

const SOURCE_COLORS = ["hsl(var(--primary))", "var(--color-fkf-green, #12A150)", "#1f2937"];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function shortDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  });
}

function HealthRing({ score }: { score: number }) {
  const tone = healthTone(score);
  const stroke =
    tone === "green"
      ? "var(--color-fkf-green, #12A150)"
      : tone === "amber"
        ? "#D97706"
        : "hsl(var(--primary))";
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-[136px] place-items-center">
      <svg viewBox="0 0 136 136" className="size-[136px] -rotate-90">
        <circle cx="68" cy="68" r={r} fill="none" strokeWidth="12" className="stroke-muted" />
        <circle
          cx="68"
          cy="68"
          r={r}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          stroke={stroke}
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(100, Math.max(0, score))) / 100}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="type-display">{score}</p>
        <p className="type-meta text-muted-foreground">Health</p>
      </div>
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  publish: "Publish",
  campaign: "Campaign reply",
  "always-on": "Always-on",
};

function BrandHealthPage() {
  const { data: profile } = useProfile();
  const fetchHealth = useServerFn(getBrandHealth);
  const { range, from, to } = Route.useSearch();
  const navigate = useNavigate({ from: "/dashboard" });
  const [showDetails, setShowDetails] = useState(false);

  // Resolve the active window: a preset, or the custom from/to pair.
  const activeRange = useMemo(() => {
    if (range === "custom") return { from: from || undefined, to: to || undefined };
    const preset = BRAND_HEALTH_PRESETS.find((p) => p.id === range);
    return presetRange(preset ? preset.days : null);
  }, [range, from, to]);

  const setPreset = (id: string) => navigate({ search: { range: id, from: "", to: "" } });

  const setCustom = (next: { from?: string; to?: string }) =>
    navigate({
      search: (prev: DashboardSearch) => ({
        ...prev,
        range: "custom",
        from: next.from ?? prev.from,
        to: next.to ?? prev.to,
      }),
    });

  const { data, isPending, isFetching } = useQuery({
    queryKey: ["brand-health", activeRange.from ?? "", activeRange.to ?? ""],
    queryFn: () => fetchHealth({ data: activeRange }),
    refetchInterval: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const tests = data?.tests;
  const outbound = data?.outbound;
  const publish = data?.publish;
  const campaignStats = data?.campaigns;

  const reach = data?.reach;
  const sentTotal = (outbound?.posts ?? 0) + (outbound?.replies ?? 0);
  const latestTestId = tests?.recent[0]?.id;

  const rangeLabel =
    range === "custom"
      ? `${from || "start"} → ${to || "today"}`
      : (BRAND_HEALTH_PRESETS.find((p) => p.id === range)?.label ?? "All time");

  return (
    <WorkspaceShell title="Brand Health" wide>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="type-title">Brand Health</h1>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button asChild size="lg" className="w-full gap-2 sm:w-auto" disabled={!latestTestId}>
            <Link to="/chat/$threadId" params={{ threadId: latestTestId ?? "" }}>
              Open latest test <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Date range filter */}
      <section
        aria-label="Date range filter"
        className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {BRAND_HEALTH_PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={range === p.id ? "default" : "outline"}
              aria-pressed={range === p.id}
              onClick={() => setPreset(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="type-meta text-muted-foreground" htmlFor="bh-from">
            From
          </label>
          <Input
            id="bh-from"
            type="date"
            value={from}
            max={to || undefined}
            className="h-9 w-[150px]"
            onChange={(e) => setCustom({ from: e.target.value })}
          />
          <label className="type-meta text-muted-foreground" htmlFor="bh-to">
            To
          </label>
          <Input
            id="bh-to"
            type="date"
            value={to}
            min={from || undefined}
            className="h-9 w-[150px]"
            onChange={(e) => setCustom({ to: e.target.value })}
          />
          {isFetching && !isPending && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </section>

      <BrandAccounts />

      <BrandMentions />

      {isPending && (
        <div className="mt-10 flex items-center gap-2 type-body text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Building your brand health overview…
        </div>
      )}

      {!isPending && data && (
        <>
          {/* Score + headline stats */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <section className="flex items-center gap-6 rounded-2xl border border-border bg-card p-6">
              <HealthRing score={data.score} />
              <div className="min-w-0 flex-1 space-y-3">
                <h2 className="type-card">Brand health score</h2>
                {data.scoreParts.map((p) => (
                  <div key={p.label}>
                    <div className="flex items-center justify-between type-meta">
                      <span className="text-muted-foreground">{p.label}</span>
                      <span className="font-semibold">{p.value}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, p.value)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
              <StatCard
                icon={MessageSquareText}
                label="Tests run"
                value={String(tests?.total ?? 0)}
                hint={`${tests?.strong ?? 0} scored 75% or above`}
              />
              <StatCard
                icon={Gauge}
                label="Avg confidence"
                value={
                  tests?.average === null || tests?.average === undefined
                    ? "-"
                    : `${tests.average}%`
                }
                hint={`${tests?.weak ?? 0} tests need work`}
                tone="positive"
              />
              <StatCard
                icon={Eye}
                label="Reach"
                value={fmt(reach?.reach ?? 0)}
                hint={`${reach?.engagementRate ?? 0}% engagement rate`}
                tone="positive"
                className="sm:col-span-2"
              />
            </div>
          </div>

          {/* Trend */}
          <section className="mt-6 rounded-2xl border border-border bg-card p-6">
            <SectionTitle>Confidence trend</SectionTitle>
            <p className="type-meta mt-1 text-muted-foreground">
              Average persona confidence per day of testing.
            </p>
            <div className="mt-3 h-56">
              {tests && tests.trend.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tests.trend}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={30}
                    />
                    <Tooltip labelFormatter={(v) => shortDate(String(v))} />
                    <Line
                      type="monotone"
                      dataKey="confidence"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center type-body text-muted-foreground">
                  Run a couple of tests to see the trend.
                </div>
              )}
            </div>
          </section>

          {/* Recent tests */}
          <section className="mt-6 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <SectionTitle>Recent tests</SectionTitle>
              <Link
                to="/archive"
                search={{ q: "", persona: "all", reaction: "all", date: "all", sort: "recent" }}
                className="inline-flex items-center gap-1 type-meta font-medium text-primary hover:underline"
              >
                Archive <ArrowUpRight className="size-3" />
              </Link>
            </div>
            {tests && tests.recent.length > 0 ? (
              <ul className="mt-2 divide-y divide-border">
                {tests.recent.map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/chat/$threadId"
                      params={{ threadId: t.id }}
                      className="flex items-center gap-3 py-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate type-body font-medium">{t.title}</span>
                        <span className="block type-meta text-muted-foreground">
                          {new Date(t.updatedAt).toLocaleString("en-KE", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 type-meta font-semibold ${
                          t.confidence === null
                            ? "bg-secondary text-muted-foreground"
                            : t.confidence >= 75
                              ? "bg-fkf-green/10 text-fkf-green"
                              : t.confidence >= 60
                                ? "bg-neutral/15 text-foreground"
                                : "bg-negative/10 text-negative"
                        }`}
                      >
                        {t.confidence === null ? "-" : `${t.confidence}%`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No tests yet"
                description="Score a message against the persona panel and get three rewrites."
                action={
                  <Button asChild size="sm">
                    <Link to="/new">Run your first test</Link>
                  </Button>
                }
              />
            )}
          </section>

          {/* Details toggle */}
          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              aria-expanded={showDetails}
              onClick={() => setShowDetails((v) => !v)}
            >
              <ChevronDown
                className={`size-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
              />
              {showDetails ? "Hide details" : "Show details"}
            </Button>
          </div>

          {showDetails && (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-border bg-card p-6">
                  <SectionTitle>Where messages come from</SectionTitle>
                  <div className="mt-3 h-56">
                    {outbound && outbound.bySource.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={outbound.bySource}
                            dataKey="count"
                            nameKey="source"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={3}
                          >
                            {outbound.bySource.map((_, i) => (
                              <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="grid h-full place-items-center px-4 text-center type-body text-muted-foreground">
                        Nothing published yet from personas.
                      </div>
                    )}
                  </div>
                  {outbound && outbound.bySource.length > 0 && (
                    <ul className="mt-2 space-y-1 type-meta">
                      {outbound.bySource.map((s, i) => (
                        <li key={s.source} className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <span
                              className="size-2.5 rounded-full"
                              style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                            />
                            {s.source}
                          </span>
                          <span className="font-semibold">{s.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-card p-6">
                  <SectionTitle>Sending volume</SectionTitle>
                  <p className="type-meta mt-1 text-muted-foreground">Messages sent per day.</p>
                  <div className="mt-3 h-56">
                    {outbound && sentTotal > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={outbound.byDay}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-border"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={shortDate}
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            width={26}
                          />
                          <Tooltip labelFormatter={(v) => shortDate(String(v))} />
                          <Bar dataKey="sent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="grid h-full place-items-center px-4 text-center type-body text-muted-foreground">
                        No messages sent in the last 14 days.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
                  <SectionTitle>Reach &amp; engagement</SectionTitle>
                  <p className="type-meta mt-1 text-muted-foreground">
                    {rangeLabel} across all personas.
                  </p>
                  <div className="mt-3 h-56">
                    {reach && reach.reach > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={reach.byDay}>
                          <defs>
                            <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="0%"
                                stopColor="hsl(var(--primary))"
                                stopOpacity={0.35}
                              />
                              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-border"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={shortDate}
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            width={40}
                            tickFormatter={fmt}
                          />
                          <Tooltip labelFormatter={(v) => shortDate(String(v))} />
                          <Area
                            type="monotone"
                            dataKey="reach"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            fill="url(#reachFill)"
                          />
                          <Area
                            type="monotone"
                            dataKey="engagements"
                            stroke="var(--color-fkf-green, #12A150)"
                            strokeWidth={2}
                            fill="transparent"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="grid h-full place-items-center px-4 text-center type-body text-muted-foreground">
                        Reach data appears once published posts start collecting metrics.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <SectionTitle>Messages sent by personas</SectionTitle>
                  <Link
                    to="/publish"
                    className="inline-flex items-center gap-1 type-meta font-medium text-primary hover:underline"
                  >
                    Publish <ArrowUpRight className="size-3" />
                  </Link>
                </div>
                {outbound && outbound.recent.length > 0 ? (
                  <ul className="mt-2 divide-y divide-border">
                    {outbound.recent.map((m) => (
                      <li key={`${m.source}-${m.id}`} className="flex items-start gap-3 py-3">
                        <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                          {m.source === "campaign" ? (
                            <Radar className="size-4 text-muted-foreground" />
                          ) : m.source === "always-on" ? (
                            <Activity className="size-4 text-muted-foreground" />
                          ) : (
                            <Send className="size-4 text-muted-foreground" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 type-meta text-muted-foreground">
                            <AccountIdentity
                              handle={m.handle}
                              avatarClassName="size-5"
                              nameClassName="truncate font-semibold text-foreground"
                            />
                            <span className="rounded-full bg-secondary px-2 py-1 type-meta">
                              {SOURCE_LABEL[m.source]}
                            </span>
                            <span>
                              {new Date(m.createdAt).toLocaleString("en-KE", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </span>
                          </span>
                          <span className="mt-1 block line-clamp-2 type-body">{m.content}</span>
                        </span>
                        {m.url && (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 type-meta font-medium text-primary hover:underline"
                          >
                            View
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="Nothing sent yet"
                    description="Posts, campaign replies and always-on content from your personas show up here."
                  />
                )}
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 type-card">
                      <Send className="size-4 text-primary" /> Publishing
                    </h2>
                    <Link
                      to="/publish"
                      className="inline-flex items-center gap-1 type-meta font-medium text-primary hover:underline"
                    >
                      Open <ArrowUpRight className="size-3" />
                    </Link>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 type-body">
                    <div>
                      <dt className="type-meta text-muted-foreground">Runs</dt>
                      <dd className="font-medium">{publish?.jobs ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="type-meta text-muted-foreground">Objective-led runs</dt>
                      <dd className="font-medium">{publish?.objectiveJobs ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="type-meta text-muted-foreground">Posts</dt>
                      <dd className="font-medium">{publish?.posts ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="type-meta text-muted-foreground">Comments</dt>
                      <dd className="font-medium">{publish?.comments ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="type-meta text-muted-foreground">Queued actions</dt>
                      <dd className="font-medium">{publish?.queued ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="type-meta text-muted-foreground">Next release</dt>
                      <dd className="font-medium">
                        {publish?.nextRunAt
                          ? new Date(publish.nextRunAt).toLocaleString("en-KE", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "-"}
                      </dd>
                    </div>
                  </dl>
                  {(publish?.lastObjective || publish?.lastMessage) && (
                    <div className="mt-4 rounded-xl bg-secondary/60 p-3">
                      <p className="type-meta text-muted-foreground">
                        {publish?.lastObjective ? "Latest objective" : "Latest message"}
                      </p>
                      <p className="mt-1 line-clamp-3 type-body">
                        {publish?.lastObjective || publish?.lastMessage}
                      </p>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 type-card">
                      <Radar className="size-4 text-primary" /> Campaigns
                    </h2>
                    <Link
                      to="/campaigns"
                      className="inline-flex items-center gap-1 type-meta font-medium text-primary hover:underline"
                    >
                      Open <ArrowUpRight className="size-3" />
                    </Link>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 type-body">
                    <div>
                      <dt className="type-meta text-muted-foreground">Active</dt>
                      <dd className="font-medium">
                        {campaignStats?.active ?? 0} of {campaignStats?.total ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="type-meta text-muted-foreground">Terms watched</dt>
                      <dd className="font-medium">{campaignStats?.keywords ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="type-meta text-muted-foreground">Replies sent</dt>
                      <dd className="font-medium">{campaignStats?.replies ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="type-meta text-muted-foreground">Held / in progress</dt>
                      <dd className="font-medium">
                        {campaignStats?.held ?? 0} / {campaignStats?.failed ?? 0}
                      </dd>
                    </div>
                  </dl>
                  {campaignStats && campaignStats.top.length > 0 ? (
                    <ul className="mt-4 divide-y divide-border">
                      {campaignStats.top.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                          <span className="min-w-0">
                            <span className="block truncate type-body font-medium">{c.name}</span>
                            <span className="type-meta text-muted-foreground">
                              {c.accounts} account{c.accounts === 1 ? "" : "s"}
                              {c.lastReplyAt
                                ? ` · last ${new Date(c.lastReplyAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}`
                                : ""}
                            </span>
                          </span>
                          <span className="shrink-0 type-meta text-muted-foreground">
                            {c.replies} replies
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 type-meta text-muted-foreground">
                      No campaign replies in this window yet.
                    </p>
                  )}
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <section className="rounded-2xl border border-border bg-card p-6">
                  <h2 className="flex items-center gap-2 type-card">
                    <Heart className="size-4 text-primary" /> Top accounts by reach
                  </h2>
                  {reach && reach.topAccounts.length > 0 ? (
                    <ul className="mt-3 space-y-3 type-body">
                      {reach.topAccounts.map((a) => (
                        <li key={a.handle} className="flex items-center justify-between gap-3">
                          <AccountIdentity
                            handle={a.handle}
                            avatarClassName="size-6"
                            nameClassName="truncate font-medium"
                          />
                          <span className="shrink-0 type-meta text-muted-foreground">
                            {fmt(a.reach)} reach · {fmt(a.engagements)} eng
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 type-meta text-muted-foreground">
                      No account metrics collected yet.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-card p-6">
                  <h2 className="flex items-center gap-2 type-card">
                    <ShieldAlert className="size-4 text-primary" /> Delivery &amp; safety
                  </h2>
                  <dl className="mt-3 space-y-3 type-body">
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Failed sends</dt>
                      <dd className="font-medium">{outbound?.failed ?? 0}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Held for review</dt>
                      <dd className="font-medium">{outbound?.held ?? 0}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Always-on posts</dt>
                      <dd className="font-medium">{outbound?.alwaysOnPosts ?? 0}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Shared tests</dt>
                      <dd className="font-medium">{tests?.shared ?? 0}</dd>
                    </div>
                  </dl>
                  {profile?.org === "fkf" && (
                    <Button asChild variant="outline" size="sm" className="mt-4 w-full gap-2">
                      <Link to="/shared">
                        <Users className="size-4" /> Shared with FKF
                      </Link>
                    </Button>
                  )}
                </section>

                <section className="space-y-4">
                  <FirstRunChecklist threadId={tests?.recent[0]?.id} />
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="flex items-center gap-2 type-card">
                      <Sparkles className="size-4 text-primary" /> Quick start
                    </h2>
                    <div className="mt-3 space-y-2">
                      <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        className="w-full justify-start"
                      >
                        <Link to="/new">Test a fixture announcement</Link>
                      </Button>
                      <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        className="w-full justify-start"
                      >
                        <Link to="/personas">Browse the persona panel</Link>
                      </Button>
                      <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        className="w-full justify-start"
                      >
                        <Link
                          to="/archive"
                          search={{
                            q: "",
                            persona: "all",
                            reaction: "all",
                            date: "all",
                            sort: "recent",
                          }}
                        >
                          Review past results
                        </Link>
                      </Button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}
