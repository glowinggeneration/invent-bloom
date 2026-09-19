import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  ListChecks,
  Megaphone,
  PauseOctagon,
  PlayCircle,
  Radar,
  ShieldCheck,
  Siren,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { DataFreshness } from "@/components/data-freshness";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, PageTitle, StatCard } from "@/components/ui-kit";
import {
  CommandGrid,
  RailAction,
  RailCard,
  RailStat,
  RailStatList,
} from "@/components/command-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { getOverviewIntelligence } from "@/lib/overview-intelligence.functions";
import {
  clearWorkspacePause,
  getCampaignReadiness,
  pauseAllCampaignExecution,
} from "@/lib/platform-control.functions";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/preflight")({
  head: () => ({
    meta: [
      { title: "Campaign Preflight - SMAIT" },
      {
        name: "description",
        content:
          "Check account readiness, queue state and current communication risk before launching a campaign.",
      },
    ],
  }),
  component: PreflightPage,
});

function PreflightPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  const fetchReadiness = useServerFn(getCampaignReadiness);
  const fetchIntel = useServerFn(getOverviewIntelligence);
  const pauseAll = useServerFn(pauseAllCampaignExecution);
  const clearPause = useServerFn(clearWorkspacePause);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [reason, setReason] = useState("Operational review");

  const readiness = useQuery({
    queryKey: ["campaign-readiness"],
    queryFn: () => fetchReadiness(),
    refetchInterval: 60_000,
  });
  const intel = useQuery({
    queryKey: ["preflight", "intelligence"],
    queryFn: () => fetchIntel(),
    staleTime: 5 * 60 * 1000,
  });

  const stop = useMutation({
    mutationFn: () => pauseAll({ data: { reason } }),
    onSuccess: async (result) => {
      toast.success(`Execution paused. ${result.pausedActions} queued actions held.`);
      setPauseOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["campaign-readiness"] });
    },
    onError: (error: Error) =>
      toast.error(friendlyError(error, { action: "pause campaign execution" })),
  });
  const clear = useMutation({
    mutationFn: () => clearPause(),
    onSuccess: async () => {
      toast.success(
        "Workspace pause cleared. Previously paused campaign actions stay paused until resumed explicitly.",
      );
      await queryClient.invalidateQueries({ queryKey: ["campaign-readiness"] });
    },
    onError: (error: Error) =>
      toast.error(friendlyError(error, { action: "clear the workspace pause" })),
  });

  const data = readiness.data;
  const paused = Boolean(data?.execution.paused);
  const criticalRisks = intel.data?.risks.slice(0, 3) ?? [];
  const checks = [
    {
      label: "Workspace execution",
      ok: !paused,
      detail: paused
        ? data?.execution.reason || "Campaign execution is paused"
        : "Available for deliberate campaign launches",
    },
    {
      label: "Ready linked accounts",
      ok: Boolean(data && data.accounts.ready > 0),
      detail: data
        ? `${data.accounts.ready} ready · ${data.accounts.unavailable} unavailable`
        : "Checking account state",
    },
    {
      label: "Queue visibility",
      ok: Boolean(data),
      detail: data
        ? `${data.queue.pending.toLocaleString()} future actions currently queued`
        : "Checking queue",
    },
    {
      label: "Current risk context reviewed",
      ok: criticalRisks.length === 0,
      detail: criticalRisks.length
        ? `${criticalRisks.length} current risk signal${criticalRisks.length === 1 ? "" : "s"} should be reviewed before launch`
        : "No leading risk signal is currently blocking a routine review",
    },
  ];
  const passedCount = checks.filter((c) => c.ok).length;
  const warningCount = checks.length - passedCount;
  const blockerCount = paused ? 1 : 0;

  return (
    <WorkspaceShell title="Campaign Preflight" wide>
      <PageTitle
        description="A final operational check before a campaign is launched. Message-specific legal and persona testing still happens inside the normal campaign workflow."
        actions={<DataFreshness at={data?.generatedAt} label="Readiness" />}
      >
        Campaign Preflight
      </PageTitle>

      {paused ? (
        <Card className="mb-5 border-destructive/40 bg-destructive/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 type-card font-semibold text-destructive">
                <PauseOctagon className="size-5" /> Campaign execution paused
              </p>
              <p className="mt-1 type-meta text-muted-foreground">
                {data?.execution.reason || "An administrator paused future campaign execution."}
              </p>
              <p className="mt-2 type-meta text-muted-foreground">
                Queued future actions are held, scheduled execution does not drain, and content
                planning remains review-only until publishing is allowed again.
              </p>
            </div>
            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => clear.mutate()}
                disabled={clear.isPending}
              >
                <PlayCircle className="size-4" /> Clear workspace pause
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Checks passed"
          value={passedCount}
          icon={CheckCircle2}
          tone={passedCount === checks.length ? "positive" : "neutral"}
          className={
            passedCount === checks.length
              ? "shadow-[0_0_50px_-12px] shadow-primary/30 ring-1 ring-primary/15"
              : ""
          }
        />
        <StatCard
          label="Warnings"
          value={warningCount}
          icon={AlertTriangle}
          tone={warningCount ? "negative" : "positive"}
        />
        <StatCard
          label="Blockers"
          value={blockerCount}
          icon={PauseOctagon}
          tone={blockerCount ? "negative" : "positive"}
        />
        <StatCard
          label="Risk signals"
          value={criticalRisks.length}
          icon={Radar}
          tone={criticalRisks.length ? "negative" : "positive"}
        />
      </div>

      <CommandGrid
        className="mt-5"
        left={
          <>
            <RailCard title="Readiness score" icon={Gauge}>
              <RailStatList>
                <RailStat
                  label="Checks passed"
                  value={`${passedCount}/${checks.length}`}
                  tone={passedCount === checks.length ? "positive" : "neutral"}
                />
                <RailStat label="Ready accounts" value={data?.accounts.ready ?? "—"} />
                <RailStat
                  label="Unavailable accounts"
                  value={data?.accounts.unavailable ?? "—"}
                  tone={data?.accounts.unavailable ? "negative" : "positive"}
                />
                <RailStat label="Queued actions" value={data?.queue.pending ?? "—"} />
              </RailStatList>
            </RailCard>

            <RailCard title="Check categories" icon={ListChecks}>
              <div className="space-y-1.5">
                {checks.map((check) => (
                  <div key={check.label} className="flex min-w-0 items-center gap-2 py-1">
                    {check.ok ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-positive" />
                    ) : (
                      <AlertTriangle className="size-3.5 shrink-0 text-negative" />
                    )}
                    <p className="type-meta min-w-0 truncate text-muted-foreground">
                      {check.label}
                    </p>
                  </div>
                ))}
              </div>
            </RailCard>
          </>
        }
        right={
          <>
            <RailCard
              title="Next action"
              icon={Megaphone}
              className={
                !paused ? "shadow-[0_0_50px_-12px] shadow-primary/30 ring-1 ring-primary/15" : ""
              }
            >
              <p className="type-meta text-muted-foreground">
                Review the live context, then continue through Post or Reply where accounts, timing
                and message risk are confirmed.
              </p>
              <div className="mt-3 space-y-2">
                {paused ? (
                  <Button
                    disabled
                    title="Clear the workspace pause before launching a campaign"
                    className="w-full"
                  >
                    Create campaign
                  </Button>
                ) : (
                  <RailAction
                    to="/publish"
                    icon={Megaphone}
                    title="Create campaign"
                    description="Choose accounts and message"
                  />
                )}
                <RailAction
                  to="/crisis"
                  icon={Siren}
                  title="Open Crisis Command"
                  description="Monitor live risk signals"
                />
                <RailAction
                  to="/campaign-manager"
                  icon={ListChecks}
                  title="Review campaigns"
                  description="See active and past campaigns"
                />
              </div>
            </RailCard>

            {isAdmin ? (
              <RailCard
                title="Emergency control"
                icon={PauseOctagon}
                className="border-destructive/20"
              >
                <p className="type-meta text-muted-foreground">
                  Hold all queued future actions without deleting campaign records. Monitoring and
                  intelligence remain available.
                </p>
                <Button
                  className="mt-3 w-full"
                  variant="destructive"
                  disabled={paused}
                  onClick={() => setPauseOpen(true)}
                >
                  <PauseOctagon className="size-4" /> Pause all campaigns
                </Button>
              </RailCard>
            ) : null}
          </>
        }
      >
        <Card>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="type-section">Preflight checklist</h2>
          </div>
          <div className="mt-4 divide-y divide-border">
            {checks.map((check) => (
              <div key={check.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                {check.ok ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0">
                  <p className="type-body font-semibold">{check.label}</p>
                  <p className="type-meta mt-0.5 text-muted-foreground">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {criticalRisks.length ? (
          <Card>
            <h2 className="type-section">Risks to review before launch</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {criticalRisks.map((risk) => (
                <div
                  key={`${risk.title}-${risk.detail}`}
                  className="min-w-0 rounded-xl border border-border p-4"
                >
                  <p className="type-body truncate font-semibold">{risk.title}</p>
                  <p className="mt-1 type-meta text-muted-foreground">{risk.detail}</p>
                  {risk.query ? (
                    <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0">
                      <Link to="/mentions" search={{ topic: risk.query } as any}>
                        Investigate mentions
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <h2 className="type-section">No blocking risk signals</h2>
            </div>
            <p className="mt-2 type-meta text-muted-foreground">
              No current risk signal is blocking a routine campaign review. Continue through Post or
              Reply to confirm accounts and message-level checks.
            </p>
          </Card>
        )}
      </CommandGrid>

      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause all campaign execution?</DialogTitle>
            <DialogDescription>
              Future queued actions will be held. Nothing is deleted, and completed actions are
              unchanged.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for pause"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => stop.mutate()}
              disabled={stop.isPending || !reason.trim()}
            >
              <PauseOctagon className="size-4" /> Pause all campaigns
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
