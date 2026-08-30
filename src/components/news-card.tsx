/**
 * One press story inside the mentions timeline. Same card language as a
 * mention — source label, sentiment read, timestamp, one action — so the two
 * kinds of coverage sit in a single chronological list without competing.
 */
import { Link } from "@tanstack/react-router";
import { ExternalLink, Frown, Globe, Megaphone, Meh, Newspaper, Smile } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ScoredNewsArticle } from "@/lib/news.functions";
import { isSocialProvider, type NewsSentiment } from "@/lib/news";
import { mentionImportance, sourceAuthority } from "@/lib/mention-intelligence";

const SENTIMENT_STYLE: Record<NewsSentiment, string> = {
  positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-destructive/10 text-destructive",
};

const SENTIMENT_ICON: Record<NewsSentiment, typeof Smile> = {
  positive: Smile,
  neutral: Meh,
  negative: Frown,
};

function formatStamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${time} · ${date}`;
}

export function NewsCard({ article }: { article: ScoredNewsArticle }) {
  const SentimentIcon = SENTIMENT_ICON[article.sentiment];
  const social = isSocialProvider(article.provider);
  const ChannelIcon = social ? Globe : Newspaper;
  const authority = sourceAuthority({ isPublication: !social });
  const importance = mentionImportance({ sentiment: article.sentiment, authority });

  return (
    <li className="group rounded-2xl border border-border bg-background p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border/80 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <ChannelIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {article.sourceId ||
                (isSocialProvider(article.provider) ? article.provider : "Press")}
            </p>
            <p className="type-meta text-muted-foreground">
              {isSocialProvider(article.provider) ? article.provider : `via ${article.provider}`}
            </p>
          </div>
        </div>
        <a
          href={article.link}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Open the story"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 type-meta">
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
          Source: {isSocialProvider(article.provider) ? article.provider : "news"}
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
          Authority: {authority}
        </span>
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
          {importance}
        </span>
      </div>

      <div className="mt-3 flex gap-4">
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt=""
            loading="lazy"
            className="hidden size-24 shrink-0 rounded-xl object-cover sm:block"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="block text-[15px] font-semibold leading-snug text-foreground hover:underline"
          >
            {article.title}
          </a>
          {article.description ? (
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{article.description}</p>
          ) : null}
        </div>
      </div>

      <p className="mt-3 type-meta text-muted-foreground">{formatStamp(article.pubDate)}</p>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
        <span
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold capitalize ${SENTIMENT_STYLE[article.sentiment]}`}
          title={article.sentimentReason}
        >
          <SentimentIcon className="size-4" aria-hidden="true" />
          {article.sentiment}
        </span>

        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-auto rounded-lg bg-primary/10 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 hover:text-primary"
        >
          <Link
            to="/campaign/$action"
            params={{ action: "post" }}
            search={{ text: article.title, link: article.link }}
            aria-label={`Run a campaign about ${article.title}`}
          >
            <Megaphone className="size-4" aria-hidden="true" />
            Run campaign
          </Link>
        </Button>
      </div>
    </li>
  );
}
