import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Heart,
  Link2,
  Loader2,
  Plus,
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
import { Textarea } from "@/components/ui/textarea";
import { loadLikeQueue, parseLinks, saveLikeQueue, type QueuedLink } from "@/lib/like-queue";
import { getTweetPreview, listPublishJobs, listXAccounts } from "@/lib/publish.functions";
import { runEngageLinks, scheduleEngageLinks } from "@/lib/engage.functions";
import { friendlyError } from "@/lib/friendly-errors";

const LIKE_ONLY = { like: true, retweet: false, bookmark: false } as const;

/**
 * /campaign/like — a single-purpose workspace: paste post links, choose who
 * likes them and how the likes are paced. No reposts, no bookmarks.
 */
export function LikeCampaign() {
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(listXAccounts);
  const fetchJobs = useServerFn(listPublishJobs);
  const fetchTweetPreview = useServerFn(getTweetPreview);
  const likeNow = useServerFn(runEngageLinks);
  const scheduleLikes = useServerFn(scheduleEngageLinks);

  const accountsQuery = useQuery({ queryKey: ["x-accounts"], queryFn: () => fetchAccounts() });
  const jobsQuery = useQuery({ queryKey: ["publish-jobs"], queryFn: () => fetchJobs() });
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  const personas = usePersonaSelection(accounts);
  const timing = useTiming();

  const [links, setLinks] = useState<QueuedLink[]>([]);
  const linksRef = useRef<QueuedLink[]>([]);
  const [raw, setRaw] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);

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

  const firstLink = links[0]?.url ?? "";
  const preview = useQuery({
    queryKey: ["tweet-preview", firstLink],
    queryFn: () => fetchTweetPreview({ data: { url: firstLink } }),
    enabled: /status\/\d+/.test(firstLink),
    staleTime: 5 * 60 * 1000,
  });
  const previewTweet = preview.data?.tweet ?? null;
  const previewAccount = personas.selectedAccounts[0] ?? null;

  const totalActions = links.length * personas.selected.length;
  const scheduled = timing.spreadHours > 0 || timing.delaySeconds > 0;
  const canRun = links.length > 0 && personas.selected.length > 0;

  const scheduleMutation = useMutation({
    mutationFn: () =>
      scheduleLikes({
        data: {
          tweetUrls: links.map((l) => l.url),
          accountIds: personas.selected,
          actions: { ...LIKE_ONLY },
          spreadHours: timing.spreadHours,
          delaySeconds: timing.delaySeconds,
          smartDelay: timing.smartDelay,
        },
      }),
    onSuccess: (res) => {
      setError(null);
      updateLinks((items) => items.map((i) => ({ ...i, status: "done" as const })));
      toast.success(`${res.scheduled} like(s) queued.`);
      void queryClient.invalidateQueries({ queryKey: ["scheduled-actions"] });
    },
    onError: (e: Error) =>
      setError(
        friendlyError(e, { action: "queue these likes", preserved: "Your queue is still saved." }),
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
          const res = await likeNow({
            data: { tweetUrls: [url], accountIds: personas.selected, actions: { ...LIKE_ONLY } },
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
                    error: friendlyError(e, { action: "like this link" }),
                  }
                : x,
            ),
          );
          setError(
            friendlyError(e, {
              action: "finish this run",
              preserved: "The links already liked are still saved.",
            }),
          );
          break;
        }
      }
      toast.success("Like run finished.");
      void queryClient.invalidateQueries({ queryKey: ["publish-jobs"] });
    } finally {
      setRunning(false);
    }
  }

  const likeRuns = useMemo(
    () => (jobsQuery.data ?? []).filter((j) => String(j.mode) === "engagement"),
    [jobsQuery.data],
  );

  const busy = running || scheduleMutation.isPending;
  const runButton = (
    <LaunchActions
      scheduled={scheduled}
      busy={busy}
      disabled={!canRun}
      onLaunch={() => void runNow()}
      onQueue={() => scheduleMutation.mutate()}
      launchLabel="Like now"
      queueLabel="Queue likes"
    />
  );

  return (
    <WorkspaceShell title="Like campaign">
      <div className="mx-auto w-full max-w-7xl pb-24">
        <CampaignHeader
          title="Like campaign"
          subtitle="Like specific posts with selected personas, paced naturally"
          goal="like"
          action={runButton}
        />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <Step
              index={1}
              title="Posts to like"
              description="Paste one or more post links. Each is liked in turn."
              aside={
                <span className="text-xs text-muted-foreground">
                  {links.length} queued · {links.filter((l) => l.status !== "done").length} pending
                </span>
              }
            >
              <Textarea
                rows={3}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="https://x.com/user/status/123…"
                aria-label="Post links to like"
                className="resize-y"
              />
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Button size="sm" variant="outline" onClick={addLinks}>
                  <Plus className="size-4" /> Add links
                </Button>
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
                        <TriangleAlert className="size-3.5 shrink-0 text-destructive" />
                      ) : (
                        <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{l.url}</span>
                      {l.status === "done" && (
                        <span className="shrink-0 text-muted-foreground">
                          {l.ok} ok · {l.failed} failed
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
            </Step>

            <Step index={2} title="Personas" description="Choose who will like these posts.">
              <PersonaPicker
                id="like"
                selection={personas}
                loading={accountsQuery.isLoading}
                label="How many personas should like?"
              />
            </Step>

            <Step index={3} title="Timing" description="How the likes are spaced out.">
              <TimingFields id="like" timing={timing} />
            </Step>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
              {runButton}
              {!canRun && (
                <span className="text-xs text-muted-foreground">
                  {links.length === 0
                    ? "Add at least one post link."
                    : "Select at least one persona."}
                </span>
              )}
            </div>

            {running && <PublishProgress label="Liking across your personas" />}

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
                <SummaryRow icon={Link2} label="Posts queued" value={links.length} />
                <SummaryRow
                  icon={Users}
                  label="Personas selected"
                  value={`${personas.selected.length} of ${personas.groupTotal}`}
                />
                <SummaryRow icon={Users} label="Persona group" value={personas.groupLabel} />
                <SummaryRow icon={Zap} label="Estimated likes" value={totalActions} />
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
              <p className="mt-0.5 text-xs text-muted-foreground">The post being liked</p>
              <div className="mt-4 rounded-xl border border-border p-4">
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
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-primary">
                  <Heart className="size-4" aria-hidden="true" />
                  <span className="text-xs font-medium">
                    {personas.selected.length} like(s) from your personas
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
                      and {Math.max(0, personas.selected.length - 1)} more persona(s) will like
                      this.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">Recent runs</h2>
              <ul className="mt-3 space-y-2">
                {likeRuns.slice(0, 8).map((j) => (
                  <li key={j.id}>
                    <button
                      type="button"
                      onClick={() => setCampaignId(j.id)}
                      className="w-full rounded-xl border border-border/70 px-3 py-2 text-left text-xs transition hover:border-primary/50 hover:bg-muted/40"
                    >
                      <p className="truncate">{j.targetTweetUrl || "Engagement run"}</p>
                      <p className="mt-1 truncate text-muted-foreground">
                        {j.succeeded} ok · {j.failed} failed ·{" "}
                        {new Date(j.createdAt).toLocaleString()}
                      </p>
                    </button>
                  </li>
                ))}
                {likeRuns.length === 0 && (
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
