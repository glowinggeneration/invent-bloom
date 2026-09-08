import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AtSign,
  CalendarClock,
  Clock,
  Loader2,
  Plus,
  Send,
  Shield,
  TriangleAlert,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AccountIdentity } from "@/components/account-identity";
import { ExternalIdentity } from "@/components/external-identity";
import { CampaignDialog } from "@/components/campaign-dialog";
import {
  CampaignHeader,
  LaunchActions,
  PersonaPicker,
  Step,
  SummaryRow,
  TimingFields,
  timingLabel,
  usePersonaSelection,
  useTiming,
  CampaignNameStep,
  CampaignRunningDialog,
} from "@/components/campaign-kit";
import { PublishProgress } from "@/components/publish-progress";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listPublishJobs, listXAccounts } from "@/lib/publish.functions";
import { runFollowTargets, scheduleFollowTargets } from "@/lib/follow.functions";
import { friendlyError } from "@/lib/friendly-errors";

function parseHandles(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((h) => h.trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, ""))
        .map((h) => h.replace(/^@/, "").split(/[/?#]/)[0] ?? "")
        .filter((h) => /^[A-Za-z0-9_]{1,15}$/.test(h)),
    ),
  ];
}

/**
 * /campaign/follow — grow an account's follower base with selected personas,
 * spread over time so the pattern looks organic.
 */
export function FollowCampaign() {
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(listXAccounts);
  const fetchJobs = useServerFn(listPublishJobs);
  const followNow = useServerFn(runFollowTargets);
  const scheduleFollows = useServerFn(scheduleFollowTargets);

  const accountsQuery = useQuery({ queryKey: ["x-accounts"], queryFn: () => fetchAccounts() });
  const jobsQuery = useQuery({ queryKey: ["publish-jobs"], queryFn: () => fetchJobs() });
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  const personas = usePersonaSelection(accounts);
  const timing = useTiming();

  const [raw, setRaw] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  function addTargets() {
    const found = parseHandles(raw);
    if (found.length === 0) {
      toast.error("Add a valid handle to continue.");
      return;
    }
    setTargets((prev) => [...new Set([...prev, ...found])].slice(0, 25));
    setRaw("");
  }

  const totalActions = targets.length * personas.selected.length;
  const scheduled = timing.spreadHours > 0 || timing.delaySeconds > 0;
  const [campaignName, setCampaignName] = useState("");
  const [startedOpen, setStartedOpen] = useState(false);
  const canRun =
    targets.length > 0 && personas.selected.length > 0 && campaignName.trim().length > 0;

  const runMutation = useMutation({
    mutationFn: () =>
      followNow({
        data: { handles: targets, accountIds: personas.selected, name: campaignName.trim() },
      }),
    onSuccess: (res) => {
      setError(null);
      setStartedOpen(true);
      toast.success(`${res.ok} follow(s) done.`);
      void queryClient.invalidateQueries({ queryKey: ["publish-jobs"] });
    },
    onError: (e: Error) =>
      setError(
        friendlyError(e, {
          action: "start these follows",
          preserved: "Your account list is still here.",
        }),
      ),
  });

  const scheduleMutation = useMutation({
    mutationFn: () =>
      scheduleFollows({
        data: {
          handles: targets,
          accountIds: personas.selected,
          spreadHours: timing.spreadHours,
          delaySeconds: timing.delaySeconds,
          smartDelay: timing.smartDelay,
          name: campaignName.trim(),
        },
      }),
    onSuccess: (res) => {
      setError(null);
      setStartedOpen(true);
      toast.success(`${res.scheduled} follow(s) queued.`);
      void queryClient.invalidateQueries({ queryKey: ["scheduled-actions"] });
    },
    onError: (e: Error) =>
      setError(
        friendlyError(e, {
          action: "start these follows",
          preserved: "Your account list is still here.",
        }),
      ),
  });

  const busy = runMutation.isPending || scheduleMutation.isPending;
  const followRuns = useMemo(
    () => (jobsQuery.data ?? []).filter((j) => String(j.mode) === "engagement"),
    [jobsQuery.data],
  );

  const runButton = (
    <LaunchActions
      scheduled={scheduled}
      busy={busy}
      disabled={!canRun}
      onLaunch={() => runMutation.mutate()}
      onQueue={() => scheduleMutation.mutate()}
      launchLabel="Follow now"
      queueLabel="Queue follows"
    />
  );

  const previewAccount = personas.selectedAccounts[0] ?? null;

  return (
    <WorkspaceShell title="Follow campaign">
      <CampaignRunningDialog open={startedOpen} onOpenChange={setStartedOpen} name={campaignName} />
      <div className="mx-auto w-full max-w-7xl pb-24">
        <CampaignHeader
          title="Follow campaign"
          subtitle="Follow accounts with selected personas, spread over natural timing"
          goal="follow"
          action={runButton}
        />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <CampaignNameStep
              index={1}
              value={campaignName}
              onChange={setCampaignName}
              placeholder="e.g. Follow county FA pages"
            />

            <Step
              index={2}
              title="Accounts to follow"
              description="Paste handles or profile links. Each persona follows every one of them."
              aside={
                <span className="text-xs text-muted-foreground">{targets.length} target(s)</span>
              }
            >
              <Textarea
                rows={2}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="@newsdesk, https://x.com/handle"
                aria-label="Handles to follow"
                className="resize-y"
              />
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Button size="sm" variant="outline" onClick={addTargets}>
                  <Plus className="size-4" /> Add accounts
                </Button>
                {targets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTargets([])}
                    className="ml-auto underline underline-offset-2 hover:text-foreground"
                  >
                    Clear list
                  </button>
                )}
              </div>

              {targets.length > 0 && (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {targets.map((h) => (
                    <li
                      key={h}
                      className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
                    >
                      <ExternalIdentity
                        handle={h}
                        fallbackName={`@${h}`}
                        avatarClassName="size-8"
                        nameClassName="truncate text-xs font-semibold"
                      />
                      <button
                        type="button"
                        aria-label={`Remove @${h}`}
                        onClick={() => setTargets((prev) => prev.filter((x) => x !== h))}
                        className="ml-auto shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Step>

            <Step index={3} title="Personas" description="Choose who will follow.">
              <PersonaPicker
                id="follow"
                selection={personas}
                loading={accountsQuery.isLoading}
                label="How many personas should follow?"
              />
            </Step>

            <Step index={4} title="Timing" description="How the follows are paced.">
              <TimingFields id="follow" timing={timing} />
            </Step>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
              {runButton}
              {!canRun && (
                <span className="text-xs text-muted-foreground">
                  {targets.length === 0
                    ? "Add at least one account to follow."
                    : personas.selected.length === 0
                      ? "Select at least one persona."
                      : "Name the campaign."}
                </span>
              )}
            </div>

            {runMutation.isPending && <PublishProgress label="Following across your personas" />}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <aside className="min-w-0 space-y-4 xl:sticky xl:top-24">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">Campaign summary</h2>
              <div className="mt-2 divide-y divide-border">
                <SummaryRow icon={AtSign} label="Accounts to follow" value={targets.length} />
                <SummaryRow
                  icon={Users}
                  label="Personas selected"
                  value={`${personas.selected.length} of ${personas.groupTotal}`}
                />
                <SummaryRow icon={Users} label="Persona group" value={personas.groupLabel} />
                <SummaryRow icon={Zap} label="Estimated follows" value={totalActions} />
                <SummaryRow icon={Clock} label="Timing" value={timingLabel(timing)} />
                <SummaryRow
                  icon={Shield}
                  label="Safety"
                  value={timing.smartDelay ? "Smart delays on" : "Smart delays off"}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">Live preview</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">How the follow will appear</p>
              <div className="mt-4 rounded-xl border border-border p-4">
                {targets[0] ? (
                  <ExternalIdentity
                    handle={targets[0]}
                    fallbackName={`@${targets[0]}`}
                    avatarClassName="size-9"
                    nameClassName="truncate text-sm font-semibold"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Add an account to see who will be followed.
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-primary">
                  <UserPlus className="size-4" aria-hidden="true" />
                  <span className="text-xs font-medium">
                    {personas.selected.length} persona(s) will follow
                  </span>
                </div>
                {previewAccount && (
                  <div className="mt-4 border-t border-border pt-3">
                    <AccountIdentity
                      handle={previewAccount.handle}
                      displayName={previewAccount.displayName}
                      avatarUrl={previewAccount.avatarUrl ?? null}
                      avatarClassName="size-8"
                      nameClassName="truncate text-xs font-semibold"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      leads the run, {Math.max(0, personas.selected.length - 1)} more follow after.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">Recent runs</h2>
              <ul className="mt-3 space-y-2">
                {followRuns.slice(0, 8).map((j) => (
                  <li key={j.id}>
                    <button
                      type="button"
                      onClick={() => setCampaignId(j.id)}
                      className="w-full rounded-xl border border-border/70 px-3 py-2 text-left text-xs transition hover:border-primary/50 hover:bg-muted/40"
                    >
                      <p className="truncate">{j.targetTweetUrl || "Engagement run"}</p>
                      <p className="mt-1 truncate text-muted-foreground">
                        {j.succeeded} delivered{j.failed > 0 ? ` · ${j.failed} in progress` : ""} ·{" "}
                        {new Date(j.createdAt).toLocaleString()}
                      </p>
                    </button>
                  </li>
                ))}
                {followRuns.length === 0 && (
                  <li className="text-xs text-muted-foreground">No runs yet.</li>
                )}
              </ul>
            </section>
          </aside>
        </div>
      </div>

      <CampaignDialog campaignId={campaignId} onClose={() => setCampaignId(null)} />
    </WorkspaceShell>
  );
}
