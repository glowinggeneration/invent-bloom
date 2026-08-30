import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Gauge, Search, ShieldAlert } from "lucide-react";

import { DataFreshness } from "@/components/data-freshness";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, EmptyState, PageTitle, PageToolbar, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getXAccountHealth } from "@/lib/x-account-health.functions";
import { INTERNAL_ACCOUNT_BUDGETS } from "@/lib/x-compliance";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/account-health")({
  head: () => ({
    meta: [
      { title: "X Account Health - CommsIQ" },
      {
        name: "description",
        content:
          "Review linked X account readiness, recent activity, queue load and conservative campaign guardrails.",
      },
    ],
  }),
  component: AccountHealthPage,
});

function stateLabel(state: "ready" | "watch" | "held" | "suspended") {
  if (state === "ready") return "Ready";
  if (state === "watch") return "Watch";
  if (state === "held") return "Held";
  return "Suspended";
}

type AccountStateFilter = "all" | "ready" | "watch" | "held";

function AccountHealthPage() {
  const fetchHealth = useServerFn(getXAccountHealth);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<AccountStateFilter>("all");
  const health = useQuery({
    queryKey: ["x-account-health"],
    queryFn: () => fetchHealth(),
    refetchInterval: 60_000,
  });

  const rows = useMemo(() => health.data?.rows ?? [], [health.data?.rows]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows
      .filter(
        (row) =>
          stateFilter === "all" ||
          (stateFilter === "held"
            ? row.state === "held" || row.state === "suspended"
            : row.state === stateFilter),
      )
      .filter(
        (row) =>
          !term ||
          `${row.handle} ${row.displayName} ${row.state} ${row.reasons.join(" ")}`
            .toLowerCase()
            .includes(term),
      );
  }, [rows, query, stateFilter]);

  const ready = rows.filter((row) => row.state === "ready").length;
  const watch = rows.filter((row) => row.state === "watch").length;
  const held = rows.filter((row) => row.state === "held" || row.state === "suspended").length;
  const avgScore = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
    : 0;

  return (
    <WorkspaceShell title="X Account Health" wide>
      <PageTitle
        description="Account readiness based on stored campaign activity, queue load, recent failures and account state."
        actions={<DataFreshness at={health.data?.generatedAt} label="Account health" />}
      >
        X Account Health
      </PageTitle>

      <Card className="mb-5 border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="type-body font-semibold">Account protection is active</p>
            <p className="mt-1 type-meta text-muted-foreground">
              The platform blocks fleet-wide Likes, automated follows, peer self-boosting, multiple
              linked accounts targeting one post and near-duplicate multi-account copy. Activity
              uses conservative internal guardrails rather than reverse-engineered platform
              thresholds.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ready" value={ready} icon={CheckCircle2} tone="positive" />
        <StatCard
          label="Watch"
          value={watch}
          icon={AlertTriangle}
          tone={watch ? "negative" : "neutral"}
        />
        <StatCard
          label="Held / suspended"
          value={held}
          icon={ShieldAlert}
          tone={held ? "negative" : "neutral"}
        />
        <StatCard label="Average health" value={`${avgScore}%`} icon={Gauge} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2" aria-label="Filter accounts by health state">
        {(
          [
            ["all", "All", rows.length],
            ["ready", "Ready", ready],
            ["watch", "Watch", watch],
            ["held", "Held / suspended", held],
          ] as const
        ).map(([value, label, count]) => (
          <Button
            key={value}
            type="button"
            variant={stateFilter === value ? "default" : "outline"}
            size="sm"
            onClick={() => setStateFilter(value)}
          >
            {label} <span className="ml-1 tabular-nums opacity-75">{count}</span>
          </Button>
        ))}
      </div>

      <Card className="mt-5">
        <h2 className="type-section">Internal per-account guardrails</h2>
        <p className="mt-1 type-meta text-muted-foreground">
          Operational safety budgets help prevent accidental overuse and do not represent X
          enforcement thresholds.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="type-meta text-muted-foreground">Original posts</p>
            <p className="mt-1 type-card font-semibold">
              {INTERNAL_ACCOUNT_BUDGETS.tweet.rolling24h}/24h ·{" "}
              {INTERNAL_ACCOUNT_BUDGETS.tweet.minGapMinutes} min gap
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="type-meta text-muted-foreground">Operator-reviewed replies</p>
            <p className="mt-1 type-card font-semibold">
              {INTERNAL_ACCOUNT_BUDGETS.comment.rolling24h}/24h ·{" "}
              {INTERNAL_ACCOUNT_BUDGETS.comment.minGapMinutes} min gap
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="type-meta text-muted-foreground">Reposts</p>
            <p className="mt-1 type-card font-semibold">
              {INTERNAL_ACCOUNT_BUDGETS.retweet.rolling24h}/24h ·{" "}
              {INTERNAL_ACCOUNT_BUDGETS.retweet.minGapMinutes} min gap
            </p>
          </div>
        </div>
      </Card>

      <PageToolbar className="mt-5">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search accounts…"
            className="h-10 bg-background pl-9"
          />
        </div>
        <Button asChild variant="outline" size="sm" className="sm:ml-auto">
          <Link to="/preflight">Campaign Preflight</Link>
        </Button>
      </PageToolbar>

      <div className="mt-5">
        {health.isLoading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-32 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : health.isError ? (
          <EmptyState
            title="Account health could not be loaded"
            description={friendlyError(health.error, { action: "load account health" })}
            action={
              <Button variant="outline" size="sm" onClick={() => void health.refetch()}>
                Try again
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={rows.length ? "No accounts match that search" : "No linked accounts available"}
            description="Linked X accounts will appear here once they are connected."
          />
        ) : (
          <div className="space-y-3">
            {visible.map((row) => (
              <Card key={row.id}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="type-card font-semibold">{row.displayName}</p>
                      <span className="type-meta text-muted-foreground">
                        @{row.handle.replace(/^@/, "")}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.state === "ready" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : row.state === "watch" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-destructive/10 text-destructive"}`}
                      >
                        {stateLabel(row.state)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-end gap-3">
                      <span className="text-3xl font-semibold tabular-nums">{row.score}</span>
                      <span className="pb-1 type-meta text-muted-foreground">health score</span>
                    </div>
                    <div className="mt-3 space-y-1">
                      {row.reasons.slice(0, 3).map((reason) => (
                        <p key={reason} className="type-meta text-muted-foreground">
                          • {reason}
                        </p>
                      ))}
                    </div>
                    {row.lastError ? (
                      <p className="mt-2 line-clamp-2 type-meta text-destructive">
                        Last failure:{" "}
                        {friendlyError(row.lastError, { action: "complete the last action" })}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="type-meta text-muted-foreground">Posts</p>
                      <p className="mt-1 type-card font-semibold">
                        {row.actions24h.tweet}/{INTERNAL_ACCOUNT_BUDGETS.tweet.rolling24h}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="type-meta text-muted-foreground">Replies</p>
                      <p className="mt-1 type-card font-semibold">
                        {row.actions24h.comment}/{INTERNAL_ACCOUNT_BUDGETS.comment.rolling24h}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="type-meta text-muted-foreground">Reposts</p>
                      <p className="mt-1 type-card font-semibold">
                        {row.actions24h.retweet}/{INTERNAL_ACCOUNT_BUDGETS.retweet.rolling24h}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="type-meta text-muted-foreground">Queue</p>
                      <p className="mt-1 type-card font-semibold">{row.pending}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
