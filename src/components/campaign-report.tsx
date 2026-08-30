import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, Download, ExternalLink, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AccountIdentity } from "@/components/account-identity";
import { ExternalIdentity } from "@/components/external-identity";
import { getTweetPreview } from "@/lib/publish.functions";
import { SectionTitle } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { getCampaignReport } from "@/lib/campaign-manager.functions";
import { ACTION_KIND_LABELS, STATUS_LABELS, type CampaignStatus } from "@/lib/campaign-manager";
import { formatCount } from "@/lib/performance";
import { downloadCsv } from "@/lib/performance-csv";
import { friendlyError } from "@/lib/friendly-errors";

const STATUS_CLASS: Record<CampaignStatus, string> = {
  running: "bg-emerald-500/10 text-emerald-600",
  paused: "bg-amber-500/10 text-amber-600",
  scheduled: "bg-sky-500/10 text-sky-600",
  completed: "bg-primary/10 text-primary",
};

type TabKey = "overview" | "actions" | "content" | "personas" | "sentiment";

function stamp(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Kpi({ label, value, context }: { label: string; value: string; context?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {context ? <p className="text-[11px] text-muted-foreground">{context}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Single-campaign report: what the campaign executed and what those actions
 * produced. Every card adapts to the campaign's own action mix.
 */
export function CampaignReport({ campaignKey }: { campaignKey: string }) {
  const [source, id] = campaignKey.split(":");
  const [tab, setTab] = useState<TabKey>("overview");
  const fetchReport = useServerFn(getCampaignReport);
  const { data, isLoading } = useQuery({
    queryKey: ["campaign-report", campaignKey],
    queryFn: () => fetchReport({ data: { source: source as "publish" | "listen", id: id! } }),
    enabled: Boolean(source && id),
  });

  const tabs = useMemo(() => {
    const list: { key: TabKey; label: string }[] = [{ key: "overview", label: "Overview" }];
    if (data?.campaign.breakdown.length) list.push({ key: "actions", label: "Actions breakdown" });
    if (data?.content.length) list.push({ key: "content", label: "Content" });
    if (data?.byAccount.length) list.push({ key: "personas", label: "Top personas" });
    if (data?.sentiment) list.push({ key: "sentiment", label: "Sentiment" });
    return list;
  }, [data]);

  if (isLoading) {
    return (
      <section className="card-surface flex items-center gap-2 p-6 type-body text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading campaign report…
      </section>
    );
  }
  if (!data) {
    return (
      <section className="card-surface p-6">
        <p className="type-body">We couldn't find this campaign. It may have been removed.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/campaign-manager">Back to campaigns</Link>
        </Button>
      </section>
    );
  }

  const c = data.campaign;
  const p = data.performance;
  const engagementKinds = c.kinds.filter(
    (k) => k === "like" || k === "retweet" || k === "bookmark",
  );
  const actionsDone = (kinds: string[]) =>
    c.breakdown.filter((b) => kinds.includes(b.kind)).reduce((n, b) => n + b.completed, 0);
  const active = tabs.some((t) => t.key === tab) ? tab : "overview";

  const exportCsv = () => {
    const rows = [
      ["metric", "value"],
      ["campaign", c.name],
      ["type", c.type],
      ["status", STATUS_LABELS[c.status]],
      ["started", c.startedAt],
      ["completed", c.completedAt ?? ""],
      ["planned actions", String(c.planned)],
      ["completed actions", String(c.completed)],
      ["actions in progress", String(c.failed)],
      ["engagements", String(p.engagements)],
      ["impressions", String(p.impressions)],
      ["reach", String(p.reach)],
      ["engagement rate", `${p.engagementRate}%`],
      ...c.breakdown.map((b) => [
        `${ACTION_KIND_LABELS[b.kind]} completed / planned`,
        `${b.completed} / ${b.planned}`,
      ]),
    ];
    downloadCsv(
      `${c.name.replace(/\s+/g, "-").toLowerCase()}-report.csv`,
      rows.map((r) => r.join(",")).join("\n"),
    );
  };

  const share = async () => {
    const url = `${window.location.origin}/performance?campaign=${encodeURIComponent(c.key)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Report link copied.");
    } catch (err) {
      toast.error(friendlyError(err, { action: "copy this link" }));
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-tight">{c.name}</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[c.status]}`}
            >
              {STATUS_LABELS[c.status]}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{c.summary || c.type}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/campaign-manager">
              <ArrowLeft className="size-4" /> Back to campaigns
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-4" /> Export report
          </Button>
          <Button size="sm" onClick={share}>
            <Share2 className="size-4" /> Share report
          </Button>
        </div>
      </div>

      {!c.hasExecution && (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
          We don't have execution data for this campaign, but any results from its posts are still
          shown below.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {c.hasExecution && (
          <Kpi
            label="Total actions"
            value={formatCount(c.planned)}
            context={`${c.progress}% completed`}
          />
        )}
        {c.breakdown.map((b) => (
          <Kpi
            key={b.kind}
            label={ACTION_KIND_LABELS[b.kind]}
            value={formatCount(b.completed)}
            context={`of ${formatCount(b.planned)} planned`}
          />
        ))}
        {p.engagements > 0 && <Kpi label="Engagements" value={formatCount(p.engagements)} />}
        {p.reach > 0 && <Kpi label="Reach" value={formatCount(p.reach)} />}
        {p.impressions > 0 && <Kpi label="Impressions" value={formatCount(p.impressions)} />}
        {p.impressions > 0 && <Kpi label="Engagement rate" value={`${p.engagementRate}%`} />}
      </div>

      {data.target?.tweetUrl && engagementKinds.length > 0 && (
        <TargetTweetCard
          url={data.target.tweetUrl}
          actions={engagementKinds.map((k) => ({
            label: ACTION_KIND_LABELS[k],
            value: actionsDone([k]),
          }))}
        />
      )}

      {data.target?.handles?.length ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <SectionTitle className="text-sm">Accounts followed</SectionTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCount(actionsDone(["follow"]))} follow(s) completed by your personas.
          </p>
          <ul className="mt-3 space-y-2">
            {data.target.handles.map((h) => (
              <li key={h} className="flex items-center justify-between gap-3">
                <ExternalIdentity handle={h} />
                <a
                  href={`https://x.com/${h}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs text-primary"
                >
                  <ExternalLink className="size-3.5" /> View
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              active === t.key
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
            <SectionTitle className="text-sm">Performance over time</SectionTitle>
            {data.byDay.length > 1 ? (
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} width={40} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="engagements"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Not enough measured days to plot a trend yet.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <SectionTitle className="text-sm">Campaign summary</SectionTitle>
            <div className="mt-2 divide-y divide-border">
              <Row label="Type" value={c.type} />
              <Row label="Started" value={stamp(c.startedAt)} />
              <Row label="Completed" value={stamp(c.completedAt)} />
              <Row label="Duration" value={data.duration} />
              <Row label="Completion rate" value={c.hasExecution ? `${c.progress}%` : "—"} />
              <Row label="Planned actions" value={c.hasExecution ? formatCount(c.planned) : "—"} />
              <Row
                label="Completed actions"
                value={c.hasExecution ? formatCount(c.completed) : "—"}
              />
            </div>
          </div>

          {c.breakdown.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-3">
              <SectionTitle className="text-sm">Actions breakdown</SectionTitle>
              <div className="mt-3 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={c.breakdown.map((b) => ({
                      name: ACTION_KIND_LABELS[b.kind],
                      completed: b.completed,
                      planned: b.planned,
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} width={40} />
                    <Tooltip />
                    <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {active === "actions" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-right">Planned</th>
                <th className="px-3 py-2 text-right">Completed</th>
                <th className="px-3 py-2 text-right">In progress</th>
                <th className="px-3 py-2 text-right">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {c.breakdown.map((b) => (
                <tr key={b.kind}>
                  <td className="px-3 py-2 font-medium">{ACTION_KIND_LABELS[b.kind]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCount(b.planned)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCount(b.completed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCount(b.failed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {b.planned ? Math.round((b.completed / b.planned) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active === "content" && (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {data.content.map((item) => (
            <li key={item.tweetId} className="flex flex-wrap items-start gap-3 px-3 py-3">
              <AccountIdentity handle={item.handle} avatarClassName="size-7" />
              <p className="min-w-[12rem] flex-1 text-xs text-muted-foreground">
                {item.text || "—"}
              </p>
              <div className="flex shrink-0 items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
                <span>{formatCount(item.likes)} likes</span>
                <span>{formatCount(item.replies)} replies</span>
                <span>{formatCount(item.engagements)} eng.</span>
                <span>{formatCount(item.impressions)} views</span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary"
                >
                  <ExternalLink className="size-3.5" /> View
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {active === "personas" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Persona</th>
                <th className="px-3 py-2 text-right">Actions</th>
                <th className="px-3 py-2 text-right">Engagements</th>
                <th className="px-3 py-2 text-right">Reach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.byAccount.map((a) => (
                <tr key={a.handle}>
                  <td className="px-3 py-2">
                    <AccountIdentity handle={a.handle} avatarClassName="size-6" />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCount(a.actions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCount(a.engagements)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCount(a.reach)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active === "sentiment" && data.sentiment && (
        <div className="grid gap-2 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
          <Kpi label="Positive" value={`${data.sentiment.positive}%`} />
          <Kpi label="Neutral" value={`${data.sentiment.neutral}%`} />
          <Kpi label="Negative" value={`${data.sentiment.negative}%`} />
        </div>
      )}
    </section>
  );
}

/** The post an engagement campaign acted on, with the actions it delivered. */
function TargetTweetCard({
  url,
  actions,
}: {
  url: string;
  actions: { label: string; value: number }[];
}) {
  const fetchPreview = useServerFn(getTweetPreview);
  const { data } = useQuery({
    queryKey: ["tweet-preview", url],
    queryFn: () => fetchPreview({ data: { url } }),
    enabled: /status\/\d+/.test(url),
    staleTime: 5 * 60 * 1000,
  });
  const tweet = data?.tweet ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <SectionTitle className="text-sm">Post engaged with</SectionTitle>
      {tweet ? (
        <div className="mt-3 space-y-2">
          <AccountIdentity handle={tweet.authorHandle} avatarClassName="size-7" />
          <p className="text-sm leading-snug">{tweet.text}</p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
            <span>{formatCount(tweet.likeCount ?? 0)} likes</span>
            <span>{formatCount(tweet.retweetCount ?? 0)} reposts</span>
            <span>{formatCount(tweet.replyCount ?? 0)} replies</span>
          </div>
        </div>
      ) : (
        <p className="mt-2 truncate text-xs text-muted-foreground">{url}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((a) => (
          <span
            key={a.label}
            className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium tabular-nums"
          >
            {formatCount(a.value)} {a.label.toLowerCase()} sent
          </span>
        ))}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
        >
          <ExternalLink className="size-3" /> Open post
        </a>
      </div>
    </div>
  );
}
