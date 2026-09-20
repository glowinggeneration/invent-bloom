import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Gauge,
  ListPlus,
  Megaphone,
  Search,
  Settings2,
  SquarePen,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, EmptyState, PageTitle } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataFreshness } from "@/components/data-freshness";
import { useNotifications } from "@/hooks/use-notifications";
import { useProfile } from "@/hooks/use-profile";
import { listDecisionLog, type DecisionLogItem } from "@/lib/platform-control.functions";
import { listManagedCampaigns } from "@/lib/campaign-manager.functions";
import { listManagedReports } from "@/lib/managed-reports.functions";
import { STATUS_LABELS } from "@/lib/campaign-manager";
import {
  addPriority,
  completePriority,
  deferPriority,
  deletePriority,
  listCompletedPrioritiesToday,
  listPriorities,
  reactivatePriority,
  reorderPriorities,
  type TodayPriority,
} from "@/lib/today-priorities.functions";
import {
  DEFAULT_PRIORITY_LIMIT,
  MAX_PRIORITY_LIMIT,
  MIN_PRIORITY_LIMIT,
  readPriorityLimit,
  savePriorityLimit,
} from "@/lib/today-priorities";
import { friendlyError } from "@/lib/friendly-errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today - SMAIT" },
      {
        name: "description",
        content:
          "A short, chosen list of what matters right now - urgent alerts stay visible regardless, the rest of the backlog stays a click away.",
      },
    ],
  }),
  component: TodayPage,
});

const OPEN_STATUSES = new Set<DecisionLogItem["status"]>(["open", "in_progress"]);

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

function decisionStatusTone(status: DecisionLogItem["status"]) {
  if (status === "open") return "border-destructive/30 bg-destructive/5 text-destructive";
  if (status === "in_progress")
    return "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300";
  return "border-border bg-muted text-muted-foreground";
}

type CompletedEntry = {
  key: string;
  kind: "Priority completed" | "Decision resolved" | "Campaign completed" | "Report published";
  title: string;
  at: string;
  href: string;
};

function TodayPage() {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const scope = profile?.id ?? "default";

  const notifications = useNotifications();
  const urgentAlerts = notifications.items
    .filter((n) => n.severity === "critical" && !n.read)
    .slice(0, 5);

  // --- Priorities -----------------------------------------------------
  const [limit, setLimit] = useState(DEFAULT_PRIORITY_LIMIT);
  useEffect(() => setLimit(readPriorityLimit(scope)), [scope]);
  const [limitOpen, setLimitOpen] = useState(false);

  const fetchPriorities = useServerFn(listPriorities);
  const prioritiesQuery = useQuery({
    queryKey: ["today-priorities"],
    queryFn: () => fetchPriorities(),
    staleTime: 30_000,
  });
  const active = (prioritiesQuery.data ?? []).filter((p) => p.status === "active");
  const deferred = (prioritiesQuery.data ?? []).filter((p) => p.status === "deferred");
  const shown = active.slice(0, limit);
  const overflow = active.slice(limit);

  const invalidatePriorities = () =>
    queryClient.invalidateQueries({ queryKey: ["today-priorities"] });

  const reorder = useServerFn(reorderPriorities);
  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { ids } }),
    onSuccess: invalidatePriorities,
    onError: (error) => toast.error(friendlyError(error)),
  });

  function move(id: string, direction: -1 | 1) {
    const ids = active.map((p) => p.id);
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
    reorderMutation.mutate(ids);
  }

  const complete = useServerFn(completePriority);
  const completeMutation = useMutation({
    mutationFn: (id: string) => complete({ data: { id } }),
    onSuccess: () => {
      invalidatePriorities();
      queryClient.invalidateQueries({ queryKey: ["today-completed-priorities"] });
      toast.success("Marked complete");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const remove = useServerFn(deletePriority);
  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidatePriorities,
    onError: (error) => toast.error(friendlyError(error)),
  });

  const defer = useServerFn(deferPriority);
  const deferMutation = useMutation({
    mutationFn: (vars: { id: string; deferUntil?: string | undefined; reason: string }) =>
      defer({ data: vars }),
    onSuccess: () => {
      invalidatePriorities();
      toast.success("Deferred");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const reactivate = useServerFn(reactivatePriority);
  const reactivateMutation = useMutation({
    mutationFn: (id: string) => reactivate({ data: { id } }),
    onSuccess: invalidatePriorities,
    onError: (error) => toast.error(friendlyError(error)),
  });

  const [addOpen, setAddOpen] = useState(false);
  const addToPriorities = useAddPriorityMutation(invalidatePriorities);

  // --- Completed today (real, persisted events) ------------------------
  const fetchCompletedPriorities = useServerFn(listCompletedPrioritiesToday);
  const completedPrioritiesQuery = useQuery({
    queryKey: ["today-completed-priorities"],
    queryFn: () => fetchCompletedPriorities(),
    staleTime: 30_000,
  });

  const fetchDecisions = useServerFn(listDecisionLog);
  const decisionsQuery = useQuery({
    queryKey: ["decision-log"],
    queryFn: () => fetchDecisions(),
    staleTime: 60_000,
  });

  const fetchCampaigns = useServerFn(listManagedCampaigns);
  const campaignsQuery = useQuery({
    queryKey: ["managed-campaigns"],
    queryFn: () => fetchCampaigns(),
    staleTime: 60_000,
  });

  const fetchReports = useServerFn(listManagedReports);
  const reportsQuery = useQuery({
    queryKey: ["managed-reports", "today"],
    queryFn: () => fetchReports(),
    staleTime: 60_000,
  });

  const needsAttention = useMemo(
    () => (decisionsQuery.data ?? []).filter((d) => OPEN_STATUSES.has(d.status)).slice(0, 5),
    [decisionsQuery.data],
  );
  const latestDecisionAt = decisionsQuery.data?.[0]?.updatedAt ?? null;

  const recentCampaigns = useMemo(
    () =>
      [...(campaignsQuery.data ?? [])]
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 5),
    [campaignsQuery.data],
  );
  const latestCampaignAt = recentCampaigns[0]?.startedAt ?? null;

  const completedToday = useMemo((): CompletedEntry[] => {
    const entries: CompletedEntry[] = [];
    for (const p of completedPrioritiesQuery.data ?? []) {
      if (p.completedAt) {
        entries.push({
          key: `priority-${p.id}`,
          kind: "Priority completed",
          title: p.title,
          at: p.completedAt,
          href: p.href,
        });
      }
    }
    for (const d of decisionsQuery.data ?? []) {
      if (d.status === "completed" && isToday(d.updatedAt)) {
        entries.push({
          key: `decision-${d.id}`,
          kind: "Decision resolved",
          title: d.insight,
          at: d.updatedAt,
          href: "/decisions",
        });
      }
    }
    for (const c of campaignsQuery.data ?? []) {
      if (c.status === "completed" && isToday(c.completedAt)) {
        entries.push({
          key: `campaign-${c.key}`,
          kind: "Campaign completed",
          title: c.name,
          at: c.completedAt ?? c.startedAt,
          href: `/campaign-proof?campaign=${encodeURIComponent(c.key)}`,
        });
      }
    }
    for (const r of reportsQuery.data?.reports ?? []) {
      // uploadedAt is the closest real persisted timestamp to "delivered" -
      // there's no dedicated delivery event yet (recorded in the exception
      // register), so a published report today is used as that proxy.
      if (r.status === "published" && isToday(r.uploadedAt)) {
        entries.push({
          key: `report-${r.id}`,
          kind: "Report published",
          title: r.title,
          at: r.uploadedAt,
          href: "/reports/library",
        });
      }
    }
    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [completedPrioritiesQuery.data, decisionsQuery.data, campaignsQuery.data, reportsQuery.data]);

  return (
    <WorkspaceShell title="Today">
      <PageTitle description="A short, chosen list of what matters right now. Urgent alerts stay visible regardless - everything else lives in the backlog, one click away.">
        Today
      </PageTitle>

      {urgentAlerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 p-4 sm:p-5" role="alert">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
            <h2 className="type-card font-semibold text-destructive">Urgent</h2>
            <span className="type-meta text-muted-foreground">
              — always shown, regardless of your priority list
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {urgentAlerts.map((alert) => (
              <li key={alert.id}>
                <Link
                  to={alert.href}
                  onClick={() => notifications.markRead([alert.id])}
                  className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-background/60 p-3 transition-colors hover:bg-background"
                >
                  <Megaphone
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{alert.title}</span>
                    <span className="block type-meta text-muted-foreground">{alert.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListPlus className="size-4 text-primary" aria-hidden="true" />
            <h2 className="type-card font-semibold">Today's priorities</h2>
            <span className="type-meta text-muted-foreground">
              {shown.length} of {limit}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Popover open={limitOpen} onOpenChange={setLimitOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                  <Settings2 className="size-3.5" aria-hidden="true" />
                  Limit
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <Label htmlFor="priority-limit" className="type-meta">
                  Priorities shown at once
                </Label>
                <Input
                  id="priority-limit"
                  type="number"
                  min={MIN_PRIORITY_LIMIT}
                  max={MAX_PRIORITY_LIMIT}
                  value={limit}
                  onChange={(e) => {
                    const next = Number(e.target.value) || DEFAULT_PRIORITY_LIMIT;
                    setLimit(next);
                    savePriorityLimit(next, scope);
                  }}
                  className="mt-2"
                />
                <p className="mt-2 type-meta text-muted-foreground">
                  This only changes how many you see at once here - it never deletes anything.
                </p>
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setAddOpen(true)}
            >
              <ListPlus className="size-3.5" aria-hidden="true" />
              Add priority
            </Button>
          </div>
        </div>

        <div className="mt-4">
          {prioritiesQuery.isLoading ? (
            <div className="space-y-2" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <EmptyState
              title="No priorities chosen yet"
              description="Pick a few things from the backlog below, or add a custom one - three is a reasonable start."
              action={
                <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                  Add priority
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {shown.map((priority, index) => (
                <PriorityRow
                  key={priority.id}
                  priority={priority}
                  isLead={index === 0}
                  canMoveUp={index > 0}
                  canMoveDown={index < shown.length - 1}
                  onMoveUp={() => move(priority.id, -1)}
                  onMoveDown={() => move(priority.id, 1)}
                  onComplete={() => completeMutation.mutate(priority.id)}
                  onRemove={() => removeMutation.mutate(priority.id)}
                  onDefer={(reason, deferUntil) =>
                    deferMutation.mutate({ id: priority.id, reason, deferUntil })
                  }
                />
              ))}
            </ul>
          )}

          {overflow.length > 0 && (
            <p className="mt-3 type-meta text-muted-foreground">
              {overflow.length} more chosen but not shown - raise the limit above, or complete one
              of the ones showing to bring the next one up.
            </p>
          )}

          {deferred.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="type-meta font-medium text-muted-foreground">
                Deferred ({deferred.length})
              </p>
              <ul className="mt-2 space-y-2">
                {deferred.map((priority) => (
                  <li
                    key={priority.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border p-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{priority.title}</span>
                      <span className="block type-meta text-muted-foreground">
                        {priority.deferReason || "No reason given"}
                        {priority.deferUntil ? ` · Until ${priority.deferUntil}` : ""}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => reactivateMutation.mutate(priority.id)}
                    >
                      Reactivate
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {completedToday.length > 0 && (
        <Card className="mt-6 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
            <h2 className="type-card font-semibold">Completed today</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {completedToday.map((entry) => (
              <li key={entry.key}>
                <Link
                  to={entry.href}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{entry.title}</span>
                    <span className="block type-meta text-muted-foreground">
                      {new Date(entry.at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  <Badge variant="secondary">{entry.kind}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-6 p-5 sm:p-6">
        <Label htmlFor="today-objective">What are you working on?</Label>
        <Textarea
          id="today-objective"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste a topic, a draft message, or a link to what's happening…"
          className="mt-2 min-h-24 resize-none"
        />

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button
            asChild
            variant="outline"
            className={cn(
              "h-auto justify-start gap-3 py-3",
              !trimmed && "pointer-events-none opacity-50",
            )}
          >
            <Link
              to="/mentions"
              search={trimmed ? { topic: trimmed } : {}}
              aria-disabled={!trimmed}
              tabIndex={trimmed ? undefined : -1}
              onClick={(event) => {
                if (!trimmed) event.preventDefault();
              }}
              className="flex w-full items-center gap-3"
            >
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-left">
                <span className="block font-semibold">Investigate</span>
                <span className="block type-meta text-muted-foreground">
                  Open this topic in Mentions
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className={cn(
              "h-auto justify-start gap-3 py-3",
              !trimmed && "pointer-events-none opacity-50",
            )}
          >
            <Link
              to="/new"
              search={trimmed ? { text: trimmed } : {}}
              aria-disabled={!trimmed}
              tabIndex={trimmed ? undefined : -1}
              onClick={(event) => {
                if (!trimmed) event.preventDefault();
              }}
              className="flex w-full items-center gap-3"
            >
              <SquarePen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-left">
                <span className="block font-semibold">Test a message</span>
                <span className="block type-meta text-muted-foreground">
                  Send it to Response Studio
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-auto justify-start gap-3 py-3">
            <Link
              to="/publish"
              search={{ choose: true, ...(trimmed ? { text: trimmed } : {}) }}
              className="flex w-full items-center gap-3"
            >
              <Gauge className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-left">
                <span className="block font-semibold">Create campaign</span>
                <span className="block type-meta text-muted-foreground">
                  Choose Post, Reply or Boost
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <p className="type-meta text-muted-foreground">
            Each option takes you to that workspace with this text carried over — nothing runs or
            publishes automatically until you act there.
          </p>
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Link to="/reports/builder">
              <FileText className="size-3.5" aria-hidden="true" />
              Generate a report
            </Link>
          </Button>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
              <h2 className="type-card font-semibold">Backlog: needs a decision</h2>
            </div>
            {latestDecisionAt ? (
              <DataFreshness at={latestDecisionAt} label="Decision log" staleMinutes={24 * 60} />
            ) : null}
          </div>

          <div className="mt-4">
            {decisionsQuery.isLoading ? (
              <div className="space-y-2" aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : needsAttention.length === 0 ? (
              <EmptyState
                title="Nothing needs a decision right now"
                description="Open items from the Decision Log will show up here."
              />
            ) : (
              <ul className="space-y-2">
                {needsAttention.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border p-3"
                  >
                    <Link to="/decisions" className="min-w-0 flex-1 hover:underline">
                      <span className="block truncate font-medium">{item.insight}</span>
                      <span className="block truncate type-meta text-muted-foreground">
                        {item.owner || "Unassigned"}
                      </span>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className={decisionStatusTone(item.status)}>
                        {item.status === "in_progress" ? "In progress" : "Open"}
                      </Badge>
                      <AddDecisionToPriorities
                        decision={item}
                        onAdd={(vars) => addToPriorities.mutate(vars)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {needsAttention.length > 0 ? (
            <Link
              to="/decisions"
              className="mt-3 inline-block type-meta font-semibold text-primary hover:underline"
            >
              View full decision log
            </Link>
          ) : null}
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-primary" aria-hidden="true" />
              <h2 className="type-card font-semibold">Backlog: recent work</h2>
            </div>
            {latestCampaignAt ? (
              <DataFreshness at={latestCampaignAt} label="Campaigns" staleMinutes={24 * 60} />
            ) : null}
          </div>

          <div className="mt-4">
            {campaignsQuery.isLoading ? (
              <div className="space-y-2" aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : recentCampaigns.length === 0 ? (
              <EmptyState
                title="No campaigns yet"
                description="Campaigns you create will show up here."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/publish" search={{ choose: true }}>
                      Create campaign
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {recentCampaigns.map((campaign) => (
                  <li key={campaign.key}>
                    <Link
                      to="/campaign-proof"
                      search={{ campaign: campaign.key }}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{campaign.name}</span>
                        <span className="block truncate type-meta text-muted-foreground">
                          {campaign.type}
                        </span>
                      </span>
                      <Badge variant="secondary">{STATUS_LABELS[campaign.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {recentCampaigns.length > 0 ? (
            <Link
              to="/campaign-manager"
              className="mt-3 inline-block type-meta font-semibold text-primary hover:underline"
            >
              View all campaigns
            </Link>
          ) : null}
        </Card>
      </div>

      <AddPriorityDialog open={addOpen} onOpenChange={setAddOpen} onAdded={invalidatePriorities} />
    </WorkspaceShell>
  );
}

function useAddPriorityMutation(onAdded: () => void) {
  const add = useServerFn(addPriority);
  return useMutation({
    mutationFn: (vars: {
      itemType: "decision" | "investigation" | "campaign" | "report" | "custom";
      itemId?: string;
      title: string;
      note?: string;
      href: string;
    }) => add({ data: vars }),
    onSuccess: () => {
      onAdded();
      toast.success("Added to today's priorities");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });
}

function PriorityRow({
  priority,
  isLead,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onComplete,
  onRemove,
  onDefer,
}: {
  priority: TodayPriority;
  isLead: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onComplete: () => void;
  onRemove: () => void;
  onDefer: (reason: string, deferUntil?: string) => void;
}) {
  const [deferOpen, setDeferOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [deferUntil, setDeferUntil] = useState("");

  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-xl border p-3",
        isLead
          ? "border-primary/30 bg-primary/5 shadow-[0_0_24px_-8px] shadow-primary/30"
          : "border-border",
      )}
    >
      <div className="flex flex-col gap-0.5 pt-0.5">
        <button
          type="button"
          aria-label="Move up"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowUp className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Move down"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowDown className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <Link to={priority.href} className="min-w-0 flex-1 hover:underline">
        <span className="flex items-center gap-2">
          <span className="block truncate font-medium">{priority.title}</span>
          {isLead ? (
            <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary">
              Focus
            </Badge>
          ) : null}
        </span>
        {priority.note ? (
          <span className="block truncate type-meta text-muted-foreground">{priority.note}</span>
        ) : null}
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="Mark complete"
          onClick={onComplete}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
        </Button>
        <Popover open={deferOpen} onOpenChange={setDeferOpen}>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" aria-label="Defer">
              <Clock3 className="size-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <Label htmlFor={`defer-reason-${priority.id}`} className="type-meta">
              Why defer? (optional)
            </Label>
            <Input
              id={`defer-reason-${priority.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
              placeholder="Waiting on a reply…"
            />
            <Label htmlFor={`defer-until-${priority.id}`} className="type-meta mt-3 block">
              Until (optional)
            </Label>
            <Input
              id={`defer-until-${priority.id}`}
              type="date"
              value={deferUntil}
              onChange={(e) => setDeferUntil(e.target.value)}
              className="mt-1"
            />
            <Button
              size="sm"
              className="mt-3 w-full"
              onClick={() => {
                onDefer(reason, deferUntil || undefined);
                setDeferOpen(false);
                setReason("");
                setDeferUntil("");
              }}
            >
              Defer
            </Button>
          </PopoverContent>
        </Popover>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-muted-foreground"
          aria-label="Remove from priorities"
          onClick={onRemove}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

function AddDecisionToPriorities({
  decision,
  onAdd,
}: {
  decision: DecisionLogItem;
  onAdd: (vars: { itemType: "decision"; itemId: string; title: string; href: string }) => void;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="gap-1 text-muted-foreground"
      onClick={() =>
        onAdd({
          itemType: "decision",
          itemId: decision.id,
          title: decision.insight,
          href: "/decisions",
        })
      }
    >
      <ListPlus className="size-3.5" aria-hidden="true" />
      Prioritise
    </Button>
  );
}

function AddPriorityDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const mutation = useAddPriorityMutation(onAdded);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a priority</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="priority-title">What is it?</Label>
            <Input
              id="priority-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Reply to the pricing thread"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="priority-note">Why does it matter right now? (optional)</Label>
            <Textarea
              id="priority-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-20"
            />
          </div>
          <p className="type-meta text-muted-foreground">
            Prefer picking straight from the backlog below (each item has a "Prioritise" action) -
            this is for anything not already tracked elsewhere.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { itemType: "custom", title: title.trim(), note: note.trim(), href: "/today" },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    setTitle("");
                    setNote("");
                  },
                },
              )
            }
          >
            {mutation.isPending ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
