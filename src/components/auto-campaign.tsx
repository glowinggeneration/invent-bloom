import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  Clock,
  Heart,
  Loader2,
  MessageCircle,
  Radar,
  Send,
  Shield,
  Sparkles,
  TriangleAlert,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AccountIdentity } from "@/components/account-identity";
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
} from "@/components/campaign-kit";
import { PublishProgress } from "@/components/publish-progress";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagPicker } from "@/components/ui/tag-picker";
import { Textarea } from "@/components/ui/textarea";
import { saveCampaign } from "@/lib/campaigns.functions";
import { listPublishJobs, listXAccounts, runPublish } from "@/lib/publish.functions";
import { getSetupStatus } from "@/lib/onboarding.functions";
import { nextWindowStart } from "@/lib/send-windows";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/friendly-errors";

const ACTIVITIES = [
  { key: "post", label: "Post", icon: Send, hint: "Each persona publishes the objective" },
  { key: "engage", label: "Engage", icon: Heart, hint: "Like and repost related posts" },
  {
    key: "follow",
    label: "Follow",
    icon: UserPlus,
    hint: "Follow the accounts in the conversation",
  },
  {
    key: "intercept",
    label: "Intercept",
    icon: Radar,
    hint: "Reply to matching keywords as they appear",
  },
] as const;

type ActivityKey = (typeof ACTIVITIES)[number]["key"];

/**
 * /campaign/auto — one brief, one run: personas post the objective, engage
 * around it, follow the right accounts and keep listening for new mentions.
 */
export function AutoCampaign() {
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(listXAccounts);
  const fetchJobs = useServerFn(listPublishJobs);
  const publish = useServerFn(runPublish);
  const fetchSetup = useServerFn(getSetupStatus);
  const persistCampaign = useServerFn(saveCampaign);

  const accountsQuery = useQuery({ queryKey: ["x-accounts"], queryFn: () => fetchAccounts() });
  const jobsQuery = useQuery({ queryKey: ["publish-jobs"], queryFn: () => fetchJobs() });
  const setupQuery = useQuery({ queryKey: ["setup-status"], queryFn: () => fetchSetup() });
  const keywordSuggestions = setupQuery.data?.keywords ?? [];
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  const personas = usePersonaSelection(accounts);
  const timing = useTiming(0);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [keywordList, setKeywordList] = useState<string[]>([]);
  const [activities, setActivities] = useState<Record<ActivityKey, boolean>>({
    post: true,
    engage: true,
    follow: false,
    intercept: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const activeActivities = ACTIVITIES.filter((a) => activities[a.key]);
  const canRun =
    objective.trim().length > 0 &&
    personas.selected.length > 0 &&
    activeActivities.length > 0 &&
    (!activities.intercept || keywordList.length > 0);
  const scheduled = timing.spreadHours > 0;

  const runMutation = useMutation({
    mutationFn: async (opts: { now: boolean; startAt?: Date }) => {
      const spreadHours = opts.now ? 0 : timing.spreadHours;
      const start = opts.now ? null : nextWindowStart(timing.windows, opts.startAt ?? new Date());
      let posted = 0;
      if (activities.post) {
        await publish({
          data: {
            mode: "tweet" as const,
            accountIds: personas.selected,
            tweetText: objective,
            commentText: "",
            targetTweetUrl: "",
            linkUrl: "",
            imageUrls: [],
            likeTarget: false,
            varyByPersona: true,
            spreadHours,
            startAt: start ? start.toISOString() : "",
            objectiveMode: true,
            tone: "auto" as const,
            intensity: 3,
            actions: {
              like: activities.engage,
              retweet: activities.engage,
              bookmark: false,
              follow: activities.follow,
            },
            targets: { author: true, peer: activities.engage, watchlist: activities.engage },
            variations: [],
          },
        });
        posted = personas.selected.length;
      }

      let listening = false;
      if (activities.intercept) {
        await persistCampaign({
          data: {
            name: name.trim() || `Auto campaign ${new Date().toLocaleDateString()}`,
            keywords: keywordList,
            hashtags: [],
            coreMessage: objective,
            language: "en",
            isActive: true,
            maxRepliesPerRun: 5,
            spreadHours,
            likeTarget: activities.engage,
            followAuthor: activities.follow,
            accountIds: personas.selected,
          },
        });
        listening = true;
      }
      return { posted, listening };
    },
    onSuccess: (res, opts) => {
      setError(null);
      toast.success(
        [
          res.posted > 0
            ? `${res.posted} persona post(s) ${!opts.now && scheduled ? "queued" : "published"}`
            : "",
          res.listening ? "listening rule armed" : "",
        ]
          .filter(Boolean)
          .join(" · ") || "Auto campaign started.",
      );
      void queryClient.invalidateQueries({ queryKey: ["publish-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["scheduled-actions"] });
    },
    onError: (e: Error) =>
      setError(
        friendlyError(e, { action: "start this campaign", preserved: "Your brief is still here." }),
      ),
  });

  const recentRuns = jobsQuery.data ?? [];
  const firstPersona = personas.selectedAccounts[0] ?? null;

  const runButton = (
    <LaunchActions
      scheduled={scheduled}
      busy={runMutation.isPending}
      disabled={!canRun}
      onLaunch={() => runMutation.mutate({ now: true })}
      onQueue={() => runMutation.mutate({ now: false })}
      onSchedule={(at) => runMutation.mutate({ now: false, startAt: at })}
      launchLabel="Launch auto campaign"
      queueLabel="Queue auto campaign"
    />
  );

  return (
    <WorkspaceShell title="Auto campaign">
      <div className="mx-auto w-full max-w-7xl pb-24">
        <CampaignHeader
          title="Auto campaign"
          subtitle="One brief: posting, engaging, following and listening in a single run"
          goal="auto"
          action={runButton}
        />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <Step
              index={1}
              title="Campaign brief"
              description="What should the personas achieve? They write their own words from this."
            >
              <div className="space-y-1.5">
                <label className="text-xs font-medium" htmlFor="auto-name">
                  Campaign name
                </label>
                <Input
                  id="auto-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Harambee Stars qualification push"
                />
              </div>
              <Textarea
                rows={4}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="e.g. Build pride around the qualification and thank the fans who travelled."
                aria-label="Campaign objective"
                className="resize-y"
              />
            </Step>

            <Step
              index={2}
              title="What the campaign does"
              description="Combine as many activities as the objective needs."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ACTIVITIES.map((a) => {
                  const on = activities[a.key];
                  const Icon: LucideIcon = a.icon;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setActivities((prev) => ({ ...prev, [a.key]: !prev[a.key] }))}
                      className={cn(
                        "rounded-xl border p-4 text-left transition",
                        on
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-muted/40",
                      )}
                    >
                      <Icon
                        className={cn("size-5", on ? "text-primary" : "text-muted-foreground")}
                      />
                      <p className="mt-2 text-sm font-medium">{a.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{a.hint}</p>
                    </button>
                  );
                })}
              </div>
              {activeActivities.length === 0 && (
                <p className="text-xs text-destructive">Choose at least one activity.</p>
              )}

              {activities.intercept && (
                <TagPicker
                  id="auto-keywords"
                  label="Keywords to listen for"
                  value={keywordList}
                  onChange={setKeywordList}
                  suggestions={keywordSuggestions}
                  allowCustom
                  placeholder="Add a term and press Enter"
                />
              )}
            </Step>

            <Step index={3} title="Personas" description="Who runs this campaign.">
              <PersonaPicker
                id="auto"
                selection={personas}
                loading={accountsQuery.isLoading}
                label="How many personas should take part?"
              />
            </Step>

            <Step index={4} title="Timing" description="How the whole campaign is paced.">
              <TimingFields id="auto" timing={timing} showDelay={false} />
            </Step>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
              {runButton}
              {!canRun && (
                <span className="text-xs text-muted-foreground">
                  {objective.trim().length === 0
                    ? "Describe the objective."
                    : personas.selected.length === 0
                      ? "Select at least one persona."
                      : activeActivities.length === 0
                        ? "Choose at least one activity."
                        : "Add at least one keyword to listen for."}
                </span>
              )}
            </div>

            {runMutation.isPending && <PublishProgress label="Starting the auto campaign" />}

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
                <SummaryRow
                  icon={Sparkles}
                  label="Activities"
                  value={activeActivities.map((a) => a.label).join(" · ") || "None"}
                />
                <SummaryRow
                  icon={Users}
                  label="Personas selected"
                  value={`${personas.selected.length} of ${personas.groupTotal}`}
                />
                <SummaryRow icon={Users} label="Persona group" value={personas.groupLabel} />
                <SummaryRow
                  icon={MessageCircle}
                  label="Keywords watched"
                  value={activities.intercept ? keywordList.length : "—"}
                />
                <SummaryRow
                  icon={Zap}
                  label="Posts in first wave"
                  value={activities.post ? personas.selected.length : 0}
                />
                <SummaryRow icon={Clock} label="Timing" value={timingLabel(timing)} />
                <SummaryRow
                  icon={Shield}
                  label="Safety"
                  value={scheduled ? "Spread across window" : "Runs immediately"}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">Live preview</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The brief each persona works from
              </p>
              <div className="mt-4 rounded-xl border border-border p-4">
                {firstPersona ? (
                  <AccountIdentity
                    handle={firstPersona.handle}
                    displayName={firstPersona.displayName}
                    avatarUrl={firstPersona.avatarUrl ?? null}
                    avatarClassName="size-9"
                    nameClassName="truncate text-sm font-semibold"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Select a persona to preview.</p>
                )}
                <p className="mt-3 whitespace-pre-wrap text-sm">
                  {objective || "Your objective will appear here."}
                </p>
                <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-muted-foreground">
                  {ACTIVITIES.map((a) => (
                    <a.icon
                      key={a.key}
                      className={cn("size-4", activities[a.key] && "text-primary")}
                      aria-label={a.label}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">Recent runs</h2>
              <ul className="mt-3 space-y-2">
                {recentRuns.slice(0, 8).map((j) => (
                  <li key={j.id}>
                    <button
                      type="button"
                      onClick={() => setCampaignId(j.id)}
                      className="w-full rounded-xl border border-border/70 px-3 py-2 text-left text-xs transition hover:border-primary/50 hover:bg-muted/40"
                    >
                      <p className="truncate">
                        {j.objectiveText || j.tweetText || j.targetTweetUrl || "Campaign run"}
                      </p>
                      <p className="mt-1 truncate text-muted-foreground">
                        {j.succeeded} ok · {j.failed} failed ·{" "}
                        {new Date(j.createdAt).toLocaleString()}
                      </p>
                    </button>
                  </li>
                ))}
                {recentRuns.length === 0 && (
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
