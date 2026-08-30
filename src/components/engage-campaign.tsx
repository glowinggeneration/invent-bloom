import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  Heart,
  Link2,
  Loader2,
  Plus,
  Minus,
  Repeat2,
  Send,
  Shield,
  TriangleAlert,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AccountIdentity } from "@/components/account-identity";
import { ExternalIdentity } from "@/components/external-identity";
import { CampaignDialog } from "@/components/campaign-dialog";
import { GoalSwitcher } from "@/components/publish-goals";
import { CampaignNameStep, CampaignRunningDialog, LaunchActions } from "@/components/campaign-kit";
import { PublishProgress } from "@/components/publish-progress";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { clusterOf } from "@/lib/insights";
import { loadLikeQueue, parseLinks, saveLikeQueue, type QueuedLink } from "@/lib/like-queue";
import { getTweetPreview, listPublishJobs, listXAccounts } from "@/lib/publish.functions";
import { runEngageLinks, scheduleEngageLinks } from "@/lib/engage.functions";
import { SPREAD_OPTIONS, spreadLabel } from "@/lib/spread";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/friendly-errors";

const ALL_GROUP = "__all__";

const ACTION_CARDS = [
  { key: "like", label: "Like", icon: Heart, hint: "Adds a like from each persona" },
  { key: "retweet", label: "Repost", icon: Repeat2, hint: "Reposts to persona timelines" },
  { key: "bookmark", label: "Bookmark", icon: Bookmark, hint: "Quiet signal, no timeline noise" },
] as const;

type ActionKey = (typeof ACTION_CARDS)[number]["key"];

const DELAY_OPTIONS = [0, 30, 60, 180, 300] as const;

function delayLabel(seconds: number) {
  if (seconds === 0) return "No delay";
  if (seconds < 60) return `${seconds}s between actions`;
  return `${Math.round(seconds / 60)} min between actions`;
}

/** Section shell: numbered heading, one-line description, generous whitespace. */
function Step({
  index,
  title,
  description,
  children,
  aside,
}: {
  index: number;
  title: string;
  description: string;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">
            {index}. {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {aside}
      </div>
      {children ? <div className="mt-4 space-y-4">{children}</div> : null}
    </section>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-right text-xs font-semibold">{value}</span>
    </div>
  );
}

/**
 * Dedicated /campaign/engage workspace: queue tweet links, pick personas,
 * pick actions, pick timing. Every control is wired to the production
 * engagement APIs and the persisted link queue.
 */
export function EngageCampaign() {
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(listXAccounts);
  const fetchJobs = useServerFn(listPublishJobs);
  const fetchTweetPreview = useServerFn(getTweetPreview);
  const engageNow = useServerFn(runEngageLinks);
  const scheduleEngage = useServerFn(scheduleEngageLinks);

  const accountsQuery = useQuery({ queryKey: ["x-accounts"], queryFn: () => fetchAccounts() });
  const jobsQuery = useQuery({ queryKey: ["publish-jobs"], queryFn: () => fetchJobs() });
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  /* ---- link queue (persisted so a long run survives a refresh) ---- */
  const [links, setLinks] = useState<QueuedLink[]>([]);
  const linksRef = useRef<QueuedLink[]>([]);
  const [raw, setRaw] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [running, setRunning] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initial = loadLikeQueue();
    linksRef.current = initial;
    setLinks(initial);
  }, []);

  const updateLinks = (fn: (items: QueuedLink[]) => QueuedLink[]) => {
    const next = fn(linksRef.current);
    linksRef.current = next;
    setLinks(next);
    saveLikeQueue(next);
  };

  function addLinks() {
    const found = parseLinks(raw);
    if (found.length === 0) {
      toast.error("Add a post link to continue.");
      return;
    }
    updateLinks((items) => {
      const seen = new Set(items.map((i) => i.url));
      return [
        ...items,
        ...found
          .filter((u) => !seen.has(u))
          .map((url) => ({ url, status: "pending" as const, ok: 0, failed: 0 })),
      ];
    });
    setRaw("");
  }

  /* ---- personas ---- */
  const [group, setGroup] = useState<string>(ALL_GROUP);
  const [personaCount, setPersonaCount] = useState(10);

  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of accounts) {
      const key = clusterOf(`${a.personaLabel} ${a.displayName}`);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [accounts]);

  const groupAccounts = useMemo(
    () =>
      group === ALL_GROUP
        ? accounts
        : accounts.filter((a) => clusterOf(`${a.personaLabel} ${a.displayName}`) === group),
    [accounts, group],
  );
  const groupTotal = groupAccounts.length;

  useEffect(() => {
    if (groupTotal === 0) return;
    setPersonaCount((n) => Math.min(Math.max(1, n), groupTotal));
  }, [groupTotal]);

  const selected = useMemo(
    () => groupAccounts.slice(0, Math.min(personaCount, groupTotal)).map((a) => a.id),
    [groupAccounts, personaCount, groupTotal],
  );

  /* ---- actions & timing ---- */
  const [actions, setActions] = useState<Record<ActionKey, boolean>>({
    like: true,
    retweet: true,
    bookmark: false,
  });
  const activeActions = ACTION_CARDS.filter((a) => actions[a.key]);
  const [spreadHours, setSpreadHours] = useState(0);
  const [delaySeconds, setDelaySeconds] = useState(60);
  const [smartDelay, setSmartDelay] = useState(true);

  /* ---- preview of the first queued post ---- */
  const firstLink = links[0]?.url ?? "";
  const preview = useQuery({
    queryKey: ["tweet-preview", firstLink],
    queryFn: () => fetchTweetPreview({ data: { url: firstLink } }),
    enabled: /status\/\d+/.test(firstLink),
    staleTime: 5 * 60 * 1000,
  });
  const previewTweet = preview.data?.tweet ?? null;
  const previewAccount = groupAccounts.find((a) => a.id === selected[0]) ?? null;

  const pending = links.filter((l) => l.status !== "done");
  const totalActions = links.length * selected.length * activeActions.length;
  const scheduled = spreadHours > 0 || delaySeconds > 0;
  const [campaignName, setCampaignName] = useState("");
  const [startedOpen, setStartedOpen] = useState(false);
  const canRun =
    links.length > 0 &&
    selected.length > 0 &&
    activeActions.length > 0 &&
    campaignName.trim().length > 0;

  /* ---- execution ---- */
  const scheduleMutation = useMutation({
    mutationFn: () =>
      scheduleEngage({
        data: {
          tweetUrls: links.map((l) => l.url),
          accountIds: selected,
          actions: { like: actions.like, retweet: actions.retweet, bookmark: actions.bookmark },
          spreadHours,
          delaySeconds,
          smartDelay,
          name: campaignName.trim(),
        },
      }),
    onSuccess: (res) => {
      setError(null);
      updateLinks((items) => items.map((i) => ({ ...i, status: "done" as const })));
      setStartedOpen(true);
      toast.success(`${res.scheduled} action(s) queued.`);
      void queryClient.invalidateQueries({ queryKey: ["scheduled-actions"] });
    },
    onError: (e: Error) =>
      setError(
        friendlyError(e, {
          action: "queue this engagement",
          preserved: "Your queue is still saved.",
        }),
      ),
  });

  async function runNow() {
    setRunning(true);
    setError(null);
    try {
      for (;;) {
        const item = linksRef.current.find((i) => i.status === "pending" || i.status === "failed");
        if (!item) break;
        const url = item.url;
        updateLinks((items) =>
          items.map((x) => (x.url === url ? { ...x, status: "running" as const } : x)),
        );
        try {
          const res = await engageNow({
            data: {
              tweetUrls: [url],
              accountIds: selected,
              name: campaignName.trim(),
              actions: {
                like: actions.like,
                retweet: actions.retweet,
                bookmark: actions.bookmark,
              },
            },
          });
          updateLinks((items) =>
            items.map((x) =>
              x.url === url ? { ...x, status: "done" as const, ok: res.ok, failed: res.failed } : x,
            ),
          );
        } catch (e) {
          updateLinks((items) =>
            items.map((x) =>
              x.url === url
                ? {
                    ...x,
                    status: "failed" as const,
                    error: friendlyError(e, { action: "engage this link" }),
                  }
                : x,
            ),
          );
          setError(
            friendlyError(e, {
              action: "finish this run",
              preserved: "The links already engaged are still saved.",
            }),
          );
          break;
        }
      }
      setStartedOpen(true);
      toast.success("Engagement run finished.");
      void queryClient.invalidateQueries({ queryKey: ["publish-jobs"] });
    } finally {
      setRunning(false);
    }
  }

  const engageRuns = useMemo(
    () => (jobsQuery.data ?? []).filter((j) => String(j.mode) === "engagement"),
    [jobsQuery.data],
  );

  const groupLabel = group === ALL_GROUP ? "All personas" : group;
  const busy = running || scheduleMutation.isPending;

  return (
    <WorkspaceShell title="Engage campaign">
      <CampaignRunningDialog open={startedOpen} onOpenChange={setStartedOpen} name={campaignName} />
      <div className="mx-auto w-full max-w-7xl pb-24">
        <header className="sticky top-0 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <Link
            to="/publish"
            search={{ choose: true }}
            aria-label="Back to campaign types"
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">Engage campaign</h1>
            <p className="truncate text-xs text-muted-foreground">
              Like, repost and bookmark selected posts with your personas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GoalSwitcher goal="engage" />
            <LaunchActions
              scheduled={scheduled}
              busy={busy}
              disabled={!canRun}
              onLaunch={() => void runNow()}
              onQueue={() => scheduleMutation.mutate()}
              launchLabel="Run now"
              queueLabel="Queue campaign"
            />
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* -------- form column -------- */}
          <div className="min-w-0 space-y-4">
            <CampaignNameStep
              index={1}
              value={campaignName}
              onChange={setCampaignName}
              placeholder="e.g. Boost matchday highlights"
            />

            <Step
              index={2}
              title="Add tweet links"
              description="Paste one or more post links. Each one is engaged with in turn."
              aside={
                <span className="text-xs text-muted-foreground">
                  {links.length} queued · {pending.length} pending
                </span>
              }
            >
              <Textarea
                rows={3}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="https://x.com/user/status/123…"
                aria-label="Tweet links"
                className="resize-y"
              />
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Button size="sm" variant="outline" onClick={addLinks}>
                  <Plus className="size-4" /> Add links
                </Button>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-foreground"
                >
                  <Link2 className="size-4" /> {showPreview ? "Hide" : "Preview"} queued posts
                </button>
                {links.length > 0 && (
                  <button
                    type="button"
                    onClick={() => updateLinks(() => [])}
                    className="ml-auto underline underline-offset-2 hover:text-foreground"
                  >
                    Clear queue
                  </button>
                )}
              </div>

              {links.length > 0 && (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {links.map((l) => (
                    <li key={l.url} className="flex items-center gap-3 px-3 py-2 text-xs">
                      {l.status === "done" ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                      ) : l.status === "running" ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                      ) : l.status === "failed" ? (
                        <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{l.url}</span>
                      {l.status === "done" && (
                        <span className="shrink-0 text-muted-foreground">
                          {l.ok} delivered
                          {l.failed > 0 ? ` · ${l.failed} in progress` : ""}
                        </span>
                      )}

                      <button
                        type="button"
                        aria-label={`Remove ${l.url}`}
                        onClick={() => updateLinks((items) => items.filter((x) => x.url !== l.url))}
                        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {showPreview && (
                <div className="rounded-xl border border-border p-4">
                  {preview.isFetching ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : previewTweet ? (
                    <div className="space-y-2">
                      <ExternalIdentity
                        handle={previewTweet.authorHandle}
                        fallbackName={previewTweet.authorName ?? null}
                        avatarClassName="size-9"
                        nameClassName="truncate text-sm font-semibold"
                      />
                      <p className="whitespace-pre-wrap text-sm">{previewTweet.text}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Add a post link to preview the first queued post.
                    </p>
                  )}
                </div>
              )}
            </Step>

            <Step index={3} title="Personas" description="Choose who will engage.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" htmlFor="engage-count">
                    How many personas should engage?
                  </label>
                  <div className="flex h-11 items-center justify-between rounded-md border border-input bg-background px-2">
                    <button
                      type="button"
                      aria-label="Fewer personas"
                      className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      onClick={() => setPersonaCount((n) => Math.max(1, n - 1))}
                    >
                      <Minus className="size-4" />
                    </button>
                    <input
                      id="engage-count"
                      type="number"
                      min={1}
                      max={Math.max(1, groupTotal)}
                      value={Math.min(personaCount, Math.max(1, groupTotal))}
                      onChange={(e) =>
                        setPersonaCount(
                          Math.min(
                            Math.max(1, Number(e.target.value) || 1),
                            Math.max(1, groupTotal),
                          ),
                        )
                      }
                      className="w-16 bg-transparent text-center text-sm font-medium tabular-nums outline-none"
                    />
                    <button
                      type="button"
                      aria-label="More personas"
                      className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      onClick={() => setPersonaCount((n) => Math.min(groupTotal || 1, n + 1))}
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium" htmlFor="engage-group">
                    From which persona group?
                  </label>
                  <div className="relative">
                    <Users className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      id="engage-group"
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                      className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value={ALL_GROUP}>All personas ({accounts.length})</option>
                      {groups.map(([name, count]) => (
                        <option key={name} value={name}>
                          {name} ({count})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {accountsQuery.isLoading
                      ? "Loading personas…"
                      : `Total personas in group: ${groupTotal}`}
                  </p>
                </div>
              </div>
              {!accountsQuery.isLoading && accounts.length === 0 && (
                <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  No persona accounts are linked yet.
                </p>
              )}
            </Step>

            <Step
              index={4}
              title="Engagement actions"
              description="Pick exactly what each persona should do."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {ACTION_CARDS.map((a) => {
                  const on = actions[a.key];
                  return (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setActions((prev) => ({ ...prev, [a.key]: !prev[a.key] }))}
                      className={cn(
                        "rounded-xl border p-4 text-left transition",
                        on
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-muted/40",
                      )}
                    >
                      <a.icon
                        className={cn("size-5", on ? "text-primary" : "text-muted-foreground")}
                      />
                      <p className="mt-2 text-sm font-medium">{a.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{a.hint}</p>
                    </button>
                  );
                })}
              </div>
              {activeActions.length === 0 && (
                <p className="text-xs text-destructive">Choose at least one action.</p>
              )}
            </Step>

            <Step index={5} title="Timing" description="When and how fast the campaign runs.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" htmlFor="engage-spread">
                    Spread window
                  </label>
                  <div className="relative">
                    <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      id="engage-spread"
                      value={spreadHours}
                      onChange={(e) => setSpreadHours(Number(e.target.value))}
                      className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {SPREAD_OPTIONS.map((h) => (
                        <option key={h} value={h}>
                          {spreadLabel(h)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium" htmlFor="engage-delay">
                    Delay between persona actions
                  </label>
                  <div className="relative">
                    <Zap className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      id="engage-delay"
                      value={delaySeconds}
                      onChange={(e) => setDelaySeconds(Number(e.target.value))}
                      disabled={spreadHours > 0}
                      className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {DELAY_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {delayLabel(d)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {spreadHours > 0
                      ? "The spread window already paces every action."
                      : delaySeconds === 0
                        ? "Actions run back to back right now."
                        : "Actions are queued with this gap between them."}
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={smartDelay}
                  onChange={(e) => setSmartDelay(e.target.checked)}
                  className="size-4 accent-[hsl(var(--primary))]"
                />
                Smart delays — add random jitter so the pattern never looks automated
              </label>
            </Step>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <LaunchActions
                scheduled={scheduled}
                busy={busy}
                disabled={!canRun}
                size="default"
                onLaunch={() => void runNow()}
                onQueue={() => scheduleMutation.mutate()}
                launchLabel="Run now"
                queueLabel="Queue campaign"
              />
              {!canRun && (
                <span className="text-xs text-muted-foreground">
                  {links.length === 0
                    ? "Add at least one post link."
                    : selected.length === 0
                      ? "Select at least one persona."
                      : "Choose at least one action."}
                </span>
              )}
            </div>

            {running && <PublishProgress label="Engaging across your personas" />}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* -------- summary column -------- */}
          <aside className="min-w-0 space-y-4 xl:sticky xl:top-24">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">Campaign summary</h2>
              <div className="mt-2 divide-y divide-border">
                <SummaryRow icon={Link2} label="Links queued" value={links.length} />
                <SummaryRow
                  icon={Heart}
                  label="Actions"
                  value={
                    activeActions.length > 0
                      ? activeActions.map((a) => a.label).join(" · ")
                      : "None selected"
                  }
                />
                <SummaryRow
                  icon={Users}
                  label="Personas selected"
                  value={`${selected.length} of ${groupTotal}`}
                />
                <SummaryRow icon={Users} label="Persona group" value={groupLabel} />
                <SummaryRow icon={Zap} label="Estimated total actions" value={totalActions} />
                <SummaryRow
                  icon={Clock}
                  label="Timing"
                  value={
                    spreadHours > 0
                      ? spreadLabel(spreadHours)
                      : delaySeconds > 0
                        ? delayLabel(delaySeconds)
                        : "Run now"
                  }
                />
                <SummaryRow
                  icon={Shield}
                  label="Safety"
                  value={smartDelay ? "Smart delays on" : "Smart delays off"}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">Live preview</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">How the engagement will appear</p>
              <div className="mt-4 rounded-xl border border-border p-4">
                {previewTweet ? (
                  <div className="space-y-2">
                    <ExternalIdentity
                      handle={previewTweet.authorHandle}
                      fallbackName={previewTweet.authorName ?? null}
                      avatarClassName="size-9"
                      nameClassName="truncate text-sm font-semibold"
                    />
                    <p className="whitespace-pre-wrap text-sm">{previewTweet.text}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Add a post link to see the post being engaged with.
                  </p>
                )}
                <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-muted-foreground">
                  {ACTION_CARDS.map((a) => (
                    <a.icon
                      key={a.key}
                      className={cn("size-4", actions[a.key] && "text-primary")}
                      aria-label={a.label}
                    />
                  ))}
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
                      and {Math.max(0, selected.length - 1)} more persona(s) will{" "}
                      {activeActions.map((a) => a.label.toLowerCase()).join(", ") || "act"}.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">Recent runs</h2>
              <ul className="mt-3 space-y-2">
                {engageRuns.slice(0, 8).map((j) => (
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
                {engageRuns.length === 0 && (
                  <li className="text-xs text-muted-foreground">No engagement runs yet.</li>
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
