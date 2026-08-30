/**
 * One item of public conversation from outside X — Facebook, TikTok,
 * Instagram, Threads, LinkedIn, YouTube, Snapchat or the press — inside the
 * same mentions timeline.
 *
 * The card language never changes: who said it, what they said, how it reads,
 * one way out. Only the metric row adapts to what the platform actually
 * reports; a number that was not collected is simply not shown.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Frown, Globe, Megaphone, Meh, Newspaper, Smile } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/apify-sources";
import { listSocialProfiles, type SocialMention } from "@/lib/apify-mentions.functions";
import { mentionImportance, sourceAuthority } from "@/lib/mention-intelligence";

const SENTIMENT_STYLE = {
  positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-destructive/10 text-destructive",
} as const;

const SENTIMENT_ICON = { positive: Smile, neutral: Meh, negative: Frown } as const;

function formatStamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${time} · ${date}`;
}

export function SocialMentionCard({ mention }: { mention: SocialMention }) {
  const SentimentIcon = SENTIMENT_ICON[mention.sentiment];
  const isNews = mention.platform === "news";
  const ChannelIcon = isNews ? Newspaper : Globe;
  const who = mention.authorName || mention.authorHandle || mention.sourceLabel;

  const fetchProfiles = useServerFn(listSocialProfiles);
  const { data: profiles } = useQuery({
    queryKey: ["social-profiles"],
    queryFn: () => fetchProfiles(),
    staleTime: 12 * 60 * 60 * 1000,
    enabled: !isNews,
  });
  const normalizedHandle = mention.authorHandle?.replace(/^@/, "").toLowerCase() ?? "";
  const profile = (profiles ?? []).find(
    (p) =>
      p.platform === mention.platform &&
      p.handle.replace(/^@/, "").toLowerCase() === normalizedHandle,
  );

  const engagement =
    Number(mention.likes ?? 0) + Number(mention.comments ?? 0) + Number(mention.shares ?? 0);
  const authority = sourceAuthority({
    verified: profile?.isVerified ?? false,
    isPublication: isNews,
    views: mention.views,
    engagement,
  });
  const importance = mentionImportance({
    sentiment: mention.sentiment,
    views: mention.views,
    engagement,
    authority,
  });

  const metrics = [
    { label: "Views", value: mention.views },
    ...(mention.platform === "youtube"
      ? [{ label: "Subscribers", value: profile?.followers ?? null }]
      : profile?.followers !== null && profile?.followers !== undefined
        ? [{ label: "Followers", value: profile.followers }]
        : []),
    { label: "Likes", value: mention.likes },
    { label: "Comments", value: mention.comments },
    { label: "Shares", value: mention.shares },
  ].filter((m) => m.value !== null && m.value !== undefined);

  const campaignText = mention.title || (mention.content ?? "").slice(0, 200);

  return (
    <li className="group rounded-2xl border border-border bg-background p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border/80 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {mention.authorAvatar || profile?.avatarUrl ? (
            <img
              src={mention.authorAvatar || profile?.avatarUrl || ""}
              alt={`${who} profile picture`}
              loading="lazy"
              className="size-10 shrink-0 rounded-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <ChannelIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{who}</p>
            <p className="truncate type-meta text-muted-foreground">
              {mention.authorHandle && !isNews
                ? `@${mention.authorHandle.replace(/^@/, "")}`
                : mention.sourceLabel}
            </p>
          </div>
        </div>
        <a
          href={mention.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Open the original"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 type-meta">
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
          {mention.sourceLabel}
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
          Authority: {authority}
        </span>
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
          {importance}
        </span>
      </div>

      <div className="mt-3 flex gap-4">
        {mention.thumbnailUrl ? (
          <img
            src={mention.thumbnailUrl}
            alt=""
            loading="lazy"
            className="hidden size-24 shrink-0 rounded-xl object-cover sm:block"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}

        <div className="min-w-0 flex-1">
          {mention.title ? (
            <a
              href={mention.url}
              target="_blank"
              rel="noreferrer"
              className="block text-[15px] font-semibold leading-snug text-foreground hover:underline"
            >
              {mention.title}
            </a>
          ) : null}
          {mention.content ? (
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{mention.content}</p>
          ) : null}
        </div>
      </div>

      {metrics.length > 0 ? (
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-baseline gap-1.5">
              <dt className="type-meta text-muted-foreground">{m.label}</dt>
              <dd className="text-sm font-semibold tabular-nums">{formatCount(m.value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {mention.entities.length > 0 ? (
        <p className="mt-2 truncate type-meta text-muted-foreground">
          {mention.entities.slice(0, 3).join(" · ")}
        </p>
      ) : null}

      <p className="mt-3 type-meta text-muted-foreground">{formatStamp(mention.publishedAt)}</p>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
        <span
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold capitalize ${SENTIMENT_STYLE[mention.sentiment]}`}
          title={mention.sentimentReason ?? undefined}
        >
          <SentimentIcon className="size-4" aria-hidden="true" />
          {mention.sentiment}
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
            search={{ text: campaignText, link: mention.url }}
            aria-label="Run a campaign about this"
          >
            <Megaphone className="size-4" aria-hidden="true" />
            Run campaign
          </Link>
        </Button>
      </div>
    </li>
  );
}
