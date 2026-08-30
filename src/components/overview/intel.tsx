import { Link } from "@tanstack/react-router";
import { ChevronDown, Lightbulb, MessagesSquare, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, SectionTitle } from "@/components/ui-kit";
import { SentimentBar } from "@/components/overview/health";
import { changeLabel, type OverviewIntel, type Recommendation } from "@/lib/overview";
import { cn } from "@/lib/utils";

const CATEGORY_STYLE: Record<Recommendation["category"], string> = {
  AMPLIFY: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  RESPOND: "bg-destructive/10 text-destructive",
  JOIN: "bg-primary/10 text-primary",
  WATCH: "bg-muted text-muted-foreground",
  PUBLISH: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "not generated yet";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

/** Right rail: openings the federation can step into. */
export function ConversationsToJoinCard({
  intel,
  loading,
}: {
  intel: OverviewIntel | undefined;
  loading: boolean;
}) {
  const joinable = intel?.joinable ?? [];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <MessagesSquare className="size-4 text-muted-foreground" aria-hidden="true" />
        <SectionTitle className="type-card">Conversations to join</SectionTitle>
      </div>
      {joinable.length === 0 ? (
        <p className="type-meta mt-2 text-muted-foreground">
          {loading ? "Reading the conversation…" : "Nothing worth entering right now."}
        </p>
      ) : (
        <ul className="mt-3 grid gap-2.5">
          {joinable.slice(0, 3).map((c) => (
            <li key={c.topic} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="type-body truncate">{c.topic}</p>
                {c.volume > 0 ? (
                  <p className="type-meta shrink-0 tabular-nums text-muted-foreground">
                    {c.volume}
                  </p>
                ) : null}
              </div>
              <p className="type-meta mt-1 line-clamp-2 text-muted-foreground">{c.why}</p>
              <Button variant="outline" size="sm" asChild className="mt-2 w-full">
                <Link
                  to="/campaign/$action"
                  params={{ action: "intercept" }}
                  search={{ text: c.topic }}
                >
                  Join the conversation
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * The reading layer: what is trending, what it means and what to do next.
 * Volumes and sentiment come from collected posts; the sentences are written
 * from those numbers.
 */

/** Narrow-column card: what topics are trending right now, in a scroll-capped list. */
export function TrendingTopicsCard({
  intel,
  loading,
}: {
  intel: OverviewIntel | undefined;
  loading: boolean;
}) {
  const trending = intel?.trending ?? [];

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4 text-muted-foreground" aria-hidden="true" />
        <SectionTitle className="type-card">Trending topics</SectionTitle>
      </div>
      {trending.length === 0 ? (
        <p className="type-meta mt-3 text-muted-foreground">
          {loading
            ? "Reading the conversation…"
            : "No topic has enough conversation behind it yet."}
        </p>
      ) : (
        <ul className="mt-3 grid max-h-[26rem] gap-2 overflow-y-auto pr-1">
          {trending.map((t) => (
            <li key={t.topic}>
              <details className="group rounded-xl border border-border/60 px-3 py-2.5 transition-colors open:bg-muted/30 hover:bg-muted/40">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="type-body block truncate">{t.topic}</span>
                    <span className="type-meta text-muted-foreground">
                      {t.volume} {t.volume === 1 ? "post" : "posts"}
                      {changeLabel(t.momentumPct) ? ` · ${changeLabel(t.momentumPct)}` : ""}
                    </span>
                  </span>
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <SentimentBar split={t.sentiment} className="mt-3" />
                <div className="mt-3 grid gap-2">
                  {[
                    { label: "Why", text: t.why },
                    { label: "Relevance", text: t.relevance },
                    { label: "Opportunity", text: t.opportunity },
                  ]
                    .filter((r) => r.text)
                    .map((r) => (
                      <p key={r.label} className="type-meta text-muted-foreground">
                        <span className="font-medium text-foreground">{r.label}: </span>
                        {r.text}
                      </p>
                    ))}
                </div>
                <Button variant="outline" size="sm" asChild className="mt-3">
                  <Link
                    to="/campaign/$action"
                    params={{ action: "post" }}
                    search={{ text: t.opportunity }}
                  >
                    Start a post
                  </Link>
                </Button>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Dominant-column panel: the reading layer distilled into what it means and what to do next. */
export function OverviewIntelPanel({
  intel,
  loading,
  onRefresh,
}: {
  intel: OverviewIntel | undefined;
  loading: boolean;
  onRefresh: () => void;
}) {
  const insights = intel?.insights ?? [];
  const recommendations = intel?.recommendations ?? [];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>What's happening</SectionTitle>
        <div className="flex items-center gap-3">
          <span className="type-meta text-muted-foreground">
            Updated {relativeTime(intel?.generatedAt ?? null)}
          </span>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden="true" />
            Check for updates
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-muted-foreground" aria-hidden="true" />
            <SectionTitle>What this means</SectionTitle>
          </div>
          {insights.length === 0 ? (
            <p className="type-meta mt-3 text-muted-foreground">
              Not enough here yet to read into.
            </p>
          ) : (
            <ul className="mt-4 grid gap-2.5">
              {insights.map((i) => (
                <li key={i.text} className="type-body flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{i.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>What to do next</SectionTitle>
          {recommendations.length === 0 ? (
            <EmptyState
              title="Nothing to act on right now"
              description="Nothing right now needs a response."
            />
          ) : (
            <ul className="mt-4 grid gap-3">
              {recommendations.map((r) => (
                <li key={r.headline} className="rounded-xl border border-border/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[0.7rem] font-semibold tracking-wide",
                        CATEGORY_STYLE[r.category],
                      )}
                    >
                      {r.category}
                    </span>
                    <p className="type-body min-w-0 flex-1 truncate">{r.headline}</p>
                  </div>
                  <p className="type-meta mt-1.5 text-muted-foreground">{r.action}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
