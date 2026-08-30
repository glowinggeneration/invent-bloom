import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  ChevronDown,
  Clock,
  ImagePlus,
  Loader2,
  Send,
  Shield,
  Sparkles,
  TriangleAlert,
  Users,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { AccountIdentity } from "@/components/account-identity";
import { CampaignDialog } from "@/components/campaign-dialog";
import {
  CampaignHeader,
  LaunchActions,
  PersonaPicker,
  RunResults,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TWEET_LIMIT, textLength, type PublishJobResult } from "@/lib/publish";
import {
  listPublishJobs,
  listXAccounts,
  previewPersonaVariations,
  runPublish,
  uploadPublishMedia,
} from "@/lib/publish.functions";
import {
  DEFAULT_INTENSITY,
  INTENSITY_LABELS,
  INTENSITY_MAX,
  INTENSITY_MIN,
  TONE_OPTIONS,
  type PublishTone,
} from "@/lib/voice-controls";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/friendly-errors";

/**
 * /campaign/post — publish original posts from selected personas, either as
 * one written message or as an objective each persona writes in their voice.
 */
export function PostCampaign() {
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(listXAccounts);
  const fetchJobs = useServerFn(listPublishJobs);
  const publish = useServerFn(runPublish);
  const previewFn = useServerFn(previewPersonaVariations);
  const uploadMedia = useServerFn(uploadPublishMedia);

  const accountsQuery = useQuery({ queryKey: ["x-accounts"], queryFn: () => fetchAccounts() });
  const jobsQuery = useQuery({ queryKey: ["publish-jobs"], queryFn: () => fetchJobs() });
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  const personas = usePersonaSelection(accounts);
  const timing = useTiming(0);

  const [tweetText, setTweetText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [media, setMedia] = useState<{ url: string; name: string; kind: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list).slice(0, 4 - media.length);
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 15_000_000) {
          toast.error(`${file.name} is over 15MB. Choose a smaller file.`);
          continue;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read file."));
          reader.readAsDataURL(file);
        });
        const uploaded = await uploadMedia({ data: { fileName: file.name, dataUrl } });
        setMedia((prev) => [...prev, uploaded]);
      }
    } catch (e) {
      toast.error(
        friendlyError(e, { action: "upload this file", preserved: "Your message is still saved." }),
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Started from a news story or a mention: seed the composer once.
  const search = useSearch({ strict: false }) as { text?: string; link?: string };
  useEffect(() => {
    if (search.text) setTweetText((prev) => prev || search.text!);
    if (search.link) setLinkUrl((prev) => prev || search.link!);
  }, [search.text, search.link]);
  const [objectiveMode, setObjectiveMode] = useState(false);
  const [tone, setTone] = useState<PublishTone>("auto");
  const [intensity, setIntensity] = useState(DEFAULT_INTENSITY);
  const [variations, setVariations] = useState<
    {
      accountId: string;
      handle: string;
      personaId: string;
      personaName: string;
      tweetText: string;
      commentText: string;
    }[]
  >([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewApproved, setPreviewApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Any change to the message or voice invalidates the generated versions.
  useEffect(() => {
    setVariations([]);
    setPreviewApproved(false);
    setEditingId(null);
  }, [tweetText, objectiveMode, tone, intensity]);

  useEffect(() => {
    setPreviewApproved(false);
  }, [personas.selected.length]);

  /* ---- per-persona editing before anything goes out ---- */
  const setVariationText = (
    account: { id: string; handle: string; displayName: string; personaId?: string | null },
    text: string,
  ) =>
    setVariations((prev) =>
      prev.some((v) => v.accountId === account.id)
        ? prev.map((v) => (v.accountId === account.id ? { ...v, tweetText: text } : v))
        : [
            ...prev,
            {
              accountId: account.id,
              handle: account.handle,
              personaId: account.personaId ?? "",
              personaName: account.displayName,
              tweetText: text,
              commentText: "",
            },
          ],
    );

  const length = textLength(tweetText);
  const overLimit = !objectiveMode && length > TWEET_LIMIT;
  const [campaignName, setCampaignName] = useState("");
  const [startedOpen, setStartedOpen] = useState(false);
  const reviewed = variations.length > 0 && previewApproved;
  const canRun =
    tweetText.trim().length > 0 &&
    personas.selected.length > 0 &&
    !overLimit &&
    reviewed &&
    campaignName.trim().length > 0;
  const scheduled = timing.spreadHours > 0;

  const previewMutation = useMutation({
    mutationFn: () =>
      previewFn({
        data: {
          accountIds: personas.selected,
          tweetText,
          commentText: "",
          objectiveMode,
          tone,
          intensity,
        },
      }),
    onSuccess: (rows) => {
      setVariations(rows as never);
      setPreviewApproved(false);
    },
    onError: (e: Error) =>
      setError(
        friendlyError(e, {
          action: "preview these versions",
          preserved: "Your message is still saved.",
        }),
      ),
  });

  const [result, setResult] = useState<PublishJobResult | null>(null);

  const runMutation = useMutation({
    mutationFn: (opts: { now: boolean }) =>
      publish({
        data: {
          mode: "tweet" as const,
          name: campaignName.trim(),
          accountIds: personas.selected,
          tweetText,
          commentText: "",
          targetTweetUrl: "",
          linkUrl,
          imageUrls: media.map((m) => m.url),
          likeTarget: false,
          varyByPersona: true,
          spreadHours: opts.now ? 0 : timing.spreadHours,
          objectiveMode,
          tone,
          intensity,
          actions: { like: true, retweet: true, bookmark: false, follow: false },
          targets: { author: false, peer: true, watchlist: false },
          variations: variations.filter((v) => personas.selected.includes(v.accountId)),
        },
      }),
    onSuccess: (data, opts) => {
      setError(null);
      setResult(data ?? null);
      setStartedOpen(true);
      toast.success(opts.now || !scheduled ? "Posts published." : "Posts queued.");
      void queryClient.invalidateQueries({ queryKey: ["publish-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["scheduled-actions"] });
    },
    onError: (e: Error) =>
      setError(
        friendlyError(e, {
          action: "publish these posts",
          preserved: "Your draft is still saved.",
        }),
      ),
  });

  const postRuns = useMemo(
    () => (jobsQuery.data ?? []).filter((j) => j.mode === "tweet"),
    [jobsQuery.data],
  );

  const runButton = (
    <LaunchActions
      scheduled={scheduled}
      busy={runMutation.isPending}
      disabled={!canRun}
      onLaunch={() => runMutation.mutate({ now: true })}
      onQueue={() => runMutation.mutate({ now: false })}
      launchLabel="Post now"
      queueLabel="Queue posts"
    />
  );

  const firstPersona = personas.selectedAccounts[0] ?? null;
  const firstVariation = variations.find((v) => v.accountId === firstPersona?.id) ?? variations[0];

  return (
    <WorkspaceShell title="Post campaign">
      <CampaignRunningDialog open={startedOpen} onOpenChange={setStartedOpen} name={campaignName} />
      <div className="mx-auto w-full max-w-7xl pb-24">
        <CampaignHeader
          title="Post campaign"
          subtitle="Publish original posts from selected personas, in their own voice"
          goal="post"
          action={runButton}
        />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <CampaignNameStep
              index={1}
              value={campaignName}
              onChange={setCampaignName}
              placeholder="e.g. Harambee Stars matchday push"
            />

            <Step
              index={2}
              title="Message"
              description="Write the post, or set an objective each persona writes for themselves."
              aside={
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    overLimit ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {length}/{TWEET_LIMIT}
                </span>
              }
            >
              <div className="flex flex-wrap gap-2">
                {[
                  { on: false, label: "Exact message", hint: "Everyone posts this text" },
                  { on: true, label: "Objective", hint: "Each persona writes their own version" },
                ].map((opt) => (
                  <button
                    key={String(opt.on)}
                    type="button"
                    aria-pressed={objectiveMode === opt.on}
                    onClick={() => setObjectiveMode(opt.on)}
                    className={cn(
                      "flex-1 rounded-xl border p-3 text-left transition",
                      objectiveMode === opt.on
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{opt.hint}</p>
                  </button>
                ))}
              </div>

              <Textarea
                rows={5}
                value={tweetText}
                onChange={(e) => setTweetText(e.target.value)}
                placeholder={
                  objectiveMode
                    ? "e.g. Celebrate the Harambee Stars qualification and thank the fans."
                    : "Write the post exactly as it should appear…"
                }
                aria-label="Post message"
                className="resize-y"
              />

              <div className="space-y-1.5">
                <label className="text-xs font-medium" htmlFor="post-link">
                  Link to include (optional)
                </label>
                <Input
                  id="post-link"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://footballkenya.org/…"
                />
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || media.length >= 4}
                  className="inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ImagePlus className="size-4" />
                  )}
                  Add media (optional)
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,image/gif,video/*"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                />
                {media.length > 0 && (
                  <ul className="flex flex-wrap gap-3">
                    {media.map((m) => (
                      <li
                        key={m.url}
                        className="relative w-24 overflow-hidden rounded-xl border border-border bg-muted"
                      >
                        {m.kind === "video" ? (
                          <video
                            src={m.url}
                            className="h-16 w-full object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <img src={m.url} alt={m.name} className="h-16 w-full object-cover" />
                        )}
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded-full bg-background/90 p-1"
                          onClick={() => setMedia((p) => p.filter((x) => x.url !== m.url))}
                          aria-label={`Remove ${m.name}`}
                        >
                          <X className="size-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Every selected persona posts with this media attached.
                </p>
              </div>
            </Step>

            <Step index={3} title="Personas" description="Choose who will post.">
              <PersonaPicker
                id="post"
                selection={personas}
                loading={accountsQuery.isLoading}
                label="How many personas should post?"
              />
            </Step>

            <Step index={4} title="Voice" description="The tone personas adopt and how strongly.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" htmlFor="post-tone">
                    Tone
                  </label>
                  <div className="relative">
                    <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      id="post-tone"
                      value={tone}
                      onChange={(e) => setTone(e.target.value as PublishTone)}
                      className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {TONE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {TONE_OPTIONS.find((t) => t.value === tone)?.hint}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium" htmlFor="post-intensity">
                    Intensity — {INTENSITY_LABELS[intensity]}
                  </label>
                  <input
                    id="post-intensity"
                    type="range"
                    min={INTENSITY_MIN}
                    max={INTENSITY_MAX}
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="h-11 w-full accent-[hsl(var(--primary))]"
                  />
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                disabled={
                  !tweetText.trim() || personas.selected.length === 0 || previewMutation.isPending
                }
                onClick={() => previewMutation.mutate()}
              >
                {previewMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wand2 className="size-4" />
                )}
                Preview persona versions
              </Button>

              {variations.length > 0 && (
                <ul className="space-y-2">
                  {variations.map((v) => {
                    const editing = editingId === v.accountId;
                    const over = textLength(v.tweetText) > TWEET_LIMIT;
                    return (
                      <li key={v.accountId} className="rounded-xl border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-semibold">
                            @{v.handle}
                            {v.personaName ? ` · ${v.personaName}` : ""}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEditingId(editing ? null : v.accountId)}
                          >
                            {editing ? "Done" : "Edit"}
                          </Button>
                        </div>
                        {editing ? (
                          <>
                            <Textarea
                              rows={3}
                              value={v.tweetText}
                              onChange={(e) =>
                                setVariationText(
                                  {
                                    id: v.accountId,
                                    handle: v.handle,
                                    displayName: v.personaName,
                                    personaId: v.personaId,
                                  },
                                  e.target.value,
                                )
                              }
                              className="mt-2 text-sm"
                              aria-label={`Post for @${v.handle}`}
                            />
                            <p
                              className={cn(
                                "mt-1 text-right text-[11px] tabular-nums",
                                over ? "text-destructive" : "text-muted-foreground",
                              )}
                            >
                              {textLength(v.tweetText)}/{TWEET_LIMIT}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap text-sm">{v.tweetText}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Step>

            <Step index={5} title="Timing" description="Post together, or spread across a window.">
              <TimingFields id="post" timing={timing} showDelay={false} />
            </Step>

            {/* Review gate: every persona post is read (and edited) before it goes out */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold tracking-tight">Review before posting</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {variations.length === 0
                    ? "Preview the persona versions above, then edit any that need a change."
                    : `${variations.length} post(s) ready to review — edit any of them above.`}
                </p>
              </div>
              {variations.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    !tweetText.trim() || personas.selected.length === 0 || previewMutation.isPending
                  }
                  onClick={() => previewMutation.mutate()}
                >
                  {previewMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4 text-primary" />
                  )}
                  Preview persona versions
                </Button>
              ) : (
                <label className="inline-flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={previewApproved}
                    onChange={(e) => setPreviewApproved(e.target.checked)}
                    className="size-4 accent-[hsl(var(--primary))]"
                  />
                  I've reviewed these posts
                </label>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
              {runButton}
              {!canRun && (
                <span className="text-xs text-muted-foreground">
                  {tweetText.trim().length === 0
                    ? "Write a message or objective."
                    : overLimit
                      ? `Trim to ${TWEET_LIMIT} characters.`
                      : personas.selected.length === 0
                        ? "Select at least one persona."
                        : campaignName.trim().length === 0
                          ? "Name the campaign."
                          : variations.length === 0
                            ? "Preview the persona versions first."
                            : "Confirm you've reviewed these posts."}
                </span>
              )}
            </div>

            {runMutation.isPending && <PublishProgress label="Publishing across your personas" />}

            {result && <RunResults result={result} />}

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
                  label="Message mode"
                  value={objectiveMode ? "Objective" : "Exact message"}
                />
                <SummaryRow
                  icon={Users}
                  label="Personas selected"
                  value={`${personas.selected.length} of ${personas.groupTotal}`}
                />
                <SummaryRow icon={Users} label="Persona group" value={personas.groupLabel} />
                <SummaryRow icon={Zap} label="Posts to publish" value={personas.selected.length} />
                <SummaryRow
                  icon={Sparkles}
                  label="Voice"
                  value={`${TONE_OPTIONS.find((t) => t.value === tone)?.label} · ${INTENSITY_LABELS[intensity]}`}
                />
                {media.length > 0 && (
                  <SummaryRow icon={ImagePlus} label="Media" value={`${media.length} file(s)`} />
                )}
                <SummaryRow icon={Clock} label="Timing" value={timingLabel(timing)} />
                <SummaryRow
                  icon={Shield}
                  label="Safety"
                  value={scheduled ? "Spread across window" : "All at once"}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">Live preview</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">How the first post will read</p>
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
                  {firstVariation?.tweetText ||
                    (objectiveMode
                      ? "Preview persona versions to see the generated post."
                      : tweetText || "Your post will appear here.")}
                </p>
                {media.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {media
                      .slice(0, 4)
                      .map((m) =>
                        m.kind === "video" ? (
                          <video
                            key={m.url}
                            src={m.url}
                            className="h-20 w-full rounded-lg object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            key={m.url}
                            src={m.url}
                            alt={m.name}
                            className="h-20 w-full rounded-lg object-cover"
                          />
                        ),
                      )}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">Recent posts</h2>
              <ul className="mt-3 space-y-2">
                {postRuns.slice(0, 8).map((j) => (
                  <li key={j.id}>
                    <button
                      type="button"
                      onClick={() => setCampaignId(j.id)}
                      className="w-full rounded-xl border border-border/70 px-3 py-2 text-left text-xs transition hover:border-primary/50 hover:bg-muted/40"
                    >
                      <p className="truncate">{j.tweetText || j.objectiveText || "Post run"}</p>
                      <p className="mt-1 truncate text-muted-foreground">
                        {j.succeeded} delivered{j.failed > 0 ? ` · ${j.failed} in progress` : ""} ·{" "}
                        {new Date(j.createdAt).toLocaleString()}
                      </p>
                    </button>
                  </li>
                ))}
                {postRuns.length === 0 && (
                  <li className="text-xs text-muted-foreground">No posts yet.</li>
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
