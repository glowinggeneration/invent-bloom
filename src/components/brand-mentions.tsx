import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Frown,
  Info,
  Layers,
  Meh,
  Smile,
  Loader2,
  CheckCircle2,
  Clock,
  Languages,
  MessageSquareReply,
  RefreshCw,
  TrendingDown,
  XCircle,
  MapPin,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui-kit";
import { FilterSelect } from "@/components/filter-select";
import { ExternalIdentity } from "@/components/external-identity";
import { MentionsSummary } from "@/components/mentions-summary";
import {
  AudienceGenderCard,
  AudienceInfluencersCard,
  AudienceLocationsCard,
  useAudienceLocations,
} from "@/components/audience-locations";
import { MentionSourcesCard } from "@/components/mention-sources";
import { NewsCard } from "@/components/news-card";

import {
  listBrandMentions,
  listMentionOutcomes,
  type MentionSentiment,
  type SentimentHighlight,
} from "@/lib/brand-mentions.functions";

import { translate as translateText, TRANSLATION_FALLBACK_MESSAGE } from "@/lib/translation";
import { BRAND_PROFILE_HANDLES } from "@/lib/brand-profiles";
import { listNews, type ScoredNewsArticle } from "@/lib/news.functions";
import { SOCIAL_PROVIDERS, isSocialProvider } from "@/lib/news";
import { listSocialMentions, type SocialMention } from "@/lib/apify-mentions.functions";
import { SocialMentionCard } from "@/components/social-mention-card";
import { APIFY_SOURCE_LABELS } from "@/lib/apify-sources";

const SENTIMENT_STYLE: Record<MentionSentiment, string> = {
  positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-destructive/10 text-destructive",
};

const FILTERS: {
  key: "all" | MentionSentiment | "direct-replies";
  label: string;
  icon: typeof Smile;
  /** Resting chip colours; the active state is always solid foreground. */
  idle: string;
}[] = [
  { key: "all", label: "All", icon: Layers, idle: "bg-muted/60 text-foreground" },
  {
    key: "positive",
    label: "Positive",
    icon: Smile,
    idle: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  { key: "neutral", label: "Neutral", icon: Meh, idle: "bg-muted/60 text-muted-foreground" },
  {
    key: "negative",
    label: "Negative",
    icon: Frown,
    idle: "bg-destructive/10 text-destructive",
  },
  {
    key: "direct-replies",
    label: "Direct replies",
    icon: MessageSquareReply,
    idle: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
];

const SENTIMENT_ICON: Record<MentionSentiment, typeof Smile> = {
  positive: Smile,
  neutral: Meh,
  negative: Frown,
};

/** Absolute stamp like the native post footer: 8:49 PM · Aug 6, 2026 */
function formatStamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${time} · ${date}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Quiet context toggle: instead of colouring words inside the post, a small
 * (i) reveals which phrases drove the sentiment call.
 */
function SentimentContext({
  text,
  highlights,
  reason,
}: {
  text: string;
  highlights?: SentimentHighlight[];
  reason?: string;
}) {
  const [open, setOpen] = useState(false);
  const spans = (highlights ?? []).filter(
    (h) => h.start >= 0 && h.end <= text.length && h.end > h.start,
  );
  if (spans.length === 0 && !reason) return null;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Why this sentiment"
        title="Why this sentiment"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="size-4" aria-hidden="true" />
      </button>
      {open ? (
        <div className="mt-2 w-full rounded-lg border border-border bg-muted/40 p-3">
          {reason ? <p className="type-meta text-muted-foreground">{reason}</p> : null}
          {spans.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {spans.map((span, i) => (
                <li key={`${span.start}-${i}`} className="type-meta text-muted-foreground">
                  <span className="font-medium text-foreground">
                    “{text.slice(span.start, span.end)}”
                  </span>
                  {span.reason ? ` - ${span.reason}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/**

 * People currently mentioning the federation accounts, with a one-tap
 * hand-off to Publish so the personas can reply to them.
 */
export function BrandMentions({
  initialSentiment,
  initialSource,
}: {
  /** Deep-link from Overview: open the feed already filtered. */
  initialSentiment?: string | undefined;
  initialSource?: string | undefined;
} = {}) {
  const fetchMentions = useServerFn(listBrandMentions);
  // Cursor stack: one entry per page visited, so Back never re-guesses a cursor.
  const [cursors, setCursors] = useState<string[]>([""]);
  const [page, setPage] = useState(0);
  const cursor = cursors[page] ?? "";

  // Mentions refresh on the hour; anything sooner only happens when the user
  // presses Refresh.
  const HOUR = 60 * 60 * 1000;
  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: ["brand-mentions", cursor],
    queryFn: () => fetchMentions({ data: { cursor } }),
    staleTime: HOUR,
    refetchInterval: HOUR,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const fetchOutcomes = useServerFn(listMentionOutcomes);
  const { data: outcomeData, refetch: refetchOutcomes } = useQuery({
    queryKey: ["brand-mention-outcomes"],
    queryFn: () => fetchOutcomes(),
    staleTime: HOUR,
    refetchInterval: HOUR,
    refetchOnWindowFocus: false,
  });
  const outcomes = useMemo(() => {
    const map = new Map<
      string,
      { published: number; failed: number; scheduled: number; lastPublishedAt: string | null }
    >();
    for (const o of outcomeData?.outcomes ?? []) map.set(o.tweetId, o);
    return map;
  }, [outcomeData]);

  const mentions = useMemo(() => data?.mentions ?? [], [data]);
  const nextCursor = data?.nextCursor ?? null;
  const [filter, setFilter] = useState<"all" | MentionSentiment | "direct-replies">(
    initialSentiment === "positive" ||
      initialSentiment === "neutral" ||
      initialSentiment === "negative" ||
      initialSentiment === "direct-replies"
      ? (initialSentiment as MentionSentiment | "direct-replies")
      : "all",
  );
  const [sort, setSort] = useState<"recent" | "negative">("recent");
  const [source, setSource] = useState<string>(initialSource || "all");

  // Press coverage shares the timeline with posts on X: same listening brief,
  // different channel, ordered purely by when each item was published.
  const fetchNews = useServerFn(listNews);
  const { data: newsData, refetch: refetchNews } = useQuery({
    queryKey: ["mentions-news"],
    queryFn: () => fetchNews({ data: { limit: 60 } }),
    staleTime: HOUR,
    refetchInterval: HOUR,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const news = useMemo<ScoredNewsArticle[]>(() => newsData?.articles ?? [], [newsData]);

  // Everything collected off X — Facebook, TikTok, Instagram, Threads,
  // LinkedIn, YouTube, Snapchat and the press — shares this same timeline.
  const fetchSocial = useServerFn(listSocialMentions);
  const { data: socialData, refetch: refetchSocial } = useQuery({
    queryKey: ["social-mentions"],
    queryFn: () => fetchSocial({ data: { limit: 150 } }),
    staleTime: HOUR,
    refetchInterval: HOUR,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const social = useMemo<SocialMention[]>(() => socialData?.mentions ?? [], [socialData]);

  const [translations, setTranslations] = useState<
    Record<string, { text: string; language: string } | undefined>
  >({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const [translateErrors, setTranslateErrors] = useState<Record<string, string | undefined>>({});

  async function handleTranslate(id: string, text: string) {
    if (translations[id]) {
      setTranslations((prev) => ({ ...prev, [id]: undefined }));
      return;
    }
    setTranslating((prev) => ({ ...prev, [id]: true }));
    setTranslateErrors((prev) => ({ ...prev, [id]: undefined }));
    const res = await translateText(text, "English", {
      stream: true,
      onPartial: (soFar) =>
        setTranslations((prev) => ({ ...prev, [id]: { text: soFar, language: "English" } })),
    });
    if (res.failed) {
      setTranslations((prev) => ({ ...prev, [id]: undefined }));
      setTranslateErrors((prev) => ({ ...prev, [id]: TRANSLATION_FALLBACK_MESSAGE }));
    } else {
      setTranslations((prev) => ({ ...prev, [id]: { text: res.translated, language: "English" } }));
    }
    setTranslating((prev) => ({ ...prev, [id]: false }));
  }

  function goNext() {
    if (!nextCursor) return;
    setCursors((prev) => {
      const next = prev.slice(0, page + 1);
      next.push(nextCursor);
      return next;
    });
    setPage((p) => p + 1);
  }

  function refreshNow() {
    setCursors([""]);
    setPage(0);
    void refetch();
    void refetchOutcomes();
    void refetchNews();
    void refetchSocial();
  }

  const counts = useMemo(() => {
    const c = {
      all: mentions.length,
      positive: 0,
      neutral: 0,
      negative: 0,
      directReplies: 0,
      "direct-replies": 0 as number,
    };
    for (const m of mentions) {
      c[m.sentiment] += 1;
      if (m.replyToBrand) {
        c.directReplies += 1;
        c["direct-replies"] += 1;
      }
    }
    return c;
  }, [mentions]);

  const sourceCounts = useMemo(() => {
    let mention = 0;
    let keyword = 0;
    for (const m of mentions) m.source === "keyword" ? keyword++ : mention++;
    const byProvider: Record<string, number> = {};
    for (const a of news) byProvider[a.provider] = (byProvider[a.provider] ?? 0) + 1;
    const press = news.filter((a) => !isSocialProvider(a.provider)).length;
    // A platform only appears in the filter once it has actually returned
    // something, so nothing is offered that cannot be shown.
    const byPlatform: Record<string, number> = {};
    for (const m of social) byPlatform[m.sourceLabel] = (byPlatform[m.sourceLabel] ?? 0) + 1;
    return {
      mention,
      keyword,
      news: press,
      byProvider,
      byPlatform,
      all: mentions.length + news.length + social.length,
    };
  }, [mentions, news, social]);

  const visible = useMemo(() => {
    let list = mentions;
    if (source !== "all") list = list.filter((m) => m.source === source);
    if (filter === "direct-replies") {
      list = list.filter((m) => m.replyToBrand);
    } else if (filter !== "all") {
      list = list.filter((m) => m.sentiment === filter);
    }
    if (sort === "recent") return list;
    return [...list].sort((a, b) => {
      // Most negative first; ties broken by how strongly the label is justified.
      if (a.sentimentScore !== b.sentimentScore) return a.sentimentScore - b.sentimentScore;
      const strength = (m: (typeof list)[number]) =>
        (m.sentimentReason ? m.sentimentReason.split(";").filter(Boolean).length : 0) +
        (m.replyToBrand ? 1 : 0);
      const diff = strength(b) - strength(a);
      if (diff !== 0) return diff;
      return b.viewCount + b.likeCount - (a.viewCount + a.likeCount);
    });
  }, [mentions, filter, sort, source]);

  const visibleNews = useMemo(() => {
    if (filter === "direct-replies") return [] as ScoredNewsArticle[];
    let list = news;
    // "news" keeps the press wires together; a platform name narrows to it.
    if (source === "mention" || source === "keyword") return [] as ScoredNewsArticle[];
    if (source === "news") list = list.filter((a) => !isSocialProvider(a.provider));
    else if (source !== "all") list = list.filter((a) => a.provider === source);
    if (filter !== "all") list = list.filter((a) => a.sentiment === filter);
    return list;
  }, [news, filter, source]);

  const visibleSocial = useMemo(() => {
    if (filter === "direct-replies") return [] as SocialMention[];
    let list = social;
    if (source === "mention" || source === "keyword") return [] as SocialMention[];
    // The press wires and the collected Google News items answer to the same
    // "News" filter entry.
    if (source !== "all" && source !== "news") list = list.filter((m) => m.sourceLabel === source);
    else if (source === "news") list = list.filter((m) => m.sourceLabel === "News");
    if (filter !== "all") list = list.filter((m) => m.sentiment === filter);
    return list;
  }, [social, filter, source]);

  /** One chronological list: X, the other platforms and press, newest first. */
  const feed = useMemo(() => {
    const items: (
      | { kind: "mention"; key: string; time: number; mention: (typeof visible)[number] }
      | { kind: "news"; key: string; time: number; article: ScoredNewsArticle }
      | { kind: "social"; key: string; time: number; social: SocialMention }
    )[] = [
      ...visible.map((m) => ({
        kind: "mention" as const,
        key: `m-${m.id}`,
        time: new Date(m.createdAt ?? 0).getTime() || 0,
        mention: m,
      })),
      ...visibleNews.map((a) => ({
        kind: "news" as const,
        key: `n-${a.link}`,
        time: new Date(a.pubDate ?? 0).getTime() || 0,
        article: a,
      })),
      ...visibleSocial.map((m) => ({
        kind: "social" as const,
        key: `s-${m.id}`,
        time: new Date(m.publishedAt ?? 0).getTime() || 0,
        social: m,
      })),
    ];
    if (sort === "negative") {
      return items.sort((a, b) => {
        const score = (i: (typeof items)[number]) =>
          i.kind === "news"
            ? i.article.sentimentScore
            : i.kind === "social"
              ? i.social.sentimentScore
              : i.mention.sentimentScore;
        return score(a) - score(b);
      });
    }
    return items.sort((a, b) => b.time - a.time);
  }, [visible, visibleNews, visibleSocial, sort]);

  const { data: audience } = useAudienceLocations(mentions.map((m) => m.authorHandle));
  const placeFor = (handle: string) =>
    audience?.byHandle?.[handle.replace(/^@/, "").trim().toLowerCase()] ?? null;

  const hasSidebars = mentions.length > 0;

  return (
    <div
      className={
        hasSidebars
          ? "mt-6 grid items-start gap-4 md:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_240px]"
          : "mt-6 grid items-start gap-4"
      }
    >
      {mentions.length > 0 ? (
        <div className="min-w-0 space-y-4 md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:overflow-y-auto md:pr-1">
          <AudienceLocationsCard handles={mentions.map((m) => m.authorHandle)} />
          <AudienceGenderCard handles={mentions.map((m) => m.authorHandle)} />
          <MentionSourcesCard
            mentionCount={sourceCounts.mention}
            keywordCount={sourceCounts.keyword}
            byPlatform={sourceCounts.byPlatform}
          />
        </div>
      ) : null}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionTitle>Mentions</SectionTitle>
            <p className="type-meta mt-1 text-muted-foreground">
              Posts mentioning {BRAND_PROFILE_HANDLES.map((h) => `@${h}`).join(" and ")}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={refreshNow} disabled={isFetching}>
              {isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Check for updates
            </Button>
          </div>
        </div>

        {mentions.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-xl font-semibold text-foreground">{counts.all}</p>
              <p className="type-meta text-muted-foreground">Total</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-xl font-semibold text-emerald-600">{counts.positive}</p>
              <p className="type-meta text-muted-foreground">Positive</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-xl font-semibold text-destructive">{counts.negative}</p>
              <p className="type-meta text-muted-foreground">Negative</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-xl font-semibold text-amber-600">{counts.directReplies}</p>
              <p className="type-meta text-muted-foreground">Direct replies</p>
            </div>
          </div>
        )}

        {mentions.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-background p-4">
            <FilterSelect
              label="Filter by sentiment"
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({
                value: f.key,
                label: f.label,
                count: counts[f.key],
              }))}
              triggerClassName="w-full sm:w-56"
            />
            <FilterSelect
              label="Filter by source"
              value={source}
              onChange={setSource}
              options={[
                { value: "all", label: "All sources", count: sourceCounts.all },
                { value: "mention", label: "Direct mentions", count: sourceCounts.mention },
                { value: "keyword", label: "Topic matches", count: sourceCounts.keyword },
                { value: "news", label: "News", count: sourceCounts.news },
                ...SOCIAL_PROVIDERS.filter((p) => (sourceCounts.byProvider[p] ?? 0) > 0).map(
                  (p) => ({
                    value: p,
                    label: p,
                    count: sourceCounts.byProvider[p] ?? 0,
                  }),
                ),
                ...APIFY_SOURCE_LABELS.filter(
                  (label) => label !== "News" && (sourceCounts.byPlatform[label] ?? 0) > 0,
                ).map((label) => ({
                  value: label,
                  label,
                  count: sourceCounts.byPlatform[label] ?? 0,
                })),
              ]}
              triggerClassName="w-full sm:w-52"
            />

            <FilterSelect
              label="Sort by"
              value={sort}
              onChange={setSort}
              options={[
                { value: "recent", label: "Newest" },
                { value: "negative", label: "Most negative" },
              ]}
              triggerClassName="w-full sm:w-44"
            />
          </div>
        ) : null}

        {isPending ? (
          <SkeletonRegion label="Looking for new mentions" className="mt-4 grid gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-background p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
                <Skeleton className="mt-3 h-3.5 w-full" />
                <Skeleton className="mt-2 h-3.5 w-4/5" />
              </div>
            ))}
          </SkeletonRegion>
        ) : feed.length === 0 ? (
          <p className="type-meta mt-4 text-muted-foreground">
            {mentions.length ? "No mentions with that sentiment." : "No new mentions right now."}
          </p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {feed.map((item) => {
              if (item.kind === "news") return <NewsCard key={item.key} article={item.article} />;
              if (item.kind === "social")
                return <SocialMentionCard key={item.key} mention={item.social} />;
              const m = item.mention;
              const o = outcomes.get(m.id);
              const SentimentIcon = SENTIMENT_ICON[m.sentiment];
              return (
                <li
                  key={m.id}
                  className="group min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-border/80 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background sm:p-5"
                  tabIndex={-1}
                >
                  <div className="flex items-start justify-between gap-3">
                    <a
                      href={`https://x.com/${m.authorHandle.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 rounded-xl p-1 -ml-1 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label={`Open @${m.authorHandle.replace(/^@/, "")} on X`}
                    >
                      <ExternalIdentity
                        handle={m.authorHandle}
                        fallbackName={m.authorName}
                        verified={m.isVerified}
                        avatarClassName="size-10 transition-transform group-hover:scale-[1.02]"
                        nameClassName="truncate text-sm font-semibold"
                        subtitle={
                          <span className="inline-flex items-center gap-1">
                            <span className="text-x-blue font-medium transition-colors hover:underline">
                              @{m.authorHandle.replace(/^@/, "")}
                            </span>
                          </span>
                        }
                      />
                    </a>

                    {m.url ? (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label="View on X"
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>

                  {m.isReply ? (
                    <p className="mt-2 type-meta text-muted-foreground">
                      Replying to{" "}
                      <span className="text-x-blue font-medium">
                        @{(m.replyToHandle || "a post").replace(/^@/, "")}
                      </span>
                      {m.replyToBrand ? (
                        <span className="ml-2 rounded-md bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
                          Direct reply to the federation
                        </span>
                      ) : null}
                    </p>
                  ) : null}

                  <p className="mt-2">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 type-meta font-medium text-muted-foreground">
                      {m.source === "keyword"
                        ? `Source: topic match on X${m.matchedKeyword ? ` · ${m.matchedKeyword}` : ""}`
                        : "Source: direct mention on X"}
                    </span>
                  </p>

                  {m.parentText ? (
                    <blockquote className="mt-2 min-w-0 overflow-hidden rounded-lg border-l-2 border-border bg-muted/40 px-3 py-2 type-meta text-muted-foreground">
                      <span className="block font-medium text-foreground">
                        {m.parentAuthorName || "Original post"}
                      </span>
                      <span className="mt-0.5 block line-clamp-3 whitespace-pre-wrap break-words">
                        {m.parentText}
                      </span>
                    </blockquote>
                  ) : null}

                  <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">
                    {m.text}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => void handleTranslate(m.id, m.text)}
                      disabled={translating[m.id]}
                      aria-label={
                        translations[m.id] ? "Hide translation" : "Translate post to English"
                      }
                      title={translations[m.id] ? "Hide translation" : "Translate to English"}
                    >
                      {translating[m.id] ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Languages className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                    <SentimentContext
                      text={m.text}
                      highlights={m.sentimentHighlights}
                      reason={m.sentimentReason}
                    />
                    {translations[m.id]?.language ? (
                      <span className="type-meta text-muted-foreground">
                        from {translations[m.id]!.language}
                      </span>
                    ) : null}
                  </div>

                  {translations[m.id] ? (
                    <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-muted/60 p-3 text-[15px] leading-relaxed text-foreground">
                      {translations[m.id]!.text}
                    </p>
                  ) : null}

                  {translateErrors[m.id] ? (
                    <p className="mt-2 type-meta text-destructive">{translateErrors[m.id]}</p>
                  ) : null}

                  {placeFor(m.authorHandle) ? (
                    <p className="mt-3 inline-flex items-center gap-1 type-meta text-muted-foreground">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {placeFor(m.authorHandle)}
                    </p>
                  ) : null}

                  <p className="mt-3 type-meta text-muted-foreground">
                    {formatStamp(m.createdAt)}
                    {m.viewCount > 0 ? (
                      <>
                        {" · "}
                        <span className="font-semibold text-foreground">
                          {m.viewCount.toLocaleString()}
                        </span>{" "}
                        Views
                      </>
                    ) : null}
                    {m.likeCount > 0 ? (
                      <>
                        {" · "}
                        <span className="font-semibold text-foreground">
                          {m.likeCount.toLocaleString()}
                        </span>{" "}
                        Likes
                      </>
                    ) : null}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <span
                      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold capitalize transition-opacity hover:opacity-80 ${SENTIMENT_STYLE[m.sentiment]}`}
                      title={m.sentimentReason}
                    >
                      <SentimentIcon className="size-4" aria-hidden="true" />
                      {m.sentiment}
                    </span>

                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-auto rounded-lg bg-primary/10 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Link
                        to="/campaign/$action"
                        params={{ action: "reply" }}
                        search={{ mode: "comment" as const, target: m.url }}
                        aria-label={`Reply to ${m.authorName}`}
                      >
                        <MessageSquareReply className="size-4" aria-hidden="true" />
                        Reply
                      </Link>
                    </Button>
                  </div>

                  {o && (o.published || o.failed || o.scheduled) ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      {o.published > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-0.5 type-meta text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          {o.published} published
                          {o.lastPublishedAt ? ` ${timeAgo(o.lastPublishedAt)}` : ""}
                        </span>
                      ) : null}
                      {o.scheduled > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 type-meta text-muted-foreground">
                          <Clock className="size-3" aria-hidden="true" />
                          {o.scheduled} queued
                        </span>
                      ) : null}
                      {o.failed > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-0.5 type-meta text-destructive">
                          <XCircle className="size-3" aria-hidden="true" />
                          {o.failed} failed
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {page > 0 || nextCursor ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="type-meta text-muted-foreground">Page {page + 1}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Newer
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={goNext}
                disabled={!nextCursor || isFetching}
              >
                Older
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {mentions.length > 0 ? (
        <div className="min-w-0 space-y-4 md:col-span-2 xl:col-span-1 md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:overflow-y-auto md:pr-1">
          <MentionsSummary counts={counts} activeFilter={filter} onSelect={setFilter} />
          <AudienceInfluencersCard handles={mentions.map((m) => m.authorHandle)} />
        </div>
      ) : null}
    </div>
  );
}
