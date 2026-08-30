import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, LockScreen, PageTitle, SectionTitle, StatCard } from "@/components/ui-kit";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import { getOperationsHealth, type HealthState } from "@/lib/operations-health.functions";

export const Route = createFileRoute("/_authenticated/admin/health")({
  head: () => ({
    meta: [
      { title: "System Health - CommsIQ" },
      {
        name: "description",
        content:
          "Internal monitoring health for connected sources, queues, accounts and recent delivery.",
      },
    ],
  }),
  component: SystemHealthPage,
});

const STATE_STYLE: Record<HealthState, string> = {
  healthy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  attention: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  stale: "bg-destructive/10 text-destructive",
  unknown: "bg-muted text-muted-foreground",
};

function stamp(at: string | null): string {
  if (!at) return "No recent timestamp";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

function SystemHealthPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const load = useServerFn(getOperationsHealth);
  const health = useQuery({
    queryKey: ["operations-health"],
    queryFn: () => load(),
    refetchInterval: 60_000,
    enabled: !profileLoading && isAdminEmail(profile?.email),
  });

  if (!profileLoading && !isAdminEmail(profile?.email)) {
    return (
      <WorkspaceShell title="System Health" wide>
        <LockScreen title="System health is restricted" />
      </WorkspaceShell>
    );
  }

  const data = health.data;

  function exportJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fkf-commsiq-system-health-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <WorkspaceShell title="System Health" wide>
      <PageTitle
        description="Internal status for monitoring sources, execution queues, account readiness and recent delivery."
        actions={
          <>
            <Button variant="outline" onClick={() => health.refetch()} disabled={health.isFetching}>
              <RefreshCw className={health.isFetching ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportJson} disabled={!data}>
              <Download className="size-4" /> Export JSON
            </Button>
          </>
        }
      >
        System Health
      </PageTitle>

      {health.isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : !data ? (
        <Card className="mt-6 p-6">
          <p className="type-body">System health could not be loaded.</p>
          <p className="type-meta mt-1 text-muted-foreground">
            Refresh the page or review the affected operational page directly.
          </p>
        </Card>
      ) : (
        <div className="mt-6 grid gap-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={UsersRound}
              label="Ready accounts"
              value={`${data.accounts.ready} / ${data.accounts.total}`}
              hint={`${data.accounts.suspended} suspended · ${data.accounts.needsSession} need a session`}
              tone={data.accounts.ready > 0 ? "positive" : "negative"}
            />
            <StatCard
              icon={Clock3}
              label="Pending queue"
              value={data.queue.pending.toLocaleString()}
              hint={
                data.queue.overdue ? `${data.queue.overdue} overdue actions` : "No overdue actions"
              }
              tone={data.queue.overdue ? "negative" : "neutral"}
            />
            <StatCard
              icon={Activity}
              label="24h delivery"
              value={data.delivery.last24h.toLocaleString()}
              hint={`${data.delivery.successful} successful · ${data.delivery.failed} failed · ${data.delivery.held} held`}
              tone={data.delivery.failed ? "negative" : "positive"}
            />
            <StatCard
              icon={ShieldCheck}
              label="Success rate"
              value={data.delivery.successRate === null ? "—" : `${data.delivery.successRate}%`}
              hint="Successful vs failed attempted actions in the last 24 hours"
              tone={
                data.delivery.successRate !== null && data.delivery.successRate >= 90
                  ? "positive"
                  : "neutral"
              }
            />
          </section>

          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-primary" />
                  <SectionTitle>Monitoring sources</SectionTitle>
                </div>
                <p className="type-meta mt-1 text-muted-foreground">
                  Status is based on the most recent records already stored by each connected
                  source.
                </p>
              </div>
              <p className="type-meta text-muted-foreground">Generated {stamp(data.generatedAt)}</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.sources.map((source) => (
                <article
                  key={source.key}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="type-card font-semibold">{source.label}</p>
                    <span
                      className={`rounded-full px-2 py-1 type-meta font-semibold capitalize ${STATE_STYLE[source.state]}`}
                    >
                      {source.state}
                    </span>
                  </div>
                  <p className="type-meta mt-2 text-muted-foreground">{source.detail}</p>
                  <p className="type-meta mt-3 text-muted-foreground">
                    Last seen: {stamp(source.lastSeenAt)}
                  </p>
                </article>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                <SectionTitle>Account readiness</SectionTitle>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["Total", data.accounts.total],
                  ["Ready", data.accounts.ready],
                  ["Suspended", data.accounts.suspended],
                  ["Inactive", data.accounts.inactive],
                  ["Needs session", data.accounts.needsSession],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-muted/40 p-3">
                    <dt className="type-meta text-muted-foreground">{label}</dt>
                    <dd className="type-card mt-1 font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/admin/accounts">Open Connected Accounts</Link>
              </Button>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-primary" />
                <SectionTitle>Recent attention items</SectionTitle>
              </div>
              {data.recentFailures.length ? (
                <ul className="mt-4 divide-y divide-border">
                  {data.recentFailures.map((item, index) => (
                    <li
                      key={`${item.source}-${item.at}-${index}`}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <span>
                        <span className="type-body block font-medium">{item.source}</span>
                        <span className="type-meta block capitalize text-muted-foreground">
                          {item.status}
                        </span>
                      </span>
                      <span className="type-meta shrink-0 text-muted-foreground">
                        {stamp(item.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="type-meta mt-4 text-muted-foreground">
                  No failed or held actions were recorded in the last 24 hours.
                </p>
              )}
            </Card>
          </div>

          {data.queue.overdue > 0 ? (
            <Card className="border-amber-500/40 p-5">
              <p className="type-card font-semibold">Queue needs attention</p>
              <p className="type-meta mt-1 text-muted-foreground">
                {data.queue.overdue} pending action{data.queue.overdue === 1 ? " is" : "s are"} past
                the scheduled run time. Open Campaign Manager before starting more execution if the
                number keeps growing.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/campaign-manager">Open Campaign Manager</Link>
              </Button>
            </Card>
          ) : null}
        </div>
      )}
    </WorkspaceShell>
  );
}
