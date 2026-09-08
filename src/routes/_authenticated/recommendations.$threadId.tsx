import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  ArrowLeft,
  Download,
  FileDown,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Meter } from "@/components/analysis-rail";
import { Card, EmptyState, StatCard } from "@/components/ui-kit";
import { downloadAnalysisPdf } from "@/lib/report-pdf";
import { WorkspaceShell } from "@/components/workspace-shell";
import { ShareMenu } from "@/components/share-menu";
import { TestProgress } from "@/components/test-progress";
import { RecommendationsSkeleton } from "@/components/results-skeleton";
import { readActiveTest } from "@/lib/active-test";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Analysis } from "@/lib/analysis";
import { negativeBacklash, shareProbability, suggestionStats } from "@/lib/insights";
import { getThread, sendMessage } from "@/lib/smait.functions";
import { friendlyError } from "@/lib/friendly-errors";
import { recordRecommendationCopied } from "@/lib/first-run";
import { LegalSafetyBadge } from "@/components/legal-safety-badge";
import { CopyConfirmationButton } from "@/components/core/copy-confirmation-button";

export const Route = createFileRoute("/_authenticated/recommendations/$threadId")({
  head: () => ({
    meta: [
      { title: "Recommendations - SMAIT" },
      {
        name: "description",
        content:
          "Three stronger versions of your tested message, each with projected confidence, share probability and backlash.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Recommendations - SMAIT" },
      {
        property: "og:description",
        content: "Three AI-recommended rewrites with projected performance against the original.",
      },
    ],
  }),
  component: RecommendationsPage,
});

const LETTERS = ["A", "B", "C", "D"];

function delta(next: number, base: number) {
  const diff = next - base;
  const sign = diff > 0 ? "+" : "";
  return { text: `${sign}${diff}%`, positive: diff >= 0 };
}

function RecommendationCard({
  analysis,
  index,
  suggestion,
}: {
  analysis: Analysis;
  index: number;
  suggestion: Analysis["suggestions"][number];
}) {
  const [value, setValue] = useState(suggestion.message);
  const stats = suggestionStats(analysis, index);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const runTest = useServerFn(sendMessage);

  const saveRun = useMutation({
    mutationFn: (text: string) => runTest({ data: { threadId: null, text } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      toast.success("Saved to your archive.");
      navigate({ to: "/chat/$threadId", params: { threadId: result.threadId } });
    },
    onError: (error: Error) =>
      toast.error(
        friendlyError(error, {
          action: "save that version",
          preserved: "Your edits are still in the box above.",
        }),
      ),
  });

  useEffect(() => setValue(suggestion.message), [suggestion.message]);

  const rows = [
    {
      label: "Confidence",
      value: stats.confidence,
      base: analysis.confidence,
      betterHigher: true,
    },
    {
      label: "Share probability",
      value: stats.share,
      base: shareProbability(analysis),
      betterHigher: true,
    },
    {
      label: "Negative backlash",
      value: stats.backlash,
      base: negativeBacklash(analysis),
      betterHigher: false,
    },
  ];

  async function copy() {
    await navigator.clipboard.writeText(value);
    recordRecommendationCopied(`Recommendation ${LETTERS[index]}`);
    toast.success(`Recommendation ${LETTERS[index]} copied to your clipboard`);
  }

  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 type-meta font-bold uppercase tracking-wide text-primary">
            Recommendation {LETTERS[index]}
          </span>
          <h2 className="mt-2 type-card">{suggestion.title}</h2>
          {suggestion.strategy ? (
            <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-1 type-meta font-medium capitalize text-muted-foreground">
              Strategy: {suggestion.strategy}
            </span>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold text-positive">{stats.confidence}%</p>
          <p className="type-meta text-muted-foreground">confidence</p>
        </div>
      </div>

      {suggestion.legal ? <LegalSafetyBadge legal={suggestion.legal} /> : null}

      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-3 min-h-36 resize-y rounded-xl text-sm"
        aria-label={`Recommendation ${LETTERS[index]} message`}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <CopyConfirmationButton
          size="sm"
          variant="secondary"
          className="rounded-xl"
          copy={copy}
          onCopyError={() =>
            toast.error("We couldn't copy that. Select the text and copy it manually instead.")
          }
        />
        <Button
          size="sm"
          variant="outline"
          className="gap-2 rounded-xl"
          disabled={saveRun.isPending || value.trim().length === 0}
          onClick={() => saveRun.mutate(value.trim())}
        >
          {saveRun.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Archive className="size-4" />
          )}
          Save to archive
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-2 rounded-xl"
          onClick={() => setValue(suggestion.message)}
        >
          Reset
        </Button>
      </div>

      <p className="mt-3 type-meta leading-relaxed text-muted-foreground">
        <Sparkles className="mr-1 inline size-4 text-primary" />
        {suggestion.rationale}
      </p>

      <div className="mt-4 space-y-2 border-t border-border pt-4">
        {rows.map((row) => {
          const d = delta(row.value - row.base, 0);
          const good = row.betterHigher ? row.value >= row.base : row.value <= row.base;
          return (
            <div key={row.label}>
              <div className="flex items-center justify-between gap-2 type-meta">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="flex items-center gap-1 tabular-nums">
                  <span className="font-semibold">{row.value}%</span>
                  <span className={good ? "text-positive" : "text-negative"}>
                    {d.text} vs original
                  </span>
                </span>
              </div>
              <div className="mt-2">
                <Meter value={row.value} color={good ? "var(--positive)" : "var(--negative)"} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function RecommendationsPage() {
  const { threadId } = Route.useParams();
  const fetchThread = useServerFn(getThread);

  const { data, isPending } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => fetchThread({ data: { threadId } }),
  });

  // A run that is still in flight for this thread gets the staged progress view.
  const [generating] = useState(() => {
    const active = readActiveTest();
    return !!active && active.threadId === threadId && active.status === "running";
  });

  const analysis = [...(data?.messages ?? [])].reverse().find((m) => m.analysis)?.analysis ?? null;

  function exportRecommendations() {
    if (!analysis) return;
    const lines = [
      `SMAIT - Recommendations for "${data?.thread.title ?? "Message test"}"`,
      "",
      `Original confidence: ${analysis.confidence}%`,
      "",
      ...analysis.suggestions.flatMap((s, i) => {
        const stats = suggestionStats(analysis, i);
        return [
          `Recommendation ${LETTERS[i]} - ${s.title}`,
          s.message,
          `Projected: ${stats.confidence}% confidence · ${stats.share}% share probability · ${stats.backlash}% backlash`,
          `Why: ${s.rationale}`,
          "",
        ];
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "smait-recommendations.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <WorkspaceShell title="Recommendations" wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2">
            <Link to="/chat/$threadId" params={{ threadId }}>
              <ArrowLeft className="size-4" /> Back to test
            </Link>
          </Button>
          <h1 className="mt-1 type-title">Recommendations</h1>
        </div>
        {analysis && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => {
                downloadAnalysisPdf(analysis, data?.thread.title ?? "Message test");
                toast.success("PDF report downloaded.");
              }}
            >
              <FileDown className="size-4" /> PDF
            </Button>
            <Button variant="outline" className="gap-2 rounded-xl" onClick={exportRecommendations}>
              <Download className="size-4" /> Text
            </Button>
            <ShareMenu threadId={threadId} />
          </div>
        )}
      </div>

      {isPending && (
        <div className="mt-5">
          {generating ? <TestProgress phase="recommendations" /> : <RecommendationsSkeleton />}
        </div>
      )}

      {!isPending && !analysis && (
        <EmptyState
          title="Nothing here yet. Recommendations will appear once your message has been tested."
          action={
            <Button asChild className="rounded-xl">
              <Link to="/chat/$threadId" params={{ threadId }}>
                Run a message test
              </Link>
            </Button>
          }
        />
      )}

      {analysis && (
        <div className="animate-in fade-in duration-500">
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <StatCard label="Original confidence" value={`${analysis.confidence}%`} />
            <StatCard
              label="Best projected confidence"
              value={`${suggestionStats(analysis, 0).confidence}%`}
              tone="positive"
            />
            <StatCard
              label="Potential uplift"
              value={
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="size-5" />+
                  {Math.max(0, suggestionStats(analysis, 0).confidence - analysis.confidence)}%
                </span>
              }
              tone="positive"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {analysis.suggestions.map((s, i) => (
              <RecommendationCard
                key={`${s.title}-${i}`}
                analysis={analysis}
                index={i}
                suggestion={s}
              />
            ))}
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
