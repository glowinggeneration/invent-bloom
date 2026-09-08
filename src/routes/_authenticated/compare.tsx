import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, PageTitle, SectionTitle } from "@/components/ui-kit";
import type { Analysis } from "@/lib/analysis";
import { getThread, sendMessage } from "@/lib/smait.functions";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({
    meta: [
      { title: "Compare messages - SMAIT" },
      {
        name: "description",
        content: "Compare two or three message variants using the existing persona testing engine.",
      },
    ],
  }),
  component: CompareMessagesPage,
});

type Result = {
  threadId: string;
  text: string;
  analysis: Analysis;
};

const METRIC_LABELS: Record<keyof Analysis["metrics"], string> = {
  clarity: "Clarity",
  culturalFit: "Cultural fit",
  trust: "Trust",
  relevance: "Relevance",
  callToAction: "Call to action",
  shareability: "Shareability",
};

function weakestMetric(analysis: Analysis) {
  const entries = Object.entries(analysis.metrics) as [keyof Analysis["metrics"], number][];
  entries.sort((a, b) => a[1] - b[1]);
  const first = entries[0];
  return first ? `${METRIC_LABELS[first[0]]} ${first[1]}%` : "—";
}

function CompareMessagesPage() {
  const send = useServerFn(sendMessage);
  const fetchThread = useServerFn(getThread);
  const [variants, setVariants] = useState(["", ""]);
  const [results, setResults] = useState<Result[]>([]);

  const valid = variants.filter((value) => value.trim().length > 0);

  const compare = useMutation({
    mutationFn: async () => {
      const output: Result[] = [];
      for (const text of variants) {
        const clean = text.trim();
        if (!clean) continue;
        const created = await send({
          data: {
            threadId: null,
            text: clean,
            imageDataUrl: null,
            attachments: [],
          },
        });
        const thread = await fetchThread({ data: { threadId: created.threadId } });
        const analysis = [...(thread?.messages ?? [])]
          .reverse()
          .find((message) => message.analysis)?.analysis;
        if (!analysis) throw new Error("not found");
        output.push({ threadId: created.threadId, text: clean, analysis });
      }
      return output;
    },
    onSuccess: (output) => {
      setResults(output);
      toast.success(`Compared ${output.length} message variants.`);
    },
    onError: (error: Error) =>
      toast.error(friendlyError(error, { action: "compare these messages" })),
  });

  const ranked = useMemo(
    () => [...results].sort((a, b) => b.analysis.confidence - a.analysis.confidence),
    [results],
  );
  const winner = ranked[0]?.threadId ?? null;

  return (
    <WorkspaceShell title="Compare messages" wide>
      <PageTitle description="Run the same persona-testing engine against two or three versions and compare the results side by side.">
        Compare messages
      </PageTitle>

      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle>Message variants</SectionTitle>
            <p className="type-meta mt-1 text-muted-foreground">
              Each variant becomes a normal Response Studio test, so the full analysis remains
              available in Archive.
            </p>
          </div>
          {variants.length < 3 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVariants((current) => [...current, ""])}
            >
              <Plus className="size-4" /> Add third version
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {variants.map((variant, index) => (
            <div key={index} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="type-card font-semibold">Version {String.fromCharCode(65 + index)}</p>
                {variants.length > 2 ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Remove version ${String.fromCharCode(65 + index)}`}
                    onClick={() =>
                      setVariants((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              <Textarea
                value={variant}
                onChange={(event) =>
                  setVariants((current) =>
                    current.map((value, itemIndex) =>
                      itemIndex === index ? event.target.value : value,
                    ),
                  )
                }
                placeholder="Paste this message version…"
                className="mt-3 min-h-44 resize-y"
                maxLength={4000}
              />
              <p className="type-meta mt-2 text-right text-muted-foreground">
                {variant.length.toLocaleString()} / 4,000
              </p>
            </div>
          ))}
        </div>

        <Button
          className="mt-4"
          disabled={valid.length < 2 || compare.isPending}
          onClick={() => compare.mutate()}
        >
          {compare.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Compare {valid.length || 2} versions
        </Button>
      </Card>

      {ranked.length ? (
        <section className="mt-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" />
            <SectionTitle>Comparison result</SectionTitle>
          </div>
          <p className="type-meta mt-1 text-muted-foreground">
            The strongest version is ranked by the existing overall persona confidence score. Review
            the underlying analysis before publishing.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {ranked.map((result, index) => {
              const originalIndex = results.findIndex((item) => item.threadId === result.threadId);
              const label = `Version ${String.fromCharCode(65 + Math.max(0, originalIndex))}`;
              const best = result.threadId === winner;
              const topSuggestion = result.analysis.suggestions[0]?.message ?? result.text;
              return (
                <Card key={result.threadId} className={`p-5 ${best ? "border-primary" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="type-card font-semibold">{label}</p>
                      <p className="type-meta mt-1 text-muted-foreground">Rank #{index + 1}</p>
                    </div>
                    {best ? (
                      <span className="rounded-full bg-primary/10 px-2 py-1 type-meta font-semibold text-primary">
                        Strongest
                      </span>
                    ) : null}
                  </div>

                  <p className="type-display mt-4">{result.analysis.confidence}%</p>
                  <p className="type-meta text-muted-foreground">Overall confidence</p>

                  <dl className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <dt className="type-meta text-muted-foreground">Positive</dt>
                      <dd className="type-card mt-1 font-semibold">
                        {result.analysis.sentiment.positive}%
                      </dd>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <dt className="type-meta text-muted-foreground">Negative</dt>
                      <dd className="type-card mt-1 font-semibold">
                        {result.analysis.sentiment.negative}%
                      </dd>
                    </div>
                  </dl>

                  <p className="type-meta mt-4 text-muted-foreground">
                    Weakest area: {weakestMetric(result.analysis)}
                  </p>
                  <p className="type-body mt-3 line-clamp-4 text-muted-foreground">
                    {result.analysis.summary}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/chat/$threadId" params={{ threadId: result.threadId }}>
                        Full analysis <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link
                        to="/campaign/$action"
                        params={{ action: "post" }}
                        search={{ text: topSuggestion }}
                      >
                        Run campaign
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
    </WorkspaceShell>
  );
}
