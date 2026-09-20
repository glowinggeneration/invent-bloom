import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  CircleAlert,
  ExternalLink,
  Filter,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageSquareReply,
  Save,
  Sparkles,
  Twitter,
} from "lucide-react";
import { toast } from "sonner";

import { ClientTweetCard } from "@/registry/magicui/client-tweet-card";
import { ExternalIdentity } from "@/components/external-identity";
import { NewsCard } from "@/components/news-card";
import { SocialMentionCard } from "@/components/social-mention-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/ui-kit";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { listBrandMentions, type BrandMention } from "@/lib/brand-mentions.functions";
import {
  listSocialMentions,
  listSocialProfiles,
  type SocialMention,
} from "@/lib/apify-mentions.functions";
import { listNews, type ScoredNewsArticle } from "@/lib/news.functions";
import { isSocialProvider } from "@/lib/news";
import {
  IMPORTANCE_RANK,
  matchesMentionTopic,
  mentionImportance,
  mentionNoiseKey,
  sourceAuthority,
  type MentionImportance,
  type SourceAuthority,
} from "@/lib/mention-intelligence";
import {
  generateInvestigationBrief,
  type EvidenceItem,
  type InvestigationBrief,
} from "@/lib/investigation-brief.functions";
import { saveInvestigation } from "@/lib/projects.functions";
import { useCurrentProject } from "@/hooks/use-current-project";
import { friendlyError } from "@/lib/friendly-errors";

type FocusItem =
  | {
      kind: "x";
      key: string;
      time: number;
      text: string;
      authority: SourceAuthority;
      importance: MentionImportance;
      mention: BrandMention;
    }
  | {
      kind: "news";
      key: string;
      time: number;
      text: string;
      authority: SourceAuthority;
      importance: MentionImportance;
      article: ScoredNewsArticle;
    }
  | {
      kind: "social";
      key: string;
      time: number;
      text: string;
      authority: SourceAuthority;
      importance: MentionImportance;
      social: SocialMention;
    };

const importanceStyle: Record<MentionImportance, string> = {
  Critical: "bg-destructive/10 text-destructive",
  "High impact": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Relevant: "bg-primary/10 text-primary",
  "Low signal": "bg-muted text-muted-foreground",
};

const sentimentStyle = {
  positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-destructive/10 text-destructive",
} as const;

function stamp(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

/** X/Twitter tweet ids are purely numeric (snowflake ids); guard against any other id shape reaching react-tweet. */
function isXTweetId(id: string): boolean {
  return /^\d+$/.test(id);
}

function XFocusCard({ item }: { item: Extract<FocusItem, { kind: "x" }> }) {
  const m = item.mention;
  const [showEmbed, setShowEmbed] = useState(false);
  const canEmbed = isXTweetId(m.id);
  return (
    <li className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <ExternalIdentity
          handle={m.authorHandle}
          fallbackName={m.authorName}
          verified={m.isVerified}
          avatarClassName="size-10"
          nameClassName="truncate text-sm font-semibold"
          subtitle={
            <span className="text-x-blue font-medium">@{m.authorHandle.replace(/^@/, "")}</span>
          }
        />
        {m.url ? (
          <a
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open on X"
          >
            <ExternalLink className="size-4" />
          </a>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2 type-meta">
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
          X
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
          Authority: {item.authority}
        </span>
        <span
          className={`rounded-md px-1.5 py-0.5 font-semibold ${importanceStyle[item.importance]}`}
        >
          {item.importance}
        </span>
        {m.replyToBrand ? (
          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-400">
            Direct reply
          </span>
        ) : null}
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.text}</p>
      <p className="mt-3 type-meta text-muted-foreground">
        {stamp(m.createdAt)}
        {m.viewCount > 0 ? ` · ${m.viewCount.toLocaleString()} views` : ""}
        {m.likeCount > 0 ? ` · ${m.likeCount.toLocaleString()} likes` : ""}
      </p>

      {canEmbed ? (
        <div className="mt-3">
          <Button type="button" size="sm" variant="outline" onClick={() => setShowEmbed((v) => !v)}>
            <Twitter className="size-4" aria-hidden="true" />
            {showEmbed ? "Hide embedded post" : "View embedded post"}
          </Button>
          {showEmbed ? (
            <div className="mt-3 max-w-full overflow-hidden [&_.react-tweet-theme]:mx-0 [&_.react-tweet-theme]:my-0">
              <ClientTweetCard id={m.id} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
        <span
          className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold capitalize ${sentimentStyle[m.sentiment]}`}
        >
          {m.sentiment}
        </span>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="h-auto rounded-lg bg-primary/10 py-2 font-semibold text-primary hover:bg-primary/15 hover:text-primary"
        >
          <Link
            to="/campaign/$action"
            params={{ action: "reply" }}
            search={{ mode: "comment", target: m.url }}
          >
            <MessageSquareReply className="size-4" /> Reply
          </Link>
        </Button>
      </div>
    </li>
  );
}

export function MentionInvestigation({ topic }: { topic: string }) {
  const fetchMentions = useServerFn(listBrandMentions);
  const fetchNews = useServerFn(listNews);
  const fetchSocial = useServerFn(listSocialMentions);
  const fetchProfiles = useServerFn(listSocialProfiles);
  const [importanceFilter, setImportanceFilter] = useState<"all" | "high" | "relevant">("all");
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [sort, setSort] = useState<"recent" | "important">("important");

  const HOUR = 60 * 60 * 1000;
  const mentionsQuery = useQuery({
    queryKey: ["brand-mentions", "investigation", topic],
    queryFn: () => fetchMentions({ data: { cursor: "" } }),
    staleTime: HOUR,
  });
  const newsQuery = useQuery({
    queryKey: ["mentions-news", "investigation", topic],
    queryFn: () => fetchNews({ data: { limit: 100 } }),
    staleTime: HOUR,
  });
  const socialQuery = useQuery({
    queryKey: ["social-mentions", "investigation", topic],
    queryFn: () => fetchSocial({ data: { limit: 250 } }),
    staleTime: HOUR,
  });
  const profilesQuery = useQuery({
    queryKey: ["social-profiles"],
    queryFn: () => fetchProfiles(),
    staleTime: 12 * HOUR,
  });

  const profiles = profilesQuery.data ?? [];
  const items = useMemo<FocusItem[]>(() => {
    const xItems: FocusItem[] = (mentionsQuery.data?.mentions ?? [])
      .filter((m) => matchesMentionTopic(`${m.text} ${m.matchedKeyword}`, topic))
      .map((m) => {
        const engagement = m.likeCount;
        const authority = sourceAuthority({
          verified: m.isVerified,
          views: m.viewCount,
          engagement,
        });
        return {
          kind: "x" as const,
          key: `x-${m.id}`,
          time: new Date(m.createdAt ?? 0).getTime() || 0,
          text: m.text,
          authority,
          importance: mentionImportance({
            sentiment: m.sentiment,
            views: m.viewCount,
            engagement,
            authority,
            directReply: m.replyToBrand,
          }),
          mention: m,
        };
      });

    const newsItems: FocusItem[] = (newsQuery.data?.articles ?? [])
      .filter((a) => matchesMentionTopic(`${a.title} ${a.description} ${a.matchedQuery}`, topic))
      .map((a) => {
        const publication = !isSocialProvider(a.provider);
        const authority = sourceAuthority({ isPublication: publication });
        return {
          kind: "news" as const,
          key: `news-${a.link}`,
          time: new Date(a.pubDate ?? 0).getTime() || 0,
          text: `${a.title} ${a.description}`,
          authority,
          importance: mentionImportance({ sentiment: a.sentiment, authority }),
          article: a,
        };
      });

    const socialItems: FocusItem[] = (socialQuery.data?.mentions ?? [])
      .filter((m) =>
        matchesMentionTopic(
          `${m.title ?? ""} ${m.content ?? ""} ${m.entities.join(" ")} ${m.matchedKeywords.join(" ")}`,
          topic,
        ),
      )
      .map((m) => {
        const profile = profiles.find(
          (p) =>
            p.platform === m.platform &&
            p.handle.replace(/^@/, "").toLowerCase() ===
              (m.authorHandle ?? "").replace(/^@/, "").toLowerCase(),
        );
        const engagement = Number(m.likes ?? 0) + Number(m.comments ?? 0) + Number(m.shares ?? 0);
        const authority = sourceAuthority({
          verified: profile?.isVerified ?? false,
          isPublication: m.platform === "news",
          views: m.views,
          engagement,
        });
        return {
          kind: "social" as const,
          key: `social-${m.id}`,
          time: new Date(m.publishedAt ?? 0).getTime() || 0,
          text: `${m.title ?? ""} ${m.content ?? ""}`,
          authority,
          importance: mentionImportance({
            sentiment: m.sentiment,
            views: m.views,
            engagement,
            authority,
          }),
          social: m,
        };
      });

    return [...xItems, ...newsItems, ...socialItems];
  }, [mentionsQuery.data, newsQuery.data, socialQuery.data, profiles, topic]);

  const filtered = useMemo(() => {
    const threshold = importanceFilter === "high" ? 3 : importanceFilter === "relevant" ? 2 : 1;
    const ranked = items.filter((item) => IMPORTANCE_RANK[item.importance] >= threshold);
    ranked.sort((a, b) =>
      sort === "important"
        ? IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance] || b.time - a.time
        : b.time - a.time,
    );
    if (!hideDuplicates) return { visible: ranked, hidden: 0 };

    const seen = new Set<string>();
    const visible = ranked.filter((item) => {
      const noiseKey = mentionNoiseKey(item.text);
      if (noiseKey.length < 30) return true;
      if (seen.has(noiseKey)) return false;
      seen.add(noiseKey);
      return true;
    });
    return { visible, hidden: ranked.length - visible.length };
  }, [items, importanceFilter, hideDuplicates, sort]);

  const pending = mentionsQuery.isPending || newsQuery.isPending || socialQuery.isPending;
  const highImpact = items.filter((item) => IMPORTANCE_RANK[item.importance] >= 3).length;
  const relevant = items.filter((item) => IMPORTANCE_RANK[item.importance] >= 2).length;

  // --- Ask a question: evidence-backed brief over the currently visible set ---
  const itemsByKey = useMemo(
    () => new Map(filtered.visible.map((item) => [item.key, item])),
    [filtered.visible],
  );

  const [question, setQuestion] = useState("");
  const [brief, setBrief] = useState<InvestigationBrief | null>(null);
  const [sheetKey, setSheetKey] = useState<string | null>(null);

  const generateBrief = useServerFn(generateInvestigationBrief);
  const briefMutation = useMutation({
    mutationFn: () => {
      const evidence: EvidenceItem[] = filtered.visible.slice(0, 40).map((item) => {
        const url =
          item.kind === "x"
            ? item.mention.url
            : item.kind === "news"
              ? item.article.link
              : item.social.url;
        const title =
          item.kind === "x"
            ? `@${item.mention.authorHandle.replace(/^@/, "")}`
            : item.kind === "news"
              ? item.article.title
              : (item.social.title ?? item.social.platform);
        return {
          key: item.key,
          kind: item.kind,
          title: title || "Untitled",
          snippet: item.text.slice(0, 400),
          url: url || null,
          publishedAt: item.time > 0 ? new Date(item.time).toISOString() : null,
        };
      });
      return generateBrief({
        data: { question: question.trim() || `What's happening with ${topic}?`, evidence },
      });
    },
    onSuccess: (result) => setBrief(result),
    onError: (error) => toast.error(friendlyError(error)),
  });

  const queryClient = useQueryClient();
  const { current: currentProject } = useCurrentProject();
  const save = useServerFn(saveInvestigation);
  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          name: brief?.question.slice(0, 200) || topic,
          topic,
          ...(currentProject ? { projectId: currentProject.id } : {}),
          brief: brief ?? {},
          evidence: filtered.visible
            .slice(0, 40)
            .map((item) => ({ key: item.key, kind: item.kind })),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investigations"] });
      toast.success(
        currentProject
          ? `Saved to ${currentProject.name}, with its sources.`
          : "Saved, with its sources. Attach it to a project any time from Projects.",
      );
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const sheetItem = sheetKey ? itemsByKey.get(sheetKey) : null;

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <SectionTitle>Investigation: {topic}</SectionTitle>
          </div>
          <p className="mt-1 type-meta text-muted-foreground">
            Only mentions about this topic are shown here. Hiding duplicates doesn't delete
            anything.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/mentions" search={{}}>
            <ArrowLeft className="size-4" /> All mentions
          </Link>
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background p-3 sm:p-4">
        <label htmlFor="investigation-question" className="type-meta font-medium">
          Ask a question about this topic
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="investigation-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`What's happening with ${topic}?`}
            className="flex-1"
          />
          <Button
            onClick={() => briefMutation.mutate()}
            disabled={briefMutation.isPending || filtered.visible.length === 0}
            className="gap-1.5 sm:w-auto"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {briefMutation.isPending ? "Reading the evidence…" : "Generate brief"}
          </Button>
        </div>
        <p className="mt-2 type-meta text-muted-foreground">
          Built only from the {filtered.visible.length} item(s) currently shown below - adjust the
          filters above first if you want a different set considered.
        </p>

        {brief ? (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="type-meta text-muted-foreground">
                Brief for: <span className="font-medium text-foreground">{brief.question}</span>
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="size-3.5" aria-hidden="true" />
                {saveMutation.isPending ? "Saving…" : "Save investigation"}
              </Button>
            </div>

            {brief.coverageGaps.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                  <CircleAlert className="size-4" aria-hidden="true" />
                  Coverage gaps
                </div>
                <ul className="mt-1.5 space-y-1 type-meta text-muted-foreground">
                  {brief.coverageGaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="flex items-center gap-1.5 font-medium">
                <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
                Observed facts
              </div>
              {brief.observedFacts.length === 0 ? (
                <p className="mt-1.5 type-meta text-muted-foreground">
                  Nothing in the current evidence could be stated as a directly sourced fact.
                </p>
              ) : (
                <ul className="mt-1.5 space-y-2">
                  {brief.observedFacts.map((fact, i) => (
                    <li key={i} className="type-body">
                      {fact.text}{" "}
                      {fact.evidenceKeys.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSheetKey(key)}
                          className="ml-1 inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 type-meta font-medium text-primary hover:bg-primary/15"
                        >
                          <BookOpen className="size-3" aria-hidden="true" />
                          Source
                        </button>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {brief.interpretation.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 font-medium">
                  <Lightbulb className="size-4 text-amber-500" aria-hidden="true" />
                  AI interpretation
                  <span className="type-meta font-normal text-muted-foreground">
                    — a reading of the pattern, not a sourced fact
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1 type-body text-muted-foreground">
                  {brief.interpretation.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {brief.suggestedActions.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 font-medium">
                  <ListChecks className="size-4 text-primary" aria-hidden="true" />
                  Suggested actions
                  <span className="type-meta font-normal text-muted-foreground">
                    — nothing here has been done automatically
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1 type-body text-muted-foreground">
                  {brief.suggestedActions.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3">
        <Filter className="size-4 text-muted-foreground" />
        <Button
          size="sm"
          variant={importanceFilter === "all" ? "default" : "outline"}
          onClick={() => setImportanceFilter("all")}
        >
          All {items.length}
        </Button>
        <Button
          size="sm"
          variant={importanceFilter === "high" ? "default" : "outline"}
          onClick={() => setImportanceFilter("high")}
        >
          High impact {highImpact}
        </Button>
        <Button
          size="sm"
          variant={importanceFilter === "relevant" ? "default" : "outline"}
          onClick={() => setImportanceFilter("relevant")}
        >
          Relevant+ {relevant}
        </Button>
        <Button
          size="sm"
          variant={hideDuplicates ? "secondary" : "outline"}
          onClick={() => setHideDuplicates((v) => !v)}
        >
          {hideDuplicates ? "Duplicates hidden" : "Show duplicates"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSort((v) => (v === "important" ? "recent" : "important"))}
        >
          Sort: {sort === "important" ? "Importance" : "Newest"}
        </Button>
        {filtered.hidden > 0 ? (
          <span className="type-meta text-muted-foreground">
            {filtered.hidden} near-duplicate{filtered.hidden === 1 ? "" : "s"} collapsed
          </span>
        ) : null}
      </div>

      {pending ? (
        <p className="mt-6 flex items-center gap-2 type-body text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Building the investigation view…
        </p>
      ) : filtered.visible.length === 0 ? (
        <p className="mt-6 type-body text-muted-foreground">
          Nothing matches this topic and level right now.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {filtered.visible.map((item) => {
            if (item.kind === "x") return <XFocusCard key={item.key} item={item} />;
            if (item.kind === "news") return <NewsCard key={item.key} article={item.article} />;
            return <SocialMentionCard key={item.key} mention={item.social} />;
          })}
        </ul>
      )}

      <Sheet open={Boolean(sheetItem)} onOpenChange={(open) => !open && setSheetKey(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Cited source</SheetTitle>
          </SheetHeader>
          <ul className="mt-4">
            {sheetItem?.kind === "x" ? (
              <XFocusCard item={sheetItem} />
            ) : sheetItem?.kind === "news" ? (
              <NewsCard article={sheetItem.article} />
            ) : sheetItem?.kind === "social" ? (
              <SocialMentionCard mention={sheetItem.social} />
            ) : null}
          </ul>
        </SheetContent>
      </Sheet>
    </section>
  );
}
