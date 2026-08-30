import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  ExternalLink,
  Filter,
  ListChecks,
  Plus,
  TimerReset,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { DataFreshness } from "@/components/data-freshness";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, EmptyState, PageTitle, StatCard } from "@/components/ui-kit";
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
import {
  CommandGrid,
  RailAction,
  RailCard,
  RailStat,
  RailStatList,
} from "@/components/command-layout";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import {
  listDecisionLog,
  saveDecisionLogItem,
  type DecisionLogItem,
} from "@/lib/platform-control.functions";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/decisions")({
  head: () => ({
    meta: [
      { title: "Decision Log - CommsIQ" },
      {
        name: "description",
        content:
          "Record the communication insight, decision, owner, status and result so the organisation can learn from previous actions.",
      },
    ],
  }),
  component: DecisionLogPage,
});

type Draft = {
  id?: string;
  insight: string;
  decision: string;
  owner: string;
  status: DecisionLogItem["status"];
  result: string;
  sourceUrl: string;
  dueAt: string;
};

type DecisionFilter = "all" | DecisionLogItem["status"];

const EMPTY: Draft = {
  insight: "",
  decision: "",
  owner: "",
  status: "open",
  result: "",
  sourceUrl: "",
  dueAt: "",
};

const FILTERS: { value: DecisionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function statusLabel(status: DecisionLogItem["status"]) {
  if (status === "in_progress") return "In progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function DecisionLogPage() {
  const { data: profile } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  const queryClient = useQueryClient();
  const list = useServerFn(listDecisionLog);
  const save = useServerFn(saveDecisionLogItem);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<DecisionFilter>("all");

  const decisions = useQuery({
    queryKey: ["decision-log"],
    queryFn: () => list(),
  });

  const mutation = useMutation({
    mutationFn: (value: Draft) =>
      save({
        data: {
          id: value.id,
          insight: value.insight,
          decision: value.decision,
          owner: value.owner,
          status: value.status,
          result: value.result,
          sourceUrl: value.sourceUrl.trim() || null,
          dueAt: value.dueAt ? new Date(value.dueAt).toISOString() : null,
        },
      }),
    onSuccess: async () => {
      setDraft(null);
      toast.success("Saved.");
      await queryClient.invalidateQueries({ queryKey: ["decision-log"] });
    },
    onError: (error: Error) =>
      toast.error(
        friendlyError(error, {
          action: "save this decision",
          preserved: "Your entry is still in the form.",
        }),
      ),
  });

  const items = useMemo(() => decisions.data ?? [], [decisions.data]);
  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.status === filter)),
    [items, filter],
  );
  const counts = useMemo(() => {
    const result: Record<DecisionFilter, number> = {
      all: items.length,
      open: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const item of items) result[item.status] += 1;
    return result;
  }, [items]);
  const newest = items[0]?.updatedAt ?? null;

  const owners = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = item.owner?.trim() || "Unassigned";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [items]);

  function edit(item: DecisionLogItem) {
    setDraft({
      id: item.id,
      insight: item.insight,
      decision: item.decision,
      owner: item.owner,
      status: item.status,
      result: item.result,
      sourceUrl: item.sourceUrl ?? "",
      dueAt: item.dueAt ? item.dueAt.slice(0, 16) : "",
    });
  }

  return (
    <WorkspaceShell title="Decision Log" wide>
      <PageTitle
        description="Record what was seen, what was decided, who owns it and what happened afterwards."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {decisions.isLoading ? (
              <span className="type-meta text-muted-foreground">Loading decision log…</span>
            ) : (
              <DataFreshness at={newest} label="Decision log" staleMinutes={1440} />
            )}
            {isAdmin ? (
              <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
                <Plus className="size-4" /> Add decision
              </Button>
            ) : null}
          </div>
        }
      >
        Decision Log
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Open decisions"
          value={decisions.isLoading ? "—" : counts.open}
          icon={CircleDot}
        />
        <StatCard
          label="In progress"
          value={decisions.isLoading ? "—" : counts.in_progress}
          icon={TimerReset}
        />
        <StatCard
          label="Completed"
          value={decisions.isLoading ? "—" : counts.completed}
          icon={CheckCircle2}
          tone={counts.completed ? "positive" : "neutral"}
        />
      </div>

      <CommandGrid
        left={
          <>
            <RailCard title="Status filter" icon={Filter}>
              <div className="flex flex-col gap-1.5">
                {FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={`flex min-w-0 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                      filter === option.value
                        ? "bg-primary/10 font-semibold text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    <span className="type-meta shrink-0 tabular-nums text-muted-foreground">
                      {counts[option.value]}
                    </span>
                  </button>
                ))}
              </div>
            </RailCard>

            <RailCard title="Status counts" icon={ListChecks}>
              <RailStatList>
                <RailStat label="Open" value={counts.open} />
                <RailStat label="In progress" value={counts.in_progress} />
                <RailStat label="Completed" value={counts.completed} tone="positive" />
                <RailStat label="Cancelled" value={counts.cancelled} tone="neutral" />
              </RailStatList>
            </RailCard>

            <RailCard title="Owners" icon={Users}>
              {owners.length === 0 ? (
                <p className="type-meta text-muted-foreground">No decisions recorded yet.</p>
              ) : (
                <RailStatList>
                  {owners.map(([owner, count]) => (
                    <RailStat key={owner} label={owner} value={count} />
                  ))}
                </RailStatList>
              )}
            </RailCard>
          </>
        }
        right={
          <>
            {isAdmin ? (
              <RailCard title="Actions" icon={Plus}>
                <div className="grid gap-2">
                  <RailAction
                    onClick={() => setDraft({ ...EMPTY })}
                    icon={Plus}
                    title="Record decision"
                    description="Log a new insight and decision"
                  />
                </div>
              </RailCard>
            ) : null}
            <RailCard title="Guidance" icon={ClipboardCheck}>
              <p className="type-meta text-muted-foreground">
                Keep each entry factual: the insight observed, the decision made, the owner
                responsible and the eventual result so outcomes can be evaluated later.
              </p>
            </RailCard>
            <RailCard title="Outcomes" icon={XCircle}>
              <RailStatList>
                <RailStat label="Cancelled" value={counts.cancelled} tone="neutral" />
                <RailStat
                  label="Completion rate"
                  value={
                    items.length ? `${Math.round((counts.completed / items.length) * 100)}%` : "0%"
                  }
                  tone="positive"
                />
              </RailStatList>
            </RailCard>
          </>
        }
      >
        {decisions.isError ? (
          <EmptyState
            title="Decision Log could not be loaded"
            description={friendlyError(decisions.error, { action: "load the decision log" })}
            action={
              <Button variant="outline" size="sm" onClick={() => void decisions.refetch()}>
                Try again
              </Button>
            }
          />
        ) : decisions.isLoading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-32 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              items.length
                ? "No decisions match this filter. Try a different status."
                : "Nothing here yet."
            }
            description="Decisions will appear here once your team logs them after intelligence reviews."
          />
        ) : (
          <div className="space-y-3">
            {visible.map((item) => (
              <Card key={item.id} className="min-w-0">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.status === "completed" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : item.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                      {item.owner ? (
                        <span className="type-meta truncate text-muted-foreground">
                          Owner: {item.owner}
                        </span>
                      ) : null}
                      {item.dueAt ? (
                        <span className="type-meta truncate text-muted-foreground">
                          Due {new Date(item.dueAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 type-meta font-semibold uppercase tracking-wide text-muted-foreground">
                      Insight
                    </p>
                    <p className="mt-1 type-body">{item.insight}</p>
                    <p className="mt-3 type-meta font-semibold uppercase tracking-wide text-muted-foreground">
                      Decision
                    </p>
                    <p className="mt-1 type-body">{item.decision}</p>
                    {item.result ? (
                      <>
                        <p className="mt-3 type-meta font-semibold uppercase tracking-wide text-muted-foreground">
                          Result
                        </p>
                        <p className="mt-1 type-body text-muted-foreground">{item.result}</p>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {item.sourceUrl ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" /> Source
                        </a>
                      </Button>
                    ) : null}
                    {isAdmin ? (
                      <Button variant="outline" size="sm" onClick={() => edit(item)}>
                        Update
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CommandGrid>

      <Dialog open={Boolean(draft)} onOpenChange={(next) => !next && setDraft(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Update decision" : "Record a decision"}</DialogTitle>
            <DialogDescription>
              Keep the entry factual and concise so the result can be evaluated later.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="decision-insight">Insight</Label>
                <textarea
                  id="decision-insight"
                  value={draft.insight}
                  onChange={(event) => setDraft({ ...draft, insight: event.target.value })}
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="What did the intelligence show?"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="decision-decision">Decision</Label>
                <textarea
                  id="decision-decision"
                  value={draft.decision}
                  onChange={(event) => setDraft({ ...draft, decision: event.target.value })}
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="What was decided?"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="decision-owner">Owner</Label>
                <Input
                  id="decision-owner"
                  value={draft.owner}
                  onChange={(event) => setDraft({ ...draft, owner: event.target.value })}
                  placeholder="Communications Team"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="decision-status">Status</Label>
                <select
                  id="decision-status"
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({ ...draft, status: event.target.value as Draft["status"] })
                  }
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="decision-due">Due</Label>
                <Input
                  id="decision-due"
                  type="datetime-local"
                  value={draft.dueAt}
                  onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="decision-source-url">Source URL</Label>
                <Input
                  id="decision-source-url"
                  value={draft.sourceUrl}
                  onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })}
                  placeholder="Optional evidence link"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="decision-result">Result</Label>
                <textarea
                  id="decision-result"
                  value={draft.result}
                  onChange={(event) => setDraft({ ...draft, result: event.target.value })}
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="What happened after the decision?"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => draft && mutation.mutate(draft)}
              disabled={!draft?.insight.trim() || !draft?.decision.trim() || mutation.isPending}
            >
              <ClipboardCheck className="size-4" /> Save decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
