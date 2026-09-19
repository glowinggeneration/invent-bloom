import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageTitle } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import { listCalendarActions, type CalendarAction } from "@/lib/campaign-calendar.functions";
import { ACTION_KIND_LABELS, type CampaignActionKind } from "@/lib/campaign-manager";
import { INTERNAL_ACCOUNT_BUDGETS } from "@/lib/x-compliance";

export const Route = createFileRoute("/_authenticated/campaign-calendar")({
  head: () => ({
    meta: [
      { title: "Campaign Calendar - SMAIT" },
      {
        name: "description",
        content:
          "See every scheduled post across campaigns on a monthly calendar, and plan timing around X's rate limits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Campaign Calendar - SMAIT" },
      {
        property: "og:description",
        content: "Plan campaign timing across a monthly view of scheduled X actions.",
      },
    ],
  }),
  component: CampaignCalendarPage,
});

const KIND_DOT: Record<CampaignActionKind, string> = {
  tweet: "bg-sky-500",
  comment: "bg-violet-500",
  like: "bg-rose-500",
  retweet: "bg-emerald-500",
  bookmark: "bg-amber-500",
  follow: "bg-cyan-500",
};

const STATUS_LABEL: Record<CalendarAction["status"], string> = {
  pending: "Pending",
  running: "Running",
  success: "Posted",
  failed: "Failed",
  paused: "Paused",
  cancelled: "Cancelled",
};

const DONE_STATUSES = new Set<CalendarAction["status"]>(["success", "failed", "cancelled"]);

function dayKey(iso: string) {
  return format(startOfDay(new Date(iso)), "yyyy-MM-dd");
}

/** Highest fraction of an action-type's 24h budget any single account hits on this day. */
function budgetPressure(actions: CalendarAction[]): number {
  const perAccount = new Map<string, Map<CampaignActionKind, number>>();
  for (const action of actions) {
    const acct = action.accountId ?? action.handle ?? "unknown";
    const byKind = perAccount.get(acct) ?? new Map<CampaignActionKind, number>();
    byKind.set(action.actionType, (byKind.get(action.actionType) ?? 0) + 1);
    perAccount.set(acct, byKind);
  }
  let worst = 0;
  for (const byKind of perAccount.values()) {
    for (const [kind, count] of byKind.entries()) {
      const budget = kind === "follow" ? null : INTERNAL_ACCOUNT_BUDGETS[kind];
      if (!budget) continue;
      worst = Math.max(worst, count / budget.rolling24h);
    }
  }
  return worst;
}

function CampaignCalendarPage() {
  const fetchActions = useServerFn(listCalendarActions);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const rangeFrom = gridStart.toISOString();
  const rangeTo = addDays(gridEnd, 1).toISOString();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["campaign-calendar-actions", rangeFrom, rangeTo],
    queryFn: () => fetchActions({ data: { from: rangeFrom, to: rangeTo } }),
  });

  const actions = useMemo(() => data ?? [], [data]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarAction[]>();
    for (const action of actions) {
      const key = dayKey(action.runAt);
      const list = map.get(key) ?? [];
      list.push(action);
      map.set(key, list);
    }
    return map;
  }, [actions]);

  const selectedActions = selectedDay ? (byDay.get(format(selectedDay, "yyyy-MM-dd")) ?? []) : [];

  return (
    <WorkspaceShell title="Campaign Calendar" wide>
      <PageTitle
        description="Every scheduled post across campaigns, laid out by day, so you can plan timing around X's rate limits."
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous month"
              onClick={() => {
                setCursor((c) => addMonths(c, -1));
                setSelectedDay(null);
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCursor(startOfMonth(new Date()));
                setSelectedDay(null);
              }}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next month"
              onClick={() => {
                setCursor((c) => addMonths(c, 1));
                setSelectedDay(null);
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      >
        {format(cursor, "MMMM yyyy")}
      </PageTitle>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        {(Object.keys(ACTION_KIND_LABELS) as CampaignActionKind[]).map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", KIND_DOT[kind])} aria-hidden="true" />
            {ACTION_KIND_LABELS[kind]}
          </span>
        ))}
      </div>

      {isError ? (
        <EmptyState
          title="Couldn't load the calendar"
          description="Something went wrong fetching scheduled actions."
          action={
            <Button variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          }
        />
      ) : null}

      {!isError && isLoading ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : null}

      {!isError && !isLoading ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-[11px] font-medium text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayActions = byDay.get(key) ?? [];
              const inMonth = isSameMonth(day, cursor);
              const pressure = budgetPressure(dayActions);
              const selected = selectedDay ? isSameDay(day, selectedDay) : false;
              const counts = new Map<CampaignActionKind, number>();
              for (const action of dayActions) {
                counts.set(action.actionType, (counts.get(action.actionType) ?? 0) + 1);
              }
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "flex min-h-24 flex-col items-stretch gap-1 border-b border-r border-border p-2 text-left transition-colors last:border-r-0 hover:bg-muted/40",
                    !inMonth && "bg-muted/10 text-muted-foreground/50",
                    selected && "bg-primary/10 ring-1 ring-inset ring-primary",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "type-meta font-medium",
                        isToday(day) &&
                          "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayActions.length > 0 ? (
                      <span
                        className={cn(
                          "type-meta font-semibold",
                          pressure >= 1
                            ? "text-destructive"
                            : pressure >= 0.75
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground",
                        )}
                        title={
                          pressure >= 0.75
                            ? "An account is approaching or over its 24h rate-limit budget this day"
                            : undefined
                        }
                      >
                        {dayActions.length}
                      </span>
                    ) : null}
                  </div>
                  {counts.size > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {[...counts.entries()].map(([kind, n]) => (
                        <span
                          key={kind}
                          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                          title={`${ACTION_KIND_LABELS[kind]}: ${n}`}
                        >
                          <span
                            className={cn("size-1.5 rounded-full", KIND_DOT[kind])}
                            aria-hidden="true"
                          />
                          {n}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {dayActions.length > 0 ? (
                    <div className="mt-auto flex -space-x-px">
                      {dayActions.some((a) => DONE_STATUSES.has(a.status)) ? (
                        <span className="type-meta text-[10px] text-muted-foreground/70">
                          {dayActions.filter((a) => DONE_STATUSES.has(a.status)).length} done ·{" "}
                          {dayActions.filter((a) => !DONE_STATUSES.has(a.status)).length} queued
                        </span>
                      ) : (
                        <span className="type-meta text-[10px] text-muted-foreground/70">
                          {dayActions.length} queued
                        </span>
                      )}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!isError && !isLoading && actions.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No scheduled actions this month"
            description="Once campaigns schedule tweets, comments or engagement, they'll show up here by day."
          />
        </div>
      ) : null}

      {selectedDay ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="type-card font-semibold">{format(selectedDay, "EEEE, MMMM d")}</h2>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
              Close
            </Button>
          </div>
          {selectedActions.length === 0 ? (
            <p className="type-meta text-muted-foreground">Nothing scheduled on this day.</p>
          ) : (
            <ul className="divide-y divide-border">
              {selectedActions.map((action) => {
                const done = DONE_STATUSES.has(action.status);
                return (
                  <li
                    key={action.id}
                    className={cn("flex items-start gap-3 py-3", done && "opacity-60")}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        KIND_DOT[action.actionType],
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="type-meta font-medium">
                          {format(new Date(action.runAt), "h:mm a")}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {ACTION_KIND_LABELS[action.actionType]}
                        </Badge>
                        <Badge variant={done ? "secondary" : "default"} className="text-[10px]">
                          {STATUS_LABEL[action.status]}
                        </Badge>
                        {action.handle ? (
                          <span className="type-meta text-muted-foreground">@{action.handle}</span>
                        ) : null}
                        {action.personaName ? (
                          <span className="type-meta text-muted-foreground">
                            {action.personaName}
                          </span>
                        ) : null}
                      </div>
                      {action.content ? (
                        <p className="mt-1 line-clamp-2 type-meta text-muted-foreground">
                          {action.content}
                        </p>
                      ) : null}
                      {action.targetHandle ? (
                        <p className="mt-1 type-meta text-muted-foreground">
                          Target: @{action.targetHandle}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
