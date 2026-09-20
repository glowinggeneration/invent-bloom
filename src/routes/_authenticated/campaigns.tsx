import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountIdentity } from "@/components/account-identity";
import { ExternalIdentity } from "@/components/external-identity";
import { PostCard } from "@/components/post-card";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  BarChart3,
  Clock,
  ExternalLink,
  Hash,
  Heart,
  Loader2,
  MessageSquareReply,
  MoreHorizontal,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";

import { toast } from "sonner";
import { FloatingInput } from "@/components/core/floating-input";
import { WorkspaceShell } from "@/components/workspace-shell";
import { useCachedQuery } from "@/lib/offline-cache";
import { OfflineNotice } from "@/components/offline-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FilterSelect } from "@/components/filter-select";
import { Card, PageTitle, SectionTitle, StatCard, EmptyState } from "@/components/ui-kit";
import { parseTerms, type Campaign } from "@/lib/campaigns";
import { SPREAD_OPTIONS, spreadLabel } from "@/lib/spread";
import {
  deleteCampaign,
  listCampaignReplies,
  listCampaigns,
  previewCampaignMatches,
  runCampaign,
  saveCampaign,
} from "@/lib/campaigns.functions";
import { listXAccounts } from "@/lib/publish.functions";
import { friendlyError } from "@/lib/friendly-errors";
import { CampaignMomentumVisual } from "@/components/smait/workflow-visuals";

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaigns - SMAIT" },
      {
        name: "description",
        content: "Listening campaigns that reply in persona voice to matching conversations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Campaigns - SMAIT" },
      {
        property: "og:description",
        content: "Keyword and hashtag listening campaigns with persona-voiced replies.",
      },
    ],
  }),
  component: CampaignsPage,
});

function CampaignsPage() {
  return <CampaignsWorkspace />;
}

const EMPTY_FORM = {
  id: undefined as string | undefined,
  name: "",
  keywords: "",
  hashtags: "",
  coreMessage: "",
  language: "en",
  isActive: true,
  maxRepliesPerRun: 5,
  spreadHours: 0,
  likeTarget: true,
  followAuthor: false,
  accountIds: [] as string[],
};

type FormState = typeof EMPTY_FORM;
type PreviewTweet = {
  id: string;
  text: string;
  authorHandle: string;
  authorName?: string;
  url: string;
};

function isPreviewTweet(value: unknown): value is PreviewTweet {
  if (!value || typeof value !== "object") return false;
  const tweet = value as Record<string, unknown>;
  return ["id", "text", "authorHandle", "url"].every((key) => typeof tweet[key] === "string");
}

function toForm(c: Campaign): FormState {
  return {
    id: c.id,
    name: c.name,
    keywords: c.keywords.join(", "),
    hashtags: c.hashtags.join(", "),
    coreMessage: c.coreMessage,
    language: c.language,
    isActive: c.isActive,
    maxRepliesPerRun: c.maxRepliesPerRun,
    spreadHours: c.spreadHours,
    likeTarget: c.likeTarget,
    followAuthor: c.followAuthor,
    accountIds: c.accountIds,
  };
}

/** Reply actions the personas take, expressed as one plain-language choice. */
const ACTION_PRESETS = [
  { value: "reply", label: "Reply only", likeTarget: false, followAuthor: false },
  { value: "reply_like", label: "Reply and like the post", likeTarget: true, followAuthor: false },
  {
    value: "reply_follow",
    label: "Reply and follow the author",
    likeTarget: false,
    followAuthor: true,
  },
  {
    value: "reply_like_follow",
    label: "Reply, like and follow the author",
    likeTarget: true,
    followAuthor: true,
  },
] as const;

function presetValue(form: { likeTarget: boolean; followAuthor: boolean }) {
  return (
    ACTION_PRESETS.find(
      (p) => p.likeTarget === form.likeTarget && p.followAuthor === form.followAuthor,
    )?.value ?? "reply"
  );
}

export function CampaignsWorkspace() {
  const queryClient = useQueryClient();

  const fetchCampaigns = useServerFn(listCampaigns);
  const fetchAccounts = useServerFn(listXAccounts);
  const fetchReplies = useServerFn(listCampaignReplies);
  const doSave = useServerFn(saveCampaign);
  const doDelete = useServerFn(deleteCampaign);
  const doRun = useServerFn(runCampaign);
  const doPreview = useServerFn(previewCampaignMatches);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [replyFilter, setReplyFilter] = useState<"all" | "success" | "failed">("all");
  const [preview, setPreview] = useState<PreviewTweet[] | null>(null);
  const [previewTweetId, setPreviewTweetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => fetchCampaigns(),
  });

  const { data: accounts } = useQuery({
    queryKey: ["x-accounts"],
    queryFn: () => fetchAccounts(),
  });

  const {
    data: replies,
    isOffline: repliesOffline,
    cachedAt: repliesCachedAt,
  } = useCachedQuery(
    ["campaign-replies", selectedId],
    () => fetchReplies({ data: { campaignId: selectedId!, limit: 50 } }),
    { enabled: Boolean(selectedId) },
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["campaigns"] });

  const save = useMutation({
    mutationFn: () =>
      doSave({
        data: {
          ...(form.id ? { id: form.id } : {}),
          name: form.name.trim(),
          keywords: parseTerms(form.keywords),
          hashtags: parseTerms(form.hashtags, true),
          coreMessage: form.coreMessage.trim(),
          language: form.language.trim() || "en",
          isActive: form.isActive,
          maxRepliesPerRun: Number(form.maxRepliesPerRun) || 5,
          spreadHours: Number(form.spreadHours) || 0,
          likeTarget: form.likeTarget,
          followAuthor: form.followAuthor,
          accountIds: form.accountIds,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      setForm(EMPTY_FORM);
      toast.success("Your campaign is saved.");
    },
    onError: (e) =>
      toast.error(
        friendlyError(e, {
          action: "save this campaign",
          preserved: "Your details are still filled in.",
        }),
      ),
  });

  const remove = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: async () => {
      await invalidate();
      setSelectedId(null);
      setForm(EMPTY_FORM);
      toast.success("Campaign removed.");
    },
    onError: (e) => toast.error(friendlyError(e, { action: "remove this campaign" })),
  });

  const run = useMutation({
    mutationFn: (id: string) => doRun({ data: { id } }),
    onSuccess: async (res) => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["campaign-replies"] });
      setSelectedId(res.campaignId);
      toast.success(res.note, {
        description: `${res.found} matched · ${res.replied} replied · ${res.skipped} held · ${res.failed} failed`,
      });
    },
    onError: (e) => toast.error(friendlyError(e, { action: "start this run" })),
  });

  const previewRun = useMutation({
    mutationFn: () =>
      doPreview({
        data: {
          keywords: parseTerms(form.keywords),
          hashtags: parseTerms(form.hashtags, true),
          language: form.language.trim() || "en",
        },
      }),
    onSuccess: (res) => {
      const tweets = Array.isArray(res.tweets) ? res.tweets.filter(isPreviewTweet) : [];
      setPreview(tweets);
      setPreviewTweetId(tweets[0]?.id ?? null);
      if (res.error) toast.message(res.error);
    },
    onError: (e) => toast.error(friendlyError(e, { action: "load this preview" })),
  });

  const selected = useMemo(
    () => (campaigns ?? []).find((c) => c.id === selectedId) ?? null,
    [campaigns, selectedId],
  );

  const accountList = accounts ?? [];
  const all = useMemo(() => campaigns ?? [], [campaigns]);

  const stats = useMemo(() => {
    const active = all.filter((c) => c.isActive).length;
    const replyTotal = all.reduce((n, c) => n + c.replyCount, 0);
    const lastRun = all
      .map((c) => c.lastRunAt)
      .filter(Boolean)
      .sort()
      .at(-1);
    return { total: all.length, active, replyTotal, lastRun };
  }, [all]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((c) => {
      if (statusFilter === "active" && !c.isActive) return false;
      if (statusFilter === "paused" && c.isActive) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.toLowerCase().includes(q)) ||
        c.hashtags.some((h) => h.toLowerCase().includes(q))
      );
    });
  }, [all, query, statusFilter]);

  const keywordChips = parseTerms(form.keywords);
  const hashtagChips = parseTerms(form.hashtags, true);

  const previewTweet =
    (preview ?? []).find((t) => t.id === previewTweetId) ?? (preview ?? [])[0] ?? null;
  const previewPersona = accountList.find((a) => form.accountIds.includes(a.id)) ?? accountList[0];
  const previewReply =
    (form.coreMessage.trim() ||
      "Your core message appears here, written in the voice of the replying persona.") +
    (hashtagChips.length
      ? ` ${hashtagChips
          .slice(0, 2)
          .map((h) => `#${h}`)
          .join(" ")}`
      : "");

  const visibleReplies = (replies ?? []).filter((r) =>
    replyFilter === "all" ? true : r.status === replyFilter,
  );

  return (
    <WorkspaceShell title="Campaigns" wide>
      <PageTitle
        actions={
          <div className="flex items-center gap-2">
            <Link to="/performance">
              <Button
                variant="outline"
                className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
              >
                <BarChart3 className="size-4" aria-hidden="true" />
                Show performance
              </Button>
            </Link>
            <Button
              className="gap-2 shadow-[0_0_16px_2px] shadow-primary/50"
              onClick={() => {
                setForm(EMPTY_FORM);
                setPreview(null);
                document.getElementById("c-name")?.focus();
              }}
            >
              <Plus className="size-4" /> New campaign
            </Button>
          </div>
        }
      >
        Campaigns
      </PageTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Campaigns" value={stats.total} icon={Radar} />
        <StatCard label="Active" value={stats.active} icon={Play} />
        <StatCard label="Replies sent" value={stats.replyTotal} icon={MessageSquareReply} />
        <StatCard
          label="Last run"
          value={stats.lastRun ? new Date(stats.lastRun).toLocaleDateString() : "-"}
          icon={Clock}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Builder */}
        <Card className="h-fit lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-3">
            <p className="type-card">{form.id ? "Edit campaign" : "New campaign"}</p>
            {form.id && (
              <Badge variant="secondary" className="type-meta">
                Editing
              </Badge>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <div className="space-y-1">
              <FloatingInput
                id="c-name"
                label="Campaign name"
                value={form.name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="c-keywords">Keywords</Label>
                <Textarea
                  id="c-keywords"
                  rows={2}
                  value={form.keywords}
                  placeholder="product launch, ticket sales"
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-hashtags">Hashtags</Label>
                <Textarea
                  id="c-hashtags"
                  rows={2}
                  value={form.hashtags}
                  placeholder="#YourBrand, #Campaign2026"
                  onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
                />
              </div>
            </div>

            {(keywordChips.length > 0 || hashtagChips.length > 0) && (
              <div className="flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/30 p-2">
                {keywordChips.map((k) => (
                  <span
                    key={`k-${k}`}
                    className="type-meta rounded-full bg-background px-2 py-1 text-foreground shadow-sm"
                  >
                    {k}
                  </span>
                ))}
                {hashtagChips.map((h) => (
                  <span
                    key={`h-${h}`}
                    className="type-meta flex items-center gap-1 rounded-full bg-background px-2 py-1 text-primary shadow-sm"
                  >
                    <Hash className="size-3" aria-hidden="true" />
                    {h}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="c-core">Core message</Label>
                <span className="type-meta tabular-nums text-muted-foreground">
                  {form.coreMessage.length}/600
                </span>
              </div>
              <Textarea
                id="c-core"
                rows={3}
                maxLength={600}
                value={form.coreMessage}
                placeholder="What every reply should land, in plain language."
                onChange={(e) => setForm({ ...form, coreMessage: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="c-actions">Actions to take</Label>
              <Select
                value={presetValue(form)}
                onValueChange={(v) => {
                  const p = ACTION_PRESETS.find((x) => x.value === v) ?? ACTION_PRESETS[0];
                  setForm({ ...form, likeTarget: p.likeTarget, followAuthor: p.followAuthor });
                }}
              >
                <SelectTrigger id="c-actions">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <details className="group rounded-xl border border-border/70 bg-muted/20">
              <summary className="type-body flex cursor-pointer list-none items-center justify-between gap-2 p-3 font-medium">
                Advanced options
                <span className="type-meta font-normal text-muted-foreground group-open:hidden">
                  Show
                </span>
                <span className="type-meta hidden font-normal text-muted-foreground group-open:inline">
                  Hide
                </span>
              </summary>

              <div className="space-y-4 border-t border-border/70 p-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="c-max">Replies per run</Label>
                    <Input
                      id="c-max"
                      type="number"
                      min={1}
                      max={25}
                      value={form.maxRepliesPerRun}
                      onChange={(e) =>
                        setForm({ ...form, maxRepliesPerRun: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="c-lang">Language</Label>
                    <Input
                      id="c-lang"
                      value={form.language}
                      maxLength={8}
                      placeholder="en"
                      onChange={(e) => setForm({ ...form, language: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="c-spread">Reply timing</Label>
                    <select
                      id="c-spread"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.spreadHours}
                      onChange={(e) => setForm({ ...form, spreadHours: Number(e.target.value) })}
                    >
                      {SPREAD_OPTIONS.map((h) => (
                        <option key={h} value={h}>
                          {spreadLabel(h)}
                        </option>
                      ))}
                    </select>
                    <p className="type-meta text-muted-foreground">
                      Replies are scattered across the window so accounts never answer at once.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-border/70 rounded-xl border border-border/70 bg-background">
                  <div className="flex items-center justify-between gap-3 p-3">
                    <Label htmlFor="c-isActive" className="type-body font-normal">
                      Campaign active
                    </Label>
                    <Switch
                      id="c-isActive"
                      checked={form.isActive}
                      onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Replying personas</Label>
                    {form.accountIds.length > 0 && (
                      <button
                        type="button"
                        className="type-meta text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => setForm({ ...form, accountIds: [] })}
                      >
                        Clear ({form.accountIds.length})
                      </button>
                    )}
                  </div>
                  <p className="type-meta text-muted-foreground">
                    None selected uses every active persona.
                  </p>
                  <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-border/70 bg-background p-2">
                    {accountList.map((a) => {
                      const on = form.accountIds.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setForm({
                              ...form,
                              accountIds: on
                                ? form.accountIds.filter((id) => id !== a.id)
                                : [...form.accountIds, a.id],
                            })
                          }
                          className={`type-meta rounded-full border px-3 py-1 transition ${
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {a.displayName || a.personaLabel || a.handle}
                        </button>
                      );
                    })}
                    {accountList.length === 0 && (
                      <p className="type-meta text-muted-foreground">No personas yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </details>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="type-meta mb-2 text-muted-foreground">
                Preview matching conversations before saving. Save a draft when it needs review;
                launch only when the content, accounts, and timing are ready.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => save.mutate()}
                  disabled={save.isPending || !form.name.trim()}
                  className="gap-2"
                >
                  {save.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {form.id ? "Save changes" : "Save draft"}
                </Button>
                <Button
                  className="gap-2"
                  disabled={save.isPending || run.isPending || !form.name.trim()}
                  onClick={async () => {
                    try {
                      const saved = await save.mutateAsync();
                      run.mutate(saved.id);
                    } catch {
                      /* save.onError already surfaced the problem */
                    }
                  }}
                >
                  {run.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Save and launch
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                  onClick={() => previewRun.mutate()}
                  disabled={previewRun.isPending}
                >
                  {previewRun.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  Preview matches
                </Button>
                {form.id && (
                  <Button variant="ghost" onClick={() => setForm(EMPTY_FORM)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Live preview */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="type-card">Reply preview</p>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => previewRun.mutate()}
                disabled={previewRun.isPending}
              >
                {previewRun.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Refresh
              </Button>
            </div>
            <p className="type-meta mt-1 text-muted-foreground">
              The live post your personas would answer, and how the reply will read.
            </p>

            {previewRun.isPending ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : !previewTweet ? (
              <div className="mt-4">
                <EmptyState
                  title="No conversation fetched yet"
                  description="Add keywords or hashtags, then fetch conversations to see a live preview."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {(preview ?? []).length > 1 && (
                  <Select value={previewTweet.id} onValueChange={(v) => setPreviewTweetId(v)}>
                    <SelectTrigger aria-label="Choose conversation to preview">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(preview ?? []).slice(0, 8).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.authorName || t.authorHandle}: {t.text.slice(0, 48)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-2">
                    <ExternalIdentity
                      handle={previewTweet.authorHandle}
                      fallbackName={previewTweet.authorName ?? null}
                      avatarClassName="size-9"
                      nameClassName="truncate type-body font-medium"
                      subtitle="Live post on X"
                    />

                    <a
                      href={previewTweet.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto text-muted-foreground hover:text-foreground"
                      aria-label="Open post on X"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  </div>
                  <p className="type-body mt-3 whitespace-pre-wrap">{previewTweet.text}</p>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-3">
                    <span className="type-meta inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                      <MessageSquareReply className="size-3" aria-hidden="true" /> Reply
                    </span>
                    {form.likeTarget && (
                      <span className="type-meta inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                        <Heart className="size-3" aria-hidden="true" /> Like
                      </span>
                    )}
                    {form.followAuthor && (
                      <span className="type-meta inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                        <UserPlus className="size-3" aria-hidden="true" /> Follow author
                      </span>
                    )}
                    <span className="type-meta inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                      <Clock className="size-3" aria-hidden="true" />
                      {spreadLabel(Number(form.spreadHours) || 0)}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
                  <AccountIdentity
                    handle={previewPersona?.handle ?? null}
                    displayName={previewPersona?.displayName ?? "Persona"}
                    avatarUrl={previewPersona?.avatarUrl ?? null}
                    avatarClassName="size-8"
                    nameClassName="truncate type-meta font-medium"
                    subtitle={`replying to ${previewTweet.authorName || previewTweet.authorHandle}`}
                  />
                  <p className="type-body mt-2 whitespace-pre-wrap">{previewReply}</p>
                  <p className="type-meta mt-2 text-muted-foreground">
                    Each persona rewrites this in their own voice.
                  </p>
                </div>

                <p className="type-meta text-muted-foreground">
                  {(preview ?? []).length} live conversation
                  {(preview ?? []).length === 1 ? "" : "s"} match right now
                  {" · "}
                  {form.maxRepliesPerRun} repl
                  {Number(form.maxRepliesPerRun) === 1 ? "y" : "ies"} per run
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* List + replies */}
      <div className="mt-6 space-y-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="type-card">
              Your campaigns
              {all.length > 0 && (
                <span className="ml-1 font-normal text-muted-foreground">({visible.length})</span>
              )}
            </p>
            <FilterSelect
              label="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "paused", label: "Paused" },
              ]}
              triggerClassName="w-40"
            />
          </div>

          {all.length > 0 && (
            <div className="relative mt-3">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, keyword or hashtag"
                aria-label="Search campaigns"
                className="pl-9"
              />
            </div>
          )}

          {isLoading ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : all.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Nothing here yet."
                description="Campaigns you create will appear here."
                visual={<CampaignMomentumVisual />}
              />
            </div>
          ) : visible.length === 0 ? (
            <p className="type-meta mt-4 rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
              No results for this search. Try a different keyword.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {visible.map((c) => {
                const isSelected = c.id === selectedId;
                const running = run.isPending && run.variables === c.id;
                return (
                  <li
                    key={c.id}
                    className={`rounded-xl border p-3 transition ${
                      isSelected
                        ? "border-primary/60 bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <button
                        type="button"
                        className="min-w-0 text-left"
                        aria-expanded={isSelected}
                        onClick={() => setSelectedId(isSelected ? null : c.id)}
                      >
                        <p className="type-body flex min-w-0 items-center gap-2 font-medium">
                          <span
                            className={`size-2 shrink-0 rounded-full ${
                              c.isActive
                                ? "bg-primary shadow-[0_0_6px_1px] shadow-primary/60"
                                : "bg-muted-foreground/40"
                            }`}
                            aria-hidden="true"
                          />
                          <span className="truncate">{c.name}</span>
                          {!c.isActive && (
                            <Badge variant="secondary" className="type-meta shrink-0">
                              Paused
                            </Badge>
                          )}
                        </p>
                        <p className="type-meta mt-2 flex flex-wrap gap-1 text-muted-foreground">
                          {c.keywords.slice(0, 4).map((k) => (
                            <span key={k} className="rounded bg-muted px-1 py-0.5">
                              {k}
                            </span>
                          ))}
                          {c.hashtags.slice(0, 4).map((h) => (
                            <span
                              key={h}
                              className="flex items-center rounded bg-muted px-1 py-0.5"
                            >
                              <Hash className="size-3" />
                              {h}
                            </span>
                          ))}
                          {c.keywords.length + c.hashtags.length > 8 && (
                            <span className="px-1 py-0.5">
                              +{c.keywords.length + c.hashtags.length - 8}
                            </span>
                          )}
                        </p>
                        <p className="type-meta mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {c.replyCount} repl{c.replyCount === 1 ? "y" : "ies"}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {c.lastRunAt
                              ? `last run ${new Date(c.lastRunAt).toLocaleString()}`
                              : "never run"}
                          </span>
                        </p>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => run.mutate(c.id)}
                          disabled={run.isPending}
                        >
                          {running ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Play className="size-4" />
                          )}
                          {running ? "Running" : "Run"}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" aria-label={`Actions for ${c.name}`}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onSelect={() => setForm(toForm(c))}>
                              Edit campaign
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setSelectedId(c.id);
                                setForm(toForm(c));
                                previewRun.mutate();
                              }}
                            >
                              <RefreshCw className="size-4" /> Fetch conversations
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSelectedId(c.id)}>
                              <MessageSquareReply className="size-4" /> View replies
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setDeleteTarget(c)}
                            >
                              <Trash2 className="size-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {selected && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="type-card flex min-w-0 items-center gap-2">
                <MessageSquareReply className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">Replies · {selected.name}</span>
              </p>
              <FilterSelect
                label="Filter by result"
                value={replyFilter}
                onChange={setReplyFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "success", label: "Delivered" },
                  { value: "failed", label: "Failed" },
                ]}
                triggerClassName="w-40"
              />
            </div>
            {repliesOffline && (
              <div className="mt-4">
                <OfflineNotice cachedAt={repliesCachedAt} label="replies" />
              </div>
            )}
            {visibleReplies.length === 0 ? (
              <p className="type-meta mt-4 rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
                {(replies ?? []).length === 0
                  ? "No replies yet. Run the campaign to start the conversation."
                  : "No replies with that status."}
              </p>
            ) : (
              <ul className="mt-4 grid gap-4">
                {visibleReplies.map((r) => (
                  <li key={r.id}>
                    <PostCard
                      author={
                        <AccountIdentity
                          handle={r.handle}
                          avatarClassName="size-10"
                          nameClassName="truncate text-sm font-semibold"
                          subtitle={`as ${r.personaName}`}
                        />
                      }
                      url={r.tweetUrl ?? undefined}
                      text={r.replyText}
                      replyTo={
                        r.authorHandle ? (
                          <span className="flex flex-wrap items-center gap-1">
                            <span className="shrink-0">Replying to</span>
                            <ExternalIdentity
                              handle={r.authorHandle}
                              avatarClassName="size-5"
                              nameClassName="truncate type-meta text-muted-foreground"
                            />
                          </span>
                        ) : undefined
                      }
                      quote={r.tweetText ? { name: null, text: r.tweetText } : null}
                      badges={
                        <Badge
                          variant={
                            r.status === "success"
                              ? "default"
                              : r.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                          className="type-meta shrink-0 capitalize"
                        >
                          {r.status}
                        </Badge>
                      }
                      footer={
                        r.error ? (
                          <p className="mt-2 type-meta text-destructive">{r.error}</p>
                        ) : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove “{deleteTarget?.name}”? This can't be undone.
            </AlertDialogTitle>
            <AlertDialogDescription>
              The campaign and its reply history will be removed. Replies already posted on X stay
              live.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) remove.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspaceShell>
  );
}
