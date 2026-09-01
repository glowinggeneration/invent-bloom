import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Columns2,
  BarChart3,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Clock,
  Heart,
  ImagePlus,
  Link2,
  Loader2,
  MessageCircle,
  Repeat2,
  Send,
  Share,
  Shield,
  Sparkles,
  TriangleAlert,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AccountIdentity } from "@/components/account-identity";
import { ExternalIdentity } from "@/components/external-identity";
import { CampaignDialog } from "@/components/campaign-dialog";
import { GoalSwitcher } from "@/components/publish-goals";
import {
  CampaignRunningDialog,
  LaunchActions,
  PersonaPicker,
  RunResults,
  usePersonaSelection,
} from "@/components/campaign-kit";
import { PublishProgress } from "@/components/publish-progress";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  clearPublishDraft,
  isDraftEmpty,
  loadPublishDraft,
  savePublishDraft,
} from "@/lib/publish-draft";
import { TWEET_LIMIT, textLength, type PublishJobResult } from "@/lib/publish";
import {
  getTweetPreview,
  listPublishJobs,
  listXAccounts,
  previewPersonaVariations,
  runPublish,
  uploadPublishMedia,
} from "@/lib/publish.functions";
import { suggestReplyDraft } from "@/lib/reply-suggestion.functions";
import { SPREAD_OPTIONS, spreadLabel } from "@/lib/spread";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/friendly-errors";
import {
  DEFAULT_INTENSITY,
  DEFAULT_TONE,
  INTENSITY_MAX,
  INTENSITY_MIN,
  TONE_OPTIONS,
  clampIntensity,
  intensityLabel,
  toneOption,
  type PublishTone,
} from "@/lib/voice-controls";

type MediaItem = { url: string; name: string; kind: string };

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
 * Dedicated /campaign/reply workspace. UI only — every control is wired to the
 * same production server functions the shared publish workspace uses.
 */
export function ReplyCampaign() {
  const search = useSearch({ strict: false }) as {
    text?: string;
    target?: string;
    image?: string;
  };
  const initialText = search.text;
  const initialTarget = search.target;
  const initialImage = search.image;
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(listXAccounts);
  const fetchJobs = useServerFn(listPublishJobs);
  const publish = useServerFn(runPublish);
  const uploadMedia = useServerFn(uploadPublishMedia);
  const previewFn = useServerFn(previewPersonaVariations);
  const fetchTweetPreview = useServerFn(getTweetPreview);
  const suggestReply = useServerFn(suggestReplyDraft);

  const accountsQuery = useQuery({ queryKey: ["x-accounts"], queryFn: () => fetchAccounts() });
  const jobsQuery = useQuery({ queryKey: ["publish-jobs"], queryFn: () => fetchJobs() });
  // Suspended personas can no longer act on X, so they never take part.
  const accounts = useMemo(
    () => (accountsQuery.data ?? []).filter((a) => !a.suspended),
    [accountsQuery.data],
  );

  const [targetTweetUrl, setTargetTweetUrl] = useState(initialTarget ?? "");
  const [commentText, setCommentText] = useState(initialText ?? "");
  const [briefing, setBriefing] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>(
    initialImage
      ? [
          {
            url: initialImage,
            name: "Attached image",
            kind: /\.(mp4|mov|webm)$/i.test(initialImage) ? "video" : "image",
          },
        ]
      : [],
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [likeTarget, setLikeTarget] = useState(true);
  const [tone, setTone] = useState<PublishTone>(DEFAULT_TONE);
  const [intensity, setIntensity] = useState(DEFAULT_INTENSITY);
  const [spreadHours, setSpreadHours] = useState(0);
  const [variations, setVariations] = useState<
    {
      accountId: string;
      personaName: string;
      tweetText: string;
      commentText: string;
      handle: string;
      personaId: string;
    }[]
  >([]);
  const [result, setResult] = useState<PublishJobResult | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [startedOpen, setStartedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  // Nothing is tweeted until the generated replies have been previewed and
  // signed off, so wording is always reviewed first.
  const [previewApproved, setPreviewApproved] = useState(false);
  // Suggested reply drafted from the post being answered.
  const [suggestion, setSuggestion] = useState<{
    objective: string;
    reply: string;
    rationale: string;
    notice: string | null;
  } | null>(null);

  /* ---- persona selection: shared group / hand-picked picker ---- */
  const personas = usePersonaSelection(accountsQuery.data ?? []);

  const groupTotal = personas.groupTotal;
  const selected = personas.selected;

  /* ---- draft autosave (same local store the composer already uses) ---- */
  const draftLoaded = useRef(false);
  useEffect(() => {
    if (draftLoaded.current) return;
    draftLoaded.current = true;
    if (initialText || initialTarget || initialImage) return;
    const draft = loadPublishDraft();
    if (!draft || isDraftEmpty(draft)) return;
    setCommentText(draft.commentText);
    setTargetTweetUrl(draft.targetTweetUrl);
    setLinkUrl(draft.linkUrl);
    if (draft.linkUrl) setShowLink(true);
    setMedia(
      draft.media.map((m) => ({
        url: m.url,
        name: m.name ?? "Attachment",
        kind: m.kind ?? "image",
      })),
    );
    setLikeTarget(draft.likeTarget);
    if (draft.tone) setTone(draft.tone as PublishTone);
    if (typeof draft.intensity === "number") setIntensity(clampIntensity(draft.intensity));
    setDraftSavedAt(draft.savedAt || Date.now());
  }, [initialText, initialTarget, initialImage]);

  const snapshot = useMemo(
    () => ({
      mode: "comment",
      tweetText: "",
      commentText,
      targetTweetUrl,
      linkUrl,
      media,
      likeTarget,
      varyByPersona: true,
      objectiveMode: false,
      tone,
      intensity,
      actions: { like: likeTarget, retweet: false, bookmark: false, follow: false },
      targets: { author: true, peer: false, watchlist: false },
      selected,
    }),
    [commentText, targetTweetUrl, linkUrl, media, likeTarget, tone, intensity, selected],
  );

  function saveDraftNow() {
    if (isDraftEmpty(snapshot)) {
      toast.error("Nothing to save yet.");
      return;
    }
    const at = savePublishDraft(snapshot);
    if (at) setDraftSavedAt(at);
    toast.success("Draft saved.");
  }

  useEffect(() => {
    if (!draftLoaded.current) return;
    const timer = setTimeout(() => {
      if (isDraftEmpty(snapshot)) {
        clearPublishDraft();
        setDraftSavedAt(null);
        return;
      }
      const at = savePublishDraft(snapshot);
      if (at) setDraftSavedAt(at);
    }, 800);
    return () => clearTimeout(timer);
  }, [snapshot]);

  function discardDraft() {
    clearPublishDraft();
    setCommentText("");
    setTargetTweetUrl("");
    setLinkUrl("");
    setMedia([]);
    setVariations([]);
    setDraftSavedAt(null);
    toast.success("Draft discarded.");
  }

  /* ---- media upload ---- */
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

  /* ---- persona variations ---- */
  const variationsMutation = useMutation({
    mutationFn: () =>
      previewFn({
        data: {
          accountIds: selected,
          tweetText: "",
          commentText,
          briefing,
          objectiveMode: false,
          tone,
          intensity,
        },
      }),
    onSuccess: (data) => {
      setVariations(data);
      setPreviewApproved(false);
    },
    onError: (e: Error) =>
      toast.error(
        friendlyError(e, {
          action: "generate these variations",
          preserved: "Your message is still saved.",
        }),
      ),
  });

  useEffect(() => {
    setVariations([]);
    setPreviewApproved(false);
  }, [commentText, briefing, tone, intensity]);

  useEffect(() => {
    setPreviewApproved(false);
  }, [selected.length]);

  // Auto-write one distinct reply per persona once a message and personas are
  // in place, so the preview never shows the same copy repeated.
  const autoKey = `${commentText.trim()}|${briefing}|${tone}|${intensity}|${selected.length}`;
  const autoRef = useRef<string>("");
  const runVariations = variationsMutation.mutate;
  const isGenerating = variationsMutation.isPending;
  useEffect(() => {
    if (commentText.trim().length < 8 || selected.length === 0) return;
    if (variations.length > 0 || isGenerating) return;
    if (autoRef.current === autoKey) return;
    const t = setTimeout(() => {
      autoRef.current = autoKey;
      runVariations();
    }, 900);
    return () => clearTimeout(t);
  }, [autoKey, commentText, selected.length, variations.length, isGenerating, runVariations]);

  /* ---- target tweet preview ---- */
  const trimmedTarget = targetTweetUrl.trim();
  const targetPreview = useQuery({
    queryKey: ["tweet-preview", trimmedTarget],
    queryFn: () => fetchTweetPreview({ data: { url: trimmedTarget } }),
    enabled: /status\/\d+/.test(trimmedTarget),
    staleTime: 5 * 60 * 1000,
  });
  const previewTweet = targetPreview.data?.tweet ?? null;

  /* ---- suggested reply + objective, drafted from the post being answered ---- */
  const suggestionMutation = useMutation({
    mutationFn: (vars: { url: string; apply: boolean }) =>
      suggestReply({ data: { targetUrl: vars.url, guidance: briefing || null } }),
    onSuccess: (data, vars) => {
      setSuggestion({
        objective: data.objective,
        reply: data.reply,
        rationale: data.rationale,
        notice: data.notice,
      });
      if (vars.apply || !commentText.trim()) {
        if (data.reply) setCommentText(data.reply);
        if (data.objective && !briefing.trim()) setBriefing(data.objective);
      }
    },
    onError: () =>
      toast.error("We couldn't draft a suggestion. Your message is still saved. Try again."),
  });
  const suggestNow = suggestionMutation.mutate;
  const suggesting = suggestionMutation.isPending;

  // Arriving from a mention: draft a suggestion straight away so the composer
  // opens with something to edit rather than an empty box.
  const suggestedFor = useRef<string>("");
  useEffect(() => {
    if (!/status\/\d+/.test(trimmedTarget)) return;
    if (commentText.trim().length > 0) return;
    if (suggestedFor.current === trimmedTarget || suggesting) return;
    suggestedFor.current = trimmedTarget;
    suggestNow({ url: trimmedTarget, apply: true });
  }, [trimmedTarget, commentText, suggesting, suggestNow]);

  /* ---- per-persona preview editing ---- */
  const setVariationText = (
    a: { id: string; handle: string; displayName: string; personaId?: string | null },
    text: string,
  ) =>
    setVariations((prev) => {
      const existing = prev.find((v) => v.accountId === a.id);
      if (existing) {
        return prev.map((v) => (v.accountId === a.id ? { ...v, commentText: text } : v));
      }
      return [
        ...prev,
        {
          accountId: a.id,
          personaName: a.displayName,
          tweetText: "",
          commentText: text,
          handle: a.handle,
          personaId: a.personaId ?? "",
        },
      ];
    });

  const remaining = TWEET_LIMIT - textLength(commentText);
  const reviewed = variations.length > 0 && previewApproved;
  const canSubmit =
    reviewed &&
    campaignName.trim().length > 0 &&
    selected.length > 0 &&
    commentText.trim().length > 0 &&
    trimmedTarget.length > 0 &&
    remaining >= 0;

  const publishMutation = useMutation({
    mutationFn: (opts: { now: boolean; spread?: number }) =>
      publish({
        data: {
          mode: "comment",
          name: campaignName.trim(),
          accountIds: selected,
          tweetText: "",
          commentText,
          briefing,
          targetTweetUrl,
          linkUrl,
          imageUrls: media.map((m) => m.url),
          likeTarget,
          varyByPersona: true,
          objectiveMode: false,
          tone,
          intensity,
          spreadHours: opts.now ? 0 : (opts.spread ?? spreadHours),
          actions: { like: likeTarget, retweet: false, bookmark: false, follow: false },
          targets: { author: true, peer: false, watchlist: false },
          variations,
        },
      }),
    onSuccess: (data, opts) => {
      setResult(data);
      setError(null);
      setStartedOpen(true);
      clearPublishDraft();
      setDraftSavedAt(null);
      void queryClient.invalidateQueries({ queryKey: ["publish-jobs"] });
      if (!opts.now && spreadHours > 0) {
        toast.success(
          `${data.actions.filter((a) => a.status === "pending").length} reply(s) queued across the next ${spreadHours}h.`,
        );
      } else {
        toast.success(`${data.succeeded} reply action(s) scheduled.`);
      }
    },
    onError: (e: Error) => {
      setResult(null);
      setError(
        friendlyError(e, {
          action: "publish these replies",
          preserved: "Your draft is still saved.",
        }),
      );
    },
  });

  const replyRuns = useMemo(
    () => (jobsQuery.data ?? []).filter((j) => j.mode === "comment" || j.mode === "both"),
    [jobsQuery.data],
  );

  const groupLabel = personas.groupLabel;
  const requirementsReady = [
    campaignName.trim().length > 0,
    trimmedTarget.length > 0,
    commentText.trim().length > 0 && remaining >= 0,
    selected.length > 0,
    reviewed,
  ].filter(Boolean).length;
  const setupSteps = [
    { id: "reply-details", label: "Details" },
    { id: "reply-personas", label: "Personas" },
    { id: "reply-voice", label: "Voice" },
    { id: "reply-timing", label: "Timing" },
    { id: "reply-review", label: "Review" },
  ];
  const queueReplies = () => {
    const spread = spreadHours === 0 ? 4 : spreadHours;
    if (spreadHours === 0) setSpreadHours(4);
    publishMutation.mutate({ now: false, spread });
  };

  return (
    <WorkspaceShell title="Reply campaign">
      <CampaignRunningDialog open={startedOpen} onOpenChange={setStartedOpen} name={campaignName} />
      <div className="mx-auto w-full max-w-7xl pb-24">
        {/* Header */}
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
            <h1 className="truncate text-lg font-semibold tracking-tight">Reply campaign</h1>
            <p className="truncate text-xs text-muted-foreground">
              Create persona replies to a specific tweet
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GoalSwitcher goal="reply" />
            <Button variant="outline" size="sm" onClick={saveDraftNow}>
              <Upload className="size-4" /> Save draft
            </Button>
            <LaunchActions
              scheduled={spreadHours > 0}
              busy={publishMutation.isPending}
              disabled={!canSubmit}
              onLaunch={() => publishMutation.mutate({ now: true })}
              onQueue={queueReplies}
              launchLabel="Publish now"
              queueLabel="Queue replies"
            />
          </div>
        </header>

        <div className="sticky top-16 z-10 mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <nav
            className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1"
            aria-label="Reply campaign setup steps"
          >
            {setupSteps.map((step, index) => (
              <a
                key={step.id}
                href={`#${step.id}`}
                className="flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="grid size-5 place-items-center rounded-full bg-muted text-[11px] text-foreground">
                  {index + 1}
                </span>
                {step.label}
              </a>
            ))}
          </nav>
          <span className="shrink-0 px-2 text-xs font-medium text-muted-foreground">
            {requirementsReady} of 5 requirements ready
          </span>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* -------- form column -------- */}
          <div className="min-w-0 space-y-4">
            <div id="reply-details" className="scroll-mt-36">
              <Step
                index={1}
                title="Campaign details"
                description="Name the run, choose the conversation and define the reply."
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" htmlFor="reply-campaign-name">
                    Campaign name
                  </label>
                  <Input
                    id="reply-campaign-name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value.slice(0, 80))}
                    placeholder="e.g. Reply to league fixture backlash"
                    className="max-w-md"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Used to find this run again in Campaigns and Performance.
                  </p>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <div>
                    <p className="text-xs font-medium">Target conversation</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Add the X post your personas should reply to.
                    </p>
                  </div>
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={targetTweetUrl}
                      onChange={(e) => setTargetTweetUrl(e.target.value)}
                      placeholder="https://x.com/user/status/123…"
                      className="h-11 pl-9"
                      aria-label="Target tweet link"
                    />
                    {targetPreview.isFetching && (
                      <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {trimmedTarget && targetPreview.data?.error && (
                    <p className="text-xs text-destructive">{targetPreview.data.error}</p>
                  )}
                </div>

                <div className="space-y-4 border-t border-border pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium">Reply message</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Write the base message and optional direction for each persona.
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        remaining < 0 ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {textLength(commentText)} / {TWEET_LIMIT}
                    </span>
                  </div>
                  {suggesting || suggestion ? (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
                          <Sparkles className="size-4" aria-hidden="true" />
                          Suggested response
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={suggesting || !/status\/\d+/.test(trimmedTarget)}
                          onClick={() => suggestNow({ url: trimmedTarget, apply: true })}
                        >
                          {suggesting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                          {suggesting ? "Drafting…" : "Suggest again"}
                        </Button>
                      </div>
                      {suggestion ? (
                        <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                          {suggestion.objective ? (
                            <p>
                              <span className="font-semibold text-foreground">Objective: </span>
                              {suggestion.objective}
                            </p>
                          ) : null}
                          {suggestion.rationale ? <p>{suggestion.rationale}</p> : null}
                          {suggestion.notice ? (
                            <p className="text-destructive">{suggestion.notice}</p>
                          ) : null}
                          <p>Edit the draft below before anything is sent.</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Reading the post and drafting a reply and objective…
                        </p>
                      )}
                    </div>
                  ) : null}

                  <Textarea
                    rows={4}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="What the personas should reply…"
                    className="resize-y"
                    aria-label="Reply message"
                  />

                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <label htmlFor="persona-briefing" className="text-xs font-medium">
                      Brief your personas (optional)
                    </label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Tell them how to frame their replies - angle, what to avoid, what to
                      emphasise.
                    </p>
                    <Textarea
                      id="persona-briefing"
                      rows={3}
                      value={briefing}
                      onChange={(e) => setBriefing(e.target.value)}
                      placeholder="e.g. Stay supportive of the federation, question the reporting, no insults, mention grassroots football."
                      className="mt-2 resize-y"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setShowLink((v) => !v)}
                      className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-foreground"
                    >
                      <Link2 className="size-4" /> Add link (optional)
                    </button>
                    <span className="hidden h-4 w-px bg-border sm:block" />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || media.length >= 4}
                      className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                    >
                      {uploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ImagePlus className="size-4" />
                      )}
                      Add media (optional)
                    </button>
                    <button
                      type="button"
                      onClick={() => variationsMutation.mutate()}
                      disabled={
                        variationsMutation.isPending ||
                        selected.length === 0 ||
                        commentText.trim().length === 0
                      }
                      className="ml-auto inline-flex items-center gap-2 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                    >
                      {variationsMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4 text-primary" />
                      )}
                      Add variations
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,image/gif,video/*"
                      multiple
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                  </div>

                  {showLink && (
                    <Input
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://footballkenya.org/…"
                      aria-label="Link to append"
                    />
                  )}

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

                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={likeTarget}
                      onChange={(e) => setLikeTarget(e.target.checked)}
                      className="size-4 accent-[hsl(var(--primary))]"
                    />
                    Also like the target tweet from each account
                  </label>

                  {variations.length > 0 && (
                    <details className="rounded-xl border border-border bg-muted/30 p-3">
                      <summary className="cursor-pointer text-xs font-medium">
                        {variations.length} persona variation{variations.length === 1 ? "" : "s"}{" "}
                        ready
                      </summary>
                      <ul className="mt-3 space-y-2">
                        {variations.map((v) => (
                          <li key={v.accountId} className="rounded-lg bg-background p-2 text-xs">
                            <span className="font-medium">{v.personaName || v.handle}</span>
                            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                              {v.commentText}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </Step>
            </div>

            <div id="reply-personas" className="scroll-mt-36">
              <Step index={2} title="Personas" description="Choose who will reply.">
                <PersonaPicker
                  id="reply-personas-picker"
                  selection={personas}
                  loading={accountsQuery.isLoading}
                  label="How many personas should respond?"
                />
              </Step>
            </div>

            <div id="reply-voice" className="scroll-mt-36">
              <Step
                index={3}
                title="Voice"
                description="Control how your personas write and sound."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" htmlFor="reply-tone">
                      Tone
                    </label>
                    <div className="relative">
                      <select
                        id="reply-tone"
                        value={tone}
                        onChange={(e) => setTone(e.target.value as PublishTone)}
                        className="h-11 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {TONE_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{toneOption(tone).hint}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium" htmlFor="reply-intensity">
                        Intensity
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        {intensityLabel(intensity)}
                      </span>
                    </div>
                    <input
                      id="reply-intensity"
                      type="range"
                      min={INTENSITY_MIN}
                      max={INTENSITY_MAX}
                      step={1}
                      value={intensity}
                      onChange={(e) => setIntensity(clampIntensity(e.target.value))}
                      className="h-2 w-full cursor-pointer accent-[hsl(var(--primary))]"
                      aria-valuetext={intensityLabel(intensity)}
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Subtle</span>
                      <span>Full</span>
                    </div>
                  </div>
                </div>
              </Step>
            </div>

            <div id="reply-timing" className="scroll-mt-36">
              <Step index={4} title="Timing" description="Choose paced queueing or a fixed spread.">
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={spreadHours}
                    onChange={(e) => setSpreadHours(Number(e.target.value))}
                    aria-label="Timing"
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
                <p className="text-[11px] text-muted-foreground">
                  Queueing spaces replies across the selected window so they do not publish in one
                  burst. Publish now remains a deliberate immediate action.
                </p>
              </Step>
            </div>

            <div id="reply-review" className="scroll-mt-36">
              <Step
                index={5}
                title="Review and publish"
                description="Read every persona reply before anything is published or queued."
                aside={
                  <span className="text-xs font-medium text-muted-foreground">
                    {requirementsReady} of 5 ready
                  </span>
                }
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Persona replies</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {variations.length === 0
                        ? "Generate the replies, then edit anything that needs a change."
                        : `${variations.length} reply(s) are ready for final review.`}
                    </p>
                  </div>
                  {variations.length === 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => variationsMutation.mutate()}
                      disabled={
                        variationsMutation.isPending ||
                        selected.length === 0 ||
                        commentText.trim().length === 0
                      }
                    >
                      {variationsMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4 text-primary" />
                      )}
                      Generate replies
                    </Button>
                  ) : (
                    <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={previewApproved}
                        onChange={(e) => setPreviewApproved(e.target.checked)}
                        className="size-4 accent-[hsl(var(--primary))]"
                      />
                      Reviewed and approved
                    </label>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                  <LaunchActions
                    scheduled
                    size="default"
                    busy={publishMutation.isPending}
                    disabled={!canSubmit}
                    onLaunch={() => publishMutation.mutate({ now: true })}
                    onQueue={queueReplies}
                    launchLabel="Publish now"
                    queueLabel="Add to queue"
                  />
                  <span className="text-xs text-muted-foreground">
                    {!campaignName.trim()
                      ? "Name the campaign."
                      : !trimmedTarget
                        ? "Add the target conversation."
                        : !commentText.trim()
                          ? "Write the reply message."
                          : remaining < 0
                            ? `Trim the reply to ${TWEET_LIMIT} characters.`
                            : selected.length === 0
                              ? "Select at least one persona."
                              : variations.length === 0
                                ? "Generate the persona replies."
                                : !previewApproved
                                  ? "Confirm that every reply has been reviewed."
                                  : "Ready for an authorised launch."}
                  </span>
                  <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                    {draftSavedAt && (
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        Draft saved{" "}
                        {new Date(draftSavedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={discardDraft}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              </Step>
            </div>

            {publishMutation.isPending && (
              <PublishProgress label="Publishing replies across your personas" />
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {result && <RunResults result={result} />}
          </div>

          {/* -------- preview / summary column -------- */}
          <aside className="min-w-0 xl:sticky xl:top-32">
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">Reply overview</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Check the setup and generated replies before launch.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {requirementsReady}/5 ready
                </span>
              </div>

              <div className="mt-2 divide-y divide-border">
                <SummaryRow
                  icon={Users}
                  label="Personas selected"
                  value={`${selected.length} of ${groupTotal}`}
                />
                <SummaryRow icon={Users} label="Persona group" value={groupLabel} />
                <SummaryRow
                  icon={MessageCircle}
                  label="Estimated replies"
                  value={selected.length}
                />
                {likeTarget && (
                  <SummaryRow icon={Heart} label="Likes on target" value={selected.length} />
                )}
                <SummaryRow icon={Clock} label="Timing" value={spreadLabel(spreadHours)} />
                <SummaryRow
                  icon={Shield}
                  label="Pacing"
                  value={
                    spreadHours > 0 ? `${spreadHours}h controlled spread` : "Automatic spacing"
                  }
                />
                <SummaryRow
                  icon={Sparkles}
                  label="Variations"
                  value={variations.length > 0 ? `${variations.length} ready` : "Auto per persona"}
                />
                {media.length > 0 && (
                  <SummaryRow icon={ImagePlus} label="Media" value={`${media.length} file(s)`} />
                )}
              </div>

              <div className="mt-5 border-t border-border pt-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold tracking-tight">Live preview</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Review and edit each persona reply.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCompare((v) => !v)}
                      aria-pressed={compare}
                      className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                    >
                      <Columns2 className="size-4" />
                      {compare ? "Stacked view" : "Compare side by side"}
                    </button>
                    <button
                      type="button"
                      onClick={() => variationsMutation.mutate()}
                      disabled={
                        variationsMutation.isPending ||
                        selected.length === 0 ||
                        commentText.trim().length === 0
                      }
                      className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                    >
                      {variationsMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4 text-primary" />
                      )}
                      Generate per persona
                    </button>
                  </div>
                </div>

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
                      <div className="flex items-center gap-6 pt-1 text-muted-foreground">
                        <MessageCircle className="size-4" />
                        <Repeat2 className="size-4" />
                        <Heart className="size-4" />
                        <Bookmark className="size-4" />
                        <Share className="size-4" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Paste a tweet link to see the post being replied to.
                    </p>
                  )}

                  <div
                    className={
                      compare
                        ? "mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
                        : "mt-4 space-y-3 border-t border-border pt-4"
                    }
                  >
                    {personas.selectedAccounts.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Select personas to see how each one will reply.
                      </p>
                    )}
                    {personas.selectedAccounts.slice(0, 30).map((a) => {
                      const variation = variations.find((v) => v.accountId === a.id);
                      const text = [(variation?.commentText ?? commentText).trim(), linkUrl.trim()]
                        .filter(Boolean)
                        .join("\n\n");
                      const editing = editingId === a.id;
                      return (
                        <div
                          key={a.id}
                          className={
                            compare
                              ? "rounded-xl border border-border p-3"
                              : "border-l-2 border-border pl-3"
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <AccountIdentity
                              handle={a.handle}
                              displayName={a.displayName}
                              avatarUrl={a.avatarUrl}
                              avatarClassName="size-9"
                              nameClassName="truncate text-sm font-semibold"
                            />
                            <button
                              type="button"
                              onClick={() => setEditingId(editing ? null : a.id)}
                              className="shrink-0 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            >
                              {editing ? "Done" : "Edit"}
                            </button>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {personas.groupFor(a)}
                            </span>
                            {a.personaLabel && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                {a.personaLabel}
                              </span>
                            )}
                          </div>
                          {editing ? (
                            <Textarea
                              rows={3}
                              value={variation?.commentText ?? commentText}
                              onChange={(e) => setVariationText(a, e.target.value)}
                              className="mt-2 text-sm"
                              aria-label={`Reply for ${a.displayName}`}
                            />
                          ) : (
                            <p className="mt-2 whitespace-pre-wrap text-sm">
                              {text || (
                                <span className="text-muted-foreground">
                                  Their reply will appear here.
                                </span>
                              )}
                            </p>
                          )}
                          {media.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
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
                          <div className="flex items-center gap-6 pt-3 text-muted-foreground">
                            <MessageCircle className="size-4" />
                            <Repeat2 className="size-4" />
                            <Heart className="size-4" />
                            <BarChart3 className="size-4" />
                            <Share className="size-4" />
                          </div>
                        </div>
                      );
                    })}
                    {personas.selectedAccounts.length > 30 && (
                      <p className="text-[11px] text-muted-foreground">
                        Showing 30 of {personas.selectedAccounts.length} personas.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <details className="mt-5 border-t border-border pt-5">
                <summary className="cursor-pointer text-sm font-semibold">
                  Past reply runs ({replyRuns.length})
                </summary>
                <ul className="mt-3 space-y-2">
                  {replyRuns.slice(0, 20).map((j) => (
                    <li key={j.id}>
                      <button
                        type="button"
                        onClick={() => setCampaignId(j.id)}
                        className="w-full rounded-xl border border-border/70 px-3 py-2 text-left text-xs transition hover:border-primary/50 hover:bg-muted/40"
                      >
                        <p className="truncate">{j.commentText || j.tweetText || "Reply run"}</p>
                        <p className="mt-1 truncate text-muted-foreground">
                          {j.succeeded} delivered
                          {j.failed > 0 ? ` · ${j.failed} in progress` : ""} ·{" "}
                          {new Date(j.createdAt).toLocaleString()}
                        </p>
                      </button>
                    </li>
                  ))}
                  {replyRuns.length === 0 ? (
                    <li className="text-xs text-muted-foreground">No reply runs yet.</li>
                  ) : null}
                </ul>
              </details>
            </section>
          </aside>
        </div>
      </div>

      <CampaignDialog campaignId={campaignId} onClose={() => setCampaignId(null)} />
    </WorkspaceShell>
  );
}
