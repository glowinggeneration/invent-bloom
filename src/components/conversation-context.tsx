import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ExternalLink, Loader2, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui-kit";
import { getConversationContext } from "@/lib/conversation-context.functions";

function formatStamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

export function ConversationContextPanel() {
  const fetchContext = useServerFn(getConversationContext);
  const { data, isPending } = useQuery({
    queryKey: ["conversation-context"],
    queryFn: () => fetchContext(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isPending) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="flex items-center gap-2 type-body text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Tracing conversation flow…
        </p>
      </section>
    );
  }
  if (!data?.length) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <Network className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <SectionTitle>Conversation origin & amplification</SectionTitle>
          <p className="type-meta mt-1 text-muted-foreground">
            Earliest monitored source and strongest observed amplifiers across X, news and connected
            social channels in the last seven days.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {data.map((item) => (
          <article key={item.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="type-card font-semibold">{item.label}</p>
                <p className="mt-1 type-meta text-muted-foreground">
                  {item.mentions} monitored items in the current window
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1 px-2 text-primary"
              >
                <Link to="/mentions" search={{ topic: item.query }}>
                  Open <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>

            <div className="mt-3 rounded-xl bg-muted/35 p-3">
              <p className="type-meta font-semibold text-foreground">Likely origin</p>
              {item.origin ? (
                <div className="mt-1 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate type-body font-medium">{item.origin.label}</p>
                    <p className="type-meta text-muted-foreground">
                      {item.origin.source}
                      {item.origin.publishedAt ? ` · ${formatStamp(item.origin.publishedAt)}` : ""}
                    </p>
                  </div>
                  {item.origin.url ? (
                    <a
                      href={item.origin.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Open likely origin"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 type-meta text-muted-foreground">
                  Not enough history to identify.
                </p>
              )}
            </div>

            <div className="mt-3">
              <p className="type-meta font-semibold text-foreground">Amplified by</p>
              {item.amplifiers.length ? (
                <ul className="mt-2 space-y-2">
                  {item.amplifiers.map((source) => (
                    <li
                      key={`${source.source}-${source.label}`}
                      className="flex items-center justify-between gap-3 type-meta"
                    >
                      <span className="min-w-0 truncate text-foreground">
                        {source.label}{" "}
                        <span className="text-muted-foreground">· {source.source}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {source.views > 0
                          ? `${source.views.toLocaleString()} views`
                          : source.engagements > 0
                            ? `${source.engagements.toLocaleString()} engagements`
                            : `${source.mentions} mentions`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 type-meta text-muted-foreground">No clear amplifier yet.</p>
              )}
            </div>
          </article>
        ))}
      </div>

      <p className="mt-3 type-meta text-muted-foreground">
        “Likely origin” is the earliest matching item captured by this monitoring workspace. It does
        not claim to identify the first publication anywhere on the internet.
      </p>
    </section>
  );
}
