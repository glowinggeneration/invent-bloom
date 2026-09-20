import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ClipboardCheck, FileText, Gauge, Search, SquarePen } from "lucide-react";

import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, EmptyState, PageTitle } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataFreshness } from "@/components/data-freshness";
import { listDecisionLog, type DecisionLogItem } from "@/lib/platform-control.functions";
import { listManagedCampaigns } from "@/lib/campaign-manager.functions";
import { STATUS_LABELS } from "@/lib/campaign-manager";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today - SMAIT" },
      {
        name: "description",
        content:
          "Start an investigation, test a message or create a campaign, then see what needs a decision and what's recently run.",
      },
    ],
  }),
  component: TodayPage,
});

const OPEN_STATUSES = new Set<DecisionLogItem["status"]>(["open", "in_progress"]);

function decisionStatusTone(status: DecisionLogItem["status"]) {
  if (status === "open") return "border-destructive/30 bg-destructive/5 text-destructive";
  if (status === "in_progress")
    return "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300";
  return "border-border bg-muted text-muted-foreground";
}

function TodayPage() {
  const [text, setText] = useState("");
  const trimmed = text.trim();

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

  return (
    <WorkspaceShell title="Today">
      <PageTitle description="Pick up where the workspace needs you, or start something new below.">
        Today
      </PageTitle>

      <Card className="p-5 sm:p-6">
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
              <h2 className="type-card font-semibold">Needs your attention</h2>
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
                  <li key={item.id}>
                    <Link
                      to="/decisions"
                      className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.insight}</span>
                        <span className="block truncate type-meta text-muted-foreground">
                          {item.owner || "Unassigned"}
                        </span>
                      </span>
                      <Badge variant="outline" className={decisionStatusTone(item.status)}>
                        {item.status === "in_progress" ? "In progress" : "Open"}
                      </Badge>
                    </Link>
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
              View decision log
            </Link>
          ) : null}
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-primary" aria-hidden="true" />
              <h2 className="type-card font-semibold">Recent work</h2>
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
    </WorkspaceShell>
  );
}
