import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Download,
  FileDown,
  Lightbulb,
  Link2,
  Lock,
  Pencil,
  Pin,
  Send,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AnalysisView } from "@/components/analysis-view";
import { AnalysisRail, Meter } from "@/components/analysis-rail";
import { Composer, type ComposerPayload } from "@/components/composer";
import { ShareMenu } from "@/components/share-menu";
import { completeActiveTest, interruptActiveTest, startActiveTest } from "@/lib/active-test";
import { TestProgress } from "@/components/test-progress";
import { AnalysisSkeleton } from "@/components/results-skeleton";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, EmptyState, StatCard } from "@/components/ui-kit";
import {
  CommandGrid,
  RailBar,
  RailCard,
  RailStat,
  RailStatList,
} from "@/components/command-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Analysis } from "@/lib/analysis";
import {
  clusterReactions,
  confidenceLabel,
  expectedReach,
  negativeBacklash,
  shareProbability,
} from "@/lib/insights";
import { downloadAnalysisPdf } from "@/lib/report-pdf";
import { getThread, sendMessage, updateThread } from "@/lib/smait.functions";
import { friendlyError } from "@/lib/friendly-errors";
import { setAnalysisStatus } from "@/lib/first-run";
import { LegalSafetyBadge } from "@/components/legal-safety-badge";
import { useCachedQuery } from "@/lib/offline-cache";
import { OfflineNotice } from "@/components/offline-notice";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Message test - SMAIT" },
      {
        name: "description",
        content:
          "Persona reactions, confidence scores and recommended rewrites for your tested message.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Message test - SMAIT" },
      {
        property: "og:description",
        content: "Persona reactions, confidence scores and recommended rewrites.",
      },
    ],
  }),
  component: ThreadPage,
});

function ExecutiveSummary({ analysis, threadId }: { analysis: Analysis; threadId: string }) {
  return (
    <Card className="p-6 shadow-[0_0_50px_-12px] shadow-primary/30 ring-1 ring-primary/15">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-section">Executive summary</h2>
        <span className="rounded-full bg-positive/10 px-2 py-1 type-meta font-semibold text-positive">
          {confidenceLabel(analysis.confidence)}
        </span>
      </div>
      {analysis.classification ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["Topic", analysis.classification.topic],
            ["Intent", analysis.classification.intent],
            ["Tone", analysis.classification.tone],
            ["Language", analysis.classification.language],
          ].map(([label, value]) => (
            <span
              key={label}
              className="rounded-full border border-border px-2 py-1 type-meta text-muted-foreground"
            >
              <span className="font-medium text-foreground">{label}:</span> {value}
            </span>
          ))}
          <span
            className={`rounded-full px-2 py-1 type-meta font-semibold capitalize ${
              analysis.classification.risk === "high"
                ? "bg-primary/10 text-primary"
                : analysis.classification.risk === "medium"
                  ? "bg-negative/10 text-negative"
                  : "bg-positive/10 text-positive"
            }`}
          >
            {analysis.classification.risk} risk
          </span>
        </div>
      ) : null}
      <p className="mt-4 type-body text-muted-foreground">{analysis.summary}</p>
      <p className="mt-2 type-meta text-muted-foreground">
        Simulated feedback from an AI persona panel - not measured public opinion.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Object.entries(analysis.metrics).map(([key, value]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 type-meta capitalize text-muted-foreground">
              {key.replace(/([A-Z])/g, " $1").toLowerCase()}
            </span>
            <span className="min-w-0 flex-1">
              <Meter value={value} />
            </span>
            <span className="w-9 shrink-0 text-right type-meta font-semibold tabular-nums">
              {value}%
            </span>
          </div>
        ))}
      </div>

      <Button asChild className="mt-4 gap-2 rounded-xl">
        <Link to="/recommendations/$threadId" params={{ threadId }}>
          <Lightbulb className="size-4" /> View recommendations
        </Link>
      </Button>
    </Card>
  );
}

function ResultsStrip({ analysis }: { analysis: Analysis }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard value={`${analysis.confidence}%`} label="Overall confidence" tone="positive" />
      <StatCard value={`${expectedReach(analysis)}%`} label="Expected reach" tone="positive" />
      <StatCard value={`${shareProbability(analysis)}%`} label="Share probability" tone="neutral" />
      <StatCard
        value={`${negativeBacklash(analysis)}%`}
        label="Negative backlash"
        tone="negative"
      />
    </div>
  );
}

function ResultsContextRail({ analysis }: { analysis: Analysis }) {
  const clusters = clusterReactions(analysis).slice(0, 6);
  const sentimentTotal =
    analysis.sentiment.positive + analysis.sentiment.neutral + analysis.sentiment.negative;
  return (
    <>
      <RailCard title="Confidence">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-positive">{analysis.confidence}%</span>
          <span className="type-meta text-muted-foreground">
            {confidenceLabel(analysis.confidence)}
          </span>
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{
                background:
                  i < Math.round(analysis.confidence / 10) ? "var(--positive)" : "var(--muted)",
              }}
            />
          ))}
        </div>
      </RailCard>

      <RailCard title="Sentiment mix">
        <RailBar label="Positive" value={analysis.sentiment.positive} total={sentimentTotal} />
        <RailBar label="Neutral" value={analysis.sentiment.neutral} total={sentimentTotal} />
        <RailBar label="Negative" value={analysis.sentiment.negative} total={sentimentTotal} />
      </RailCard>

      {analysis.classification ? (
        <RailCard title="Message context">
          <RailStatList>
            <RailStat label="Topic" value={analysis.classification.topic} />
            <RailStat label="Intent" value={analysis.classification.intent} />
            <RailStat label="Tone" value={analysis.classification.tone} />
            <RailStat label="Language" value={analysis.classification.language} />
            <RailStat
              label="Risk"
              value={analysis.classification.risk}
              tone={analysis.classification.risk === "low" ? "positive" : "negative"}
            />
          </RailStatList>
        </RailCard>
      ) : null}

      {clusters.length > 0 ? (
        <RailCard title="Persona clusters">
          {clusters.map((c) => (
            <RailBar
              key={c.cluster}
              label={c.cluster}
              value={c.score}
              total={100}
              valueLabel={`${c.count} · ${c.score}%`}
            />
          ))}
        </RailCard>
      ) : null}
    </>
  );
}

function ThreadPage() {
  const { threadId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchThread = useServerFn(getThread);
  const send = useServerFn(sendMessage);
  const patchThread = useServerFn(updateThread);
  const [renaming, setRenaming] = useState<string | null>(null);

  const queryKey = ["thread", threadId];

  const { data, isPending, isOffline, cachedAt } = useCachedQuery(queryKey, () =>
    fetchThread({ data: { threadId } }),
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["threads"] });
  };

  const mutation = useMutation({
    mutationFn: async (payload: ComposerPayload) =>
      send({
        data: {
          threadId,
          text: payload.text,
          imageDataUrl: payload.imageDataUrl,
          attachments: payload.attachments,
        },
      }),
    onMutate: (payload: ComposerPayload) => {
      setAnalysisStatus("running");
      startActiveTest({ threadId, text: payload.text });
    },
    onSuccess: (...args: Parameters<typeof refresh>) => {
      setAnalysisStatus("completed");
      completeActiveTest(threadId);
      return refresh(...args);
    },
    onError: (error: Error) => {
      const message = friendlyError(error, { action: "test this message" });
      setAnalysisStatus("failed", message);
      interruptActiveTest();
      toast.error(message);
    },
  });

  const update = useMutation({
    mutationFn: (input: {
      title?: string;
      visibility?: "private" | "workspace";
      pinned?: boolean;
    }) => patchThread({ data: { threadId, ...input } }),
    onSuccess: refresh,
    onError: (error: Error) =>
      toast.error(
        friendlyError(error, {
          action: "update this test",
          preserved: "Your test itself is unaffected.",
        }),
      ),
  });

  const thread = data?.thread;
  const messages = data?.messages ?? [];
  const latestAnalysis = [...messages].reverse().find((m) => m.analysis)?.analysis ?? null;

  function exportReport() {
    if (!latestAnalysis) return;
    const a = latestAnalysis;
    const lines = [
      `SMAIT - ${thread?.title ?? "Message test"}`,
      "",
      `Confidence: ${a.confidence}% (${confidenceLabel(a.confidence)})`,
      `Expected reach: ${expectedReach(a)}% · Share probability: ${shareProbability(a)}% · Negative backlash: ${negativeBacklash(a)}%`,
      "",
      "Verdict:",
      a.summary,
      "",
      "Risks:",
      ...a.risks.map((r) => `- ${r}`),
      "",
      "Recommendations:",
      ...a.suggestions.flatMap((s) => [`\n${s.title}`, s.message, `Why: ${s.rationale}`]),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "smait-report.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <WorkspaceShell title={thread?.title ?? "Message test"} wide>
      {thread && (
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {renaming === null ? (
              <h1 className="min-w-0 flex-1 truncate type-section">{thread.title}</h1>
            ) : (
              <form
                className="flex min-w-0 flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  update.mutate({ title: renaming });
                  setRenaming(null);
                }}
              >
                <Input value={renaming} onChange={(e) => setRenaming(e.target.value)} autoFocus />
                <Button type="submit" size="icon" variant="secondary" aria-label="Save name">
                  <Check className="size-4" />
                </Button>
              </form>
            )}

            {thread.isOwner ? (
              <div className="flex items-center gap-2">
                {latestAnalysis && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-xl"
                      onClick={() => {
                        void downloadAnalysisPdf(latestAnalysis, thread.title).then(() =>
                          toast.success("PDF report downloaded."),
                        );
                      }}
                    >
                      <FileDown className="size-4" /> PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-xl"
                      onClick={exportReport}
                    >
                      <Download className="size-4" /> Text
                    </Button>
                  </>
                )}
                <ShareMenu threadId={threadId} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copy link to this test"
                  onClick={() => {
                    void navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied.");
                  }}
                >
                  <Link2 className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Rename test"
                  onClick={() => setRenaming(thread.title)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={thread.pinned ? "Unpin test" : "Pin test"}
                  onClick={() => update.mutate({ pinned: !thread.pinned })}
                >
                  <Pin className={thread.pinned ? "size-4 text-primary" : "size-4"} />
                </Button>
                <Button
                  variant={thread.visibility === "workspace" ? "secondary" : "outline"}
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={() =>
                    update.mutate({
                      visibility: thread.visibility === "workspace" ? "private" : "workspace",
                    })
                  }
                >
                  {thread.visibility === "workspace" ? (
                    <>
                      <Users className="size-4" /> Shared with team
                    </>
                  ) : (
                    <>
                      <Lock className="size-4" /> Private
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <span className="rounded-full bg-secondary px-3 py-1 type-meta text-secondary-foreground">
                Shared by {thread.ownerName}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 type-meta text-muted-foreground">
            <span className="rounded-full bg-secondary px-2 py-1 font-medium text-secondary-foreground">
              Message test
            </span>
            {thread.confidence !== null && (
              <span
                className={`rounded-full px-2 py-1 font-semibold ${
                  thread.confidence >= 75
                    ? "bg-positive/10 text-positive"
                    : thread.confidence >= 60
                      ? "bg-neutral/15 text-foreground"
                      : "bg-primary/10 text-primary"
                }`}
              >
                {thread.confidence}% confidence
              </span>
            )}
            <span>
              {new Date(thread.createdAt).toLocaleString("en-KE", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
        </Card>
      )}

      {isPending && <AnalysisSkeleton />}

      {!isPending && !data && (
        <EmptyState
          title="We couldn't find this test. It may have been removed or you may not have access."
          action={
            <Button asChild variant="outline">
              <Link
                to="/archive"
                search={{ q: "", persona: "all", reaction: "all", date: "all", sort: "recent" }}
              >
                Back to archive
              </Link>
            </Button>
          }
        />
      )}

      {isOffline && data && (
        <div className="mb-4">
          <OfflineNotice cachedAt={cachedAt} label="analysis" />
        </div>
      )}

      {data && (
        <div className="animate-in fade-in space-y-5 duration-500">
          {latestAnalysis ? <ResultsStrip analysis={latestAnalysis} /> : null}
          <CommandGrid
            left={latestAnalysis ? <ResultsContextRail analysis={latestAnalysis} /> : null}
            right={
              latestAnalysis ? (
                <div className="xl:sticky xl:top-20">
                  <AnalysisRail analysis={latestAnalysis} threadId={threadId} hideContext />
                </div>
              ) : (
                <p className="rounded-2xl border border-border bg-card p-4 type-meta text-muted-foreground">
                  Insights will show up here once your message has been scored.
                </p>
              )
            }
          >
            <div className="min-w-0 space-y-6">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex flex-col items-end gap-2">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-3 text-background">
                      {message.imageUrl && (
                        <img
                          src={message.imageUrl}
                          alt="Tested creative"
                          loading="lazy"
                          className="mb-2 max-h-56 w-full rounded-xl object-cover"
                        />
                      )}
                      <p className="whitespace-pre-wrap type-body">{message.content}</p>
                      <p className="mt-2 type-meta opacity-70">
                        {new Date(message.createdAt).toLocaleString("en-KE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="gap-2 rounded-xl">
                      <Link
                        to="/publish"
                        search={{
                          text: message.content,
                          image: message.imageUrl ?? undefined,
                          mode: "tweet",
                        }}
                      >
                        <Send className="size-4" /> Publish
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div key={message.id}>
                    {message.analysis ? (
                      <div className="space-y-6">
                        <ExecutiveSummary analysis={message.analysis} threadId={threadId} />
                        {message.analysis.legal ? (
                          <Card className="p-6">
                            <h3 className="type-card">Legal &amp; reputational risk</h3>
                            <p className="mt-1 type-meta text-muted-foreground">
                              Checked for defamation, privacy and platform-policy exposure.
                            </p>
                            <LegalSafetyBadge legal={message.analysis.legal} />
                          </Card>
                        ) : null}
                        <AnalysisView analysis={message.analysis} analysisId={message.id} />
                      </div>
                    ) : (
                      <p className="type-body text-muted-foreground">{message.content}</p>
                    )}
                    <p className="mt-2 type-meta text-muted-foreground">
                      {new Date(message.createdAt).toLocaleString("en-KE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                ),
              )}

              {mutation.isPending && <TestProgress />}

              <div className="sticky bottom-4">
                <Composer
                  onSubmit={(p) => mutation.mutate(p)}
                  pending={mutation.isPending}
                  placeholder="Test a revised message…"
                  chips={[
                    { label: "Quick test", text: "Run a quick sentiment read on this message." },
                    { label: "Shorten", text: "Make this shorter and punchier." },
                    { label: "Make it stronger", text: "Make this message more persuasive." },
                    { label: "Add call to action", text: "Add a clear call to action." },
                    {
                      label: "Improve clarity",
                      text: "Rewrite this so it is clear on first read.",
                    },
                  ]}
                />
              </div>
            </div>
          </CommandGrid>
        </div>
      )}
    </WorkspaceShell>
  );
}
