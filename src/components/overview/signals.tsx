import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui-kit";
import { SentimentBar } from "@/components/overview/health";
import { changeLabel, formatCompact, type OverviewData } from "@/lib/overview";
import { cn } from "@/lib/utils";

const STANCE_STYLE = {
  supportive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  critical: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
  unclear: "bg-muted text-muted-foreground",
} as const;

/** Centre column: the posts that actually travelled. */
export function TopContentCard({ data }: { data: OverviewData }) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2">
        <SectionTitle>Top content</SectionTitle>
        <Button variant="ghost" size="sm" asChild className="px-2">
          <Link to="/mentions">View all</Link>
        </Button>
      </div>
      {data.topContent.length === 0 ? (
        <p className="type-meta mt-3 text-muted-foreground">Nothing has measurable reach yet.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.topContent.slice(0, 4).map((c) => (
            <li key={c.url} className="flex gap-3 rounded-xl border border-border/60 p-3">
              {c.thumbnailUrl ? (
                <img
                  src={c.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="type-meta text-muted-foreground">
                  {c.platform} · {c.author}
                </p>
                <p className="type-body mt-0.5 line-clamp-2">{c.title}</p>
                <p className="type-meta mt-1 text-muted-foreground">
                  {formatCompact(c.engagements)} engagements
                  {c.views ? ` · ${formatCompact(c.views)} views` : ""}
                </p>
              </div>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="self-start rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Open post"
              >
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MomentumCard({ data }: { data: OverviewData }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
        <SectionTitle>Positive momentum</SectionTitle>
      </div>
      {data.momentum.length === 0 ? (
        <p className="type-meta mt-3 text-muted-foreground">
          Nothing is clearly trending positive yet.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {data.momentum.map((t) => (
            <li key={t.topic} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="type-body truncate">{t.topic}</p>
                <p className="type-meta shrink-0 tabular-nums text-muted-foreground">
                  {t.volume}
                  {changeLabel(t.changePct) ? ` · ${changeLabel(t.changePct)}` : ""}
                </p>
              </div>
              <SentimentBar split={t.sentiment} className="mt-2" />
              {t.topDriver ? (
                <p className="type-meta mt-2 line-clamp-2 text-muted-foreground">{t.topDriver}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {t.topDriverUrl ? (
                  <Button variant="ghost" size="sm" asChild className="px-2">
                    <a href={t.topDriverUrl} target="_blank" rel="noreferrer">
                      Open post
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </a>
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" asChild className="px-2">
                  <Link
                    to="/campaign/$action"
                    params={{ action: "post" }}
                    search={{ text: t.topic }}
                  >
                    Amplify
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function IssuesCard({ data }: { data: OverviewData }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-muted-foreground" aria-hidden="true" />
        <SectionTitle>Worth watching</SectionTitle>
      </div>
      {data.issues.length === 0 ? (
        <p className="type-meta mt-3 text-muted-foreground">
          Nothing negative is picking up in the last six hours.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {data.issues.map((t) => (
            <li
              key={t.topic}
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="type-body truncate">{t.topic}</p>
                <p className="type-meta shrink-0 tabular-nums text-destructive">
                  {t.negatives} negative
                  {changeLabel(t.negativeChangePct) ? ` · ${changeLabel(t.negativeChangePct)}` : ""}
                </p>
              </div>
              {t.topDriver ? (
                <p className="type-meta mt-2 line-clamp-2 text-muted-foreground">{t.topDriver}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {t.topDriverUrl ? (
                  <Button variant="ghost" size="sm" asChild className="px-2">
                    <Link
                      to="/campaign/$action"
                      params={{ action: "reply" }}
                      search={{ mode: "comment", target: t.topDriverUrl }}
                    >
                      Respond
                    </Link>
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" asChild className="px-2">
                  <Link to="/mentions" search={{ sentiment: "negative" }}>
                    See mentions
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AccountsCard({ data }: { data: OverviewData }) {
  return (
    <Card className="p-4">
      <SectionTitle className="type-card">Accounts driving the conversation</SectionTitle>
      {data.topAccounts.length === 0 ? (
        <p className="type-meta mt-3 text-muted-foreground">No accounts collected yet.</p>
      ) : (
        <ul className="mt-3 grid max-h-[22rem] gap-2 overflow-y-auto pr-1">
          {data.topAccounts.map((a) => (
            <li
              key={`${a.platform}-${a.handle}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="type-body truncate">{a.name || a.handle}</p>
                <p className="type-meta truncate text-muted-foreground">
                  {a.platform} · {a.posts} {a.posts === 1 ? "post" : "posts"} ·{" "}
                  {formatCompact(a.engagements)} engagements
                  {a.topTopic ? ` · ${a.topTopic}` : ""}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
                  STANCE_STYLE[a.stance],
                )}
              >
                {a.stance}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Supporting evidence, shown in the deeper intelligence band below the fold. */
export function OverviewSignals({ data }: { data: OverviewData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <MomentumCard data={data} />
      <IssuesCard data={data} />
    </div>
  );
}

export { AccountsCard };
