import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  LineChart,
  Plug,
  Search,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { AccountCostSummary } from "@/components/account-cost-summary";
import { ConnectedAccountsStatus } from "@/components/connected-accounts-status";
import {
  CommandGrid,
  RailAction,
  RailBar,
  RailCard,
  RailStat,
  RailStatList,
} from "@/components/command-layout";
import { DataFreshness } from "@/components/data-freshness";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  EmptyState,
  LockScreen,
  PageTabs,
  PageTitle,
  PageToolbar,
  StatCard,
} from "@/components/ui-kit";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import { getApiUsage } from "@/lib/api-usage.functions";
import { listXAccounts } from "@/lib/publish.functions";
import type { XAccount } from "@/lib/publish";

export const Route = createFileRoute("/_authenticated/linked-accounts")({
  head: () => ({
    meta: [
      { title: "Linked Accounts - SMAIT" },
      {
        name: "description",
        content:
          "Review linked X account readiness, provider balance and current action-specific API costs.",
      },
    ],
  }),
  component: LinkedAccountsPage,
});

type AccountView = "all" | "ready" | "attention" | "suspended";

function stateOf(account: XAccount): AccountView {
  if (account.suspended) return "suspended";
  if (account.isActive && account.hasToken) return "ready";
  return "attention";
}

function stateLabel(account: XAccount) {
  const state = stateOf(account);
  if (state === "ready") return "Ready";
  if (state === "suspended") return "Suspended";
  if (!account.isActive) return "Inactive";
  return "Reconnect";
}

function stateClass(account: XAccount) {
  const state = stateOf(account);
  if (state === "ready") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (state === "suspended") return "bg-destructive/10 text-destructive";
  return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function relativeTime(iso: string | null) {
  if (!iso) return "No recorded activity";
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "No recorded activity";
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (minutes < 1) return "Active just now";
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  return `Active ${Math.round(hours / 24)}d ago`;
}

function LinkedAccountsPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  const fetchAccounts = useServerFn(listXAccounts);
  const fetchUsage = useServerFn(getApiUsage);
  const [view, setView] = useState<AccountView>("all");
  const [query, setQuery] = useState("");

  const accountsQuery = useQuery({
    queryKey: ["x-accounts", "all"],
    queryFn: () => fetchAccounts({ data: { scope: "all" } }),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
  const usageQuery = useQuery({
    queryKey: ["api-usage"],
    queryFn: () => fetchUsage(),
    enabled: isAdmin,
    refetchInterval: 5 * 60 * 1000,
  });

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const counts = useMemo(
    () => ({
      all: accounts.length,
      ready: accounts.filter((account) => stateOf(account) === "ready").length,
      attention: accounts.filter((account) => stateOf(account) === "attention").length,
      suspended: accounts.filter((account) => stateOf(account) === "suspended").length,
    }),
    [accounts],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return accounts.filter((account) => {
      if (view !== "all" && stateOf(account) !== view) return false;
      if (!term) return true;
      return `${account.displayName} ${account.personaLabel} ${account.handle} ${account.bio}`
        .toLowerCase()
        .includes(term);
    });
  }, [accounts, query, view]);

  const sessionMix = useMemo(
    () => ({
      connected: accounts.filter((account) => account.hasToken).length,
      missing: accounts.filter((account) => !account.hasToken).length,
      alwaysOn: accounts.filter((account) => account.alwaysOn).length,
    }),
    [accounts],
  );

  if (!profileLoading && !isAdmin) {
    return (
      <WorkspaceShell title="Linked Accounts">
        <LockScreen title="Linked Accounts are restricted" />
      </WorkspaceShell>
    );
  }

  const tabs = [
    { value: "all" as const, label: "All", count: counts.all },
    { value: "ready" as const, label: "Ready", count: counts.ready },
    { value: "attention" as const, label: "Needs attention", count: counts.attention },
    { value: "suspended" as const, label: "Suspended", count: counts.suspended },
  ];

  return (
    <WorkspaceShell title="Linked Accounts" wide>
      <PageTitle
        description="Account readiness and provider costs in one place. Use the advanced admin screen only when you need to import, reconnect or edit account sessions."
        actions={
          <div className="flex flex-wrap gap-2">
            <DataFreshness
              at={accounts[0]?.handleSyncedAt ?? accounts[0]?.lastActivityAt}
              label="Accounts"
              staleMinutes={1440}
            />
            <ConnectedAccountsStatus
              total={counts.all}
              ready={counts.ready}
              attention={counts.attention}
              suspended={counts.suspended}
              isRefreshing={accountsQuery.isFetching}
              lastSyncedAt={accounts[0]?.handleSyncedAt ?? accounts[0]?.lastActivityAt}
              onRefresh={() => accountsQuery.refetch()}
            />
            <Button asChild variant="outline" size="sm">
              <Link to="/account-health">
                <ShieldCheck className="size-4" /> Account health
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/admin/accounts">
                <Settings2 className="size-4" /> Manage connections
              </Link>
            </Button>
          </div>
        }
      >
        Linked Accounts
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total accounts" value={counts.all} icon={UsersRound} />
        <StatCard
          label="Ready now"
          value={counts.ready}
          icon={CheckCircle2}
          tone={counts.ready ? "positive" : "neutral"}
        />
        <StatCard
          label="Needs attention"
          value={counts.attention}
          icon={AlertTriangle}
          tone={counts.attention ? "negative" : "neutral"}
        />
        <StatCard
          label="Suspended"
          value={counts.suspended}
          icon={Activity}
          tone={counts.suspended ? "negative" : "neutral"}
        />
      </div>

      <div className="mt-5">
        <CommandGrid
          left={
            <>
              <RailCard title="Account health" icon={ShieldCheck}>
                <RailStatList>
                  <RailStat
                    label="Ready"
                    value={counts.ready}
                    tone={counts.ready ? "positive" : "default"}
                  />
                  <RailStat
                    label="Needs attention"
                    value={counts.attention}
                    tone={counts.attention ? "negative" : "default"}
                  />
                  <RailStat
                    label="Suspended"
                    value={counts.suspended}
                    tone={counts.suspended ? "negative" : "default"}
                  />
                </RailStatList>
              </RailCard>

              <RailCard title="Session mix" icon={KeyRound}>
                <RailBar
                  label="Session connected"
                  value={sessionMix.connected}
                  total={accounts.length}
                />
                <RailBar
                  label="Session missing"
                  value={sessionMix.missing}
                  total={accounts.length}
                />
                <RailBar
                  label="Always-on planning"
                  value={sessionMix.alwaysOn}
                  total={accounts.length}
                />
              </RailCard>

              <RailCard title="Filter" icon={Search}>
                <PageTabs
                  items={tabs}
                  value={view}
                  onChange={setView}
                  ariaLabel="Linked account status"
                />
                <div className="relative mt-3 w-full">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search account or persona…"
                    className="h-10 bg-background pl-9"
                  />
                </div>
                <p className="mt-2 type-meta text-muted-foreground">
                  Showing {visible.length} of {accounts.length}
                </p>
              </RailCard>
            </>
          }
          right={
            <>
              <RailCard title="Actions" icon={Plug}>
                <div className="grid gap-2">
                  <RailAction
                    to="/admin/accounts"
                    icon={Plug}
                    title="Connect / import account"
                    description="Add a new authorised X account."
                  />
                  <RailAction
                    to="/admin/accounts"
                    icon={KeyRound}
                    title="Re-login sweep"
                    description={`${counts.attention} account${counts.attention === 1 ? "" : "s"} need reconnection.`}
                  />
                  <RailAction
                    to="/account-health"
                    icon={ShieldCheck}
                    title="Account health"
                    description="Deep-dive on readiness and risk."
                  />
                  <RailAction
                    to="/campaign-manager"
                    icon={LineChart}
                    title="Campaign manager"
                    description="Plan activity for ready accounts."
                  />
                </div>
              </RailCard>

              <Card className="border-primary/20 bg-primary/[0.025]">
                <p className="type-body font-semibold">How to read the cost numbers</p>
                <p className="mt-1 type-meta text-muted-foreground">
                  The remaining-action figures answer “how many calls could the current provider
                  balance fund if it were spent only on this action type?” They are not campaign
                  quotas. Actual campaign execution is still constrained by account readiness,
                  review, compliance guardrails and message distinctness.
                </p>
              </Card>
            </>
          }
        >
          <AccountCostSummary
            credits={usageQuery.data?.credits.credits ?? null}
            loading={usageQuery.isLoading}
            configured={usageQuery.data?.credits.configured ?? false}
          />

          {accountsQuery.isLoading ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : accountsQuery.isError ? (
            <EmptyState
              title="Linked accounts could not be loaded"
              description="Open System Health or the advanced account manager to review the connection."
            />
          ) : !visible.length ? (
            <EmptyState
              title={accounts.length ? "No accounts match this view" : "No accounts are linked"}
              description={
                accounts.length
                  ? "Choose another status or clear the search."
                  : "Use Manage connections to add the first authorised account."
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ul className="divide-y divide-border">
                {visible.map((account) => (
                  <li
                    key={account.id}
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {account.avatarUrl ? (
                        <img
                          src={account.avatarUrl}
                          alt=""
                          className="size-10 shrink-0 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted type-meta font-semibold text-muted-foreground">
                          {account.handle.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate type-body font-semibold">
                            {account.displayName || account.personaLabel || account.handle}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stateClass(account)}`}
                          >
                            {stateLabel(account)}
                          </span>
                        </div>
                        <p className="truncate type-meta text-muted-foreground">
                          @{account.handle}
                        </p>
                        <p className="mt-1 type-meta text-muted-foreground">
                          {relativeTime(account.lastActivityAt)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                      <div className="rounded-lg bg-muted/50 px-3 py-2 text-right">
                        <p className="text-[11px] text-muted-foreground">Session</p>
                        <p className="type-meta font-semibold">
                          {account.hasToken ? "Connected" : "Missing"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/50 px-3 py-2 text-right">
                        <p className="text-[11px] text-muted-foreground">Planning</p>
                        <p className="type-meta font-semibold">
                          {account.alwaysOn ? "Enabled" : "Off"}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CommandGrid>
      </div>
    </WorkspaceShell>
  );
}
