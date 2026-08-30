import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  BellOff,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, EmptyState, PageTitle } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import {
  deleteMonitoringWatch,
  listMonitoringWatchlist,
  saveMonitoringWatch,
  type WatchlistItem,
} from "@/lib/platform-control.functions";
import { friendlyError } from "@/lib/friendly-errors";
import {
  CommandGrid,
  RailAction,
  RailBar,
  RailCard,
  RailStat,
  RailStatList,
} from "@/components/command-layout";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({
    meta: [
      { title: "Monitoring Watchlist - FKF CommsIQ" },
      {
        name: "description",
        content:
          "Prioritise journalists, publications, officials, organisations, accounts and keywords for monitoring without triggering campaign actions.",
      },
    ],
  }),
  component: WatchlistPage,
});

type Draft = {
  id?: string;
  kind: WatchlistItem["kind"];
  label: string;
  value: string;
  platform: string;
  priority: WatchlistItem["priority"];
  notes: string;
  alertEnabled: boolean;
  isActive: boolean;
};

const EMPTY: Draft = {
  kind: "account",
  label: "",
  value: "",
  platform: "x",
  priority: "standard",
  notes: "",
  alertEnabled: true,
  isActive: true,
};

function WatchlistPage() {
  const { data: profile } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  const queryClient = useQueryClient();
  const list = useServerFn(listMonitoringWatchlist);
  const save = useServerFn(saveMonitoringWatch);
  const remove = useServerFn(deleteMonitoringWatch);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const watchlist = useQuery({
    queryKey: ["monitoring-watchlist"],
    queryFn: () => list(),
  });

  const saveMutation = useMutation({
    mutationFn: (value: Draft) =>
      save({ data: { ...value, platform: value.platform.trim() || null } }),
    onSuccess: async () => {
      setDraft(null);
      toast.success("Saved.");
      await queryClient.invalidateQueries({ queryKey: ["monitoring-watchlist"] });
    },
    onError: (error: Error) =>
      toast.error(
        friendlyError(error, {
          action: "save this item",
          preserved: "Your entry is still in the form.",
        }),
      ),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: async () => {
      toast.success("Removed.");
      await queryClient.invalidateQueries({ queryKey: ["monitoring-watchlist"] });
    },
    onError: (error: Error) => toast.error(friendlyError(error, { action: "remove that item" })),
  });

  const items = useMemo(() => watchlist.data ?? [], [watchlist.data]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      `${item.label} ${item.value} ${item.kind} ${item.platform ?? ""} ${item.notes}`
        .toLowerCase()
        .includes(term),
    );
  }, [items, query]);

  const critical = items.filter((item) => item.priority === "critical" && item.isActive).length;
  const high = items.filter((item) => item.priority === "high" && item.isActive).length;
  const alerts = items.filter((item) => item.alertEnabled && item.isActive).length;
  const paused = items.filter((item) => !item.isActive).length;

  const kindCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item.kind, (map.get(item.kind) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const priorityCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item.priority, (map.get(item.priority) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  function edit(item: WatchlistItem) {
    setDraft({
      id: item.id,
      kind: item.kind,
      label: item.label,
      value: item.value,
      platform: item.platform ?? "",
      priority: item.priority,
      notes: item.notes,
      alertEnabled: item.alertEnabled,
      isActive: item.isActive,
    });
  }

  function exportCsv() {
    const header = [
      "label",
      "kind",
      "value",
      "platform",
      "priority",
      "alertEnabled",
      "isActive",
      "notes",
    ];
    const rows = items.map((item) => [
      item.label,
      item.kind,
      item.value,
      item.platform ?? "",
      item.priority,
      item.alertEnabled ? "yes" : "no",
      item.isActive ? "yes" : "no",
      item.notes,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "monitoring-watchlist.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <WorkspaceShell title="Monitoring Watchlist" wide>
      <PageTitle description="Prioritise who and what matters to the intelligence team. Monitoring never triggers campaign actions.">
        Monitoring Watchlist
      </PageTitle>

      <Card className="mb-5 border-border bg-muted/30">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="type-body font-semibold">
              Monitoring and campaign execution are separate
            </p>
            <p className="mt-1 type-meta text-muted-foreground">
              Adding an account, journalist, publication or keyword here only changes monitoring
              priority. Any campaign action must still be created explicitly through a reviewed
              campaign workflow.
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="card-surface min-w-0 p-4">
          <p className="type-meta text-muted-foreground">Watchlist items</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{items.length}</p>
        </div>
        <div className="card-surface min-w-0 p-4">
          <p className="type-meta text-muted-foreground">Critical priority</p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${critical ? "text-negative" : ""}`}
          >
            {critical}
          </p>
        </div>
        <div className="card-surface min-w-0 p-4">
          <p className="type-meta text-muted-foreground">Alert-enabled</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{alerts}</p>
        </div>
        <div className="card-surface min-w-0 p-4">
          <p className="type-meta text-muted-foreground">Paused</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{paused}</p>
        </div>
      </div>

      <CommandGrid
        left={
          <>
            <RailCard title="Search" icon={Search}>
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search watchlist…"
                  className="h-9 rounded-xl bg-background pl-9"
                />
              </div>
            </RailCard>

            <RailCard title="By type" icon={Filter}>
              {kindCounts.length ? (
                <RailStatList>
                  {kindCounts.map(([kind, count]) => (
                    <RailStat
                      key={kind}
                      label={<span className="capitalize">{kind}</span>}
                      value={count}
                    />
                  ))}
                </RailStatList>
              ) : (
                <p className="type-meta text-muted-foreground">No items yet.</p>
              )}
            </RailCard>

            <RailCard title="Priority mix" icon={Bell}>
              {priorityCounts.length ? (
                <div>
                  {priorityCounts.map(([priority, count]) => (
                    <RailBar
                      key={priority}
                      label={priority}
                      value={count}
                      total={items.length}
                      valueLabel={`${count}`}
                    />
                  ))}
                </div>
              ) : (
                <p className="type-meta text-muted-foreground">No items yet.</p>
              )}
            </RailCard>
          </>
        }
        right={
          <>
            <RailCard title="Actions" icon={Sparkles}>
              <div className="space-y-2">
                {isAdmin ? (
                  <Button
                    size="sm"
                    className="h-9 w-full gap-2 rounded-xl"
                    onClick={() => setDraft({ ...EMPTY })}
                  >
                    <Plus className="size-3.5" /> Add priority
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 w-full gap-2 rounded-xl"
                  onClick={() => watchlist.refetch()}
                  disabled={watchlist.isFetching}
                >
                  <RefreshCw className={`size-3.5 ${watchlist.isFetching ? "animate-spin" : ""}`} />{" "}
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 w-full gap-2 rounded-xl"
                  onClick={exportCsv}
                  disabled={items.length === 0}
                >
                  Export CSV
                </Button>
              </div>
            </RailCard>

            <RailCard title="Shortcuts" icon={Eye}>
              <div className="space-y-2">
                <RailAction
                  to="/mentions"
                  icon={Eye}
                  title="Open Mentions"
                  description="Investigate live coverage"
                />
              </div>
            </RailCard>
          </>
        }
      >
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          {watchlist.isError ? (
            <EmptyState
              title="Watchlist could not be loaded"
              description={friendlyError(watchlist.error, { action: "load the watchlist" })}
              action={
                <Button variant="outline" size="sm" onClick={() => void watchlist.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : watchlist.isLoading ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              title={items.length ? "No results for this search" : "No monitoring priorities yet"}
              description={
                isAdmin
                  ? "Add an account, publication, person, organisation, or keyword to focus monitoring without triggering campaign actions."
                  : "An administrator can add monitoring priorities here."
              }
              action={
                isAdmin ? (
                  <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
                    <Plus className="size-4" /> Add priority
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="divide-y divide-border">
                {visible.map((item) => (
                  <div
                    key={item.id}
                    className="grid min-w-0 gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="type-card min-w-0 truncate font-semibold">{item.label}</p>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">
                          {item.kind}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${item.priority === "critical" ? "bg-destructive/10 text-destructive" : item.priority === "high" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}
                        >
                          {item.priority}
                        </span>
                        {!item.isActive ? (
                          <span className="type-meta text-muted-foreground">Paused</span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate type-meta text-muted-foreground">
                        {item.platform ? `${item.platform.toUpperCase()} · ` : ""}
                        {item.value}
                      </p>
                      {item.notes ? (
                        <p className="mt-1 line-clamp-2 type-meta text-muted-foreground">
                          {item.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/60">
                        {item.alertEnabled ? (
                          <Bell className="size-4 text-primary" aria-label="Alerts enabled" />
                        ) : (
                          <BellOff
                            className="size-4 text-muted-foreground"
                            aria-label="Alerts disabled"
                          />
                        )}
                      </span>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/mentions" search={{ topic: item.value }}>
                          Investigate
                        </Link>
                      </Button>
                      {isAdmin ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => edit(item)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9"
                            aria-label={`Remove ${item.label}`}
                            onClick={() => deleteMutation.mutate(item.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CommandGrid>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Edit watchlist item" : "Add monitoring priority"}
            </DialogTitle>
            <DialogDescription>
              This changes monitoring priority only. It does not create a campaign.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="watchlist-kind">Type</Label>
                <select
                  id="watchlist-kind"
                  value={draft.kind}
                  onChange={(event) =>
                    setDraft({ ...draft, kind: event.target.value as Draft["kind"] })
                  }
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {(
                    [
                      "account",
                      "publication",
                      "journalist",
                      "official",
                      "influencer",
                      "competitor",
                      "organisation",
                      "keyword",
                    ] as const
                  ).map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="watchlist-priority">Priority</Label>
                <select
                  id="watchlist-priority"
                  value={draft.priority}
                  onChange={(event) =>
                    setDraft({ ...draft, priority: event.target.value as Draft["priority"] })
                  }
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="standard">Standard</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="watchlist-label">Display name</Label>
                <Input
                  id="watchlist-label"
                  value={draft.label}
                  onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                  placeholder="e.g. Sports Desk Kenya"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="watchlist-value">Handle, keyword or identifier</Label>
                <Input
                  id="watchlist-value"
                  value={draft.value}
                  onChange={(event) => setDraft({ ...draft, value: event.target.value })}
                  placeholder="e.g. @example or referee appointments"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="watchlist-platform">Platform</Label>
                <Input
                  id="watchlist-platform"
                  value={draft.platform}
                  onChange={(event) => setDraft({ ...draft, platform: event.target.value })}
                  placeholder="x, news, youtube…"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="watchlist-notes">Notes</Label>
                <Input
                  id="watchlist-notes"
                  value={draft.notes}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  placeholder="Why this source matters"
                />
              </div>
              <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 type-meta">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={draft.alertEnabled}
                  onChange={(event) => setDraft({ ...draft, alertEnabled: event.target.checked })}
                />{" "}
                Alert-enabled
              </label>
              <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 type-meta">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={draft.isActive}
                  onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
                />{" "}
                Active
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => draft && saveMutation.mutate(draft)}
              disabled={!draft?.label.trim() || !draft?.value.trim() || saveMutation.isPending}
            >
              Save watch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
