import { ChevronDown, Download, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui-kit";
import { METRIC_LABELS, type Analysis } from "@/lib/analysis";
import { ChartDrilldown, type Drilldown } from "@/components/chart-drilldown";
import { ChartTooltip } from "@/components/chart-tooltip";
import { MetricGlossary } from "@/components/metric-glossary";
import { ChartAnnotations } from "@/components/chart-annotations";
import { analysisFingerprint } from "@/lib/annotations";
import { ChartDataTable, ChartHelpButton } from "@/components/chart-accessible";
import {
  BAND_HELP,
  CONFIDENCE_HELP,
  METRIC_HELP,
  SEGMENT_HELP,
  SENTIMENT_HELP,
} from "@/lib/chart-help";
import { recordRecommendationCopied } from "@/lib/first-run";
import { friendlyError } from "@/lib/friendly-errors";
import { RatingStars } from "@/components/foundations/rating-stars";
import { CompactPieChart, ComparisonRadarChart } from "@/components/smait/charts";
import { CopyConfirmationButton } from "@/components/core/copy-confirmation-button";

function Panel({
  title,
  subtitle,
  help,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Plain-language explanation shown on hover/focus of the info icon. */
  help?: string;
  /** Optional slot under the chart, used for annotations. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5">
        <h3 className="type-card">{title}</h3>
        {help && <ChartHelpButton title={title} help={help} />}
      </div>
      {subtitle && <p className="mt-1 type-meta text-muted-foreground">{subtitle}</p>}
      <div className="mt-3">{children}</div>
      {footer}
    </Card>
  );
}

/** Collapsed by default - deeper breakdowns live here so the verdict stays scannable. */
function Details({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 type-card [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-4 pb-4">{children}</div>
    </details>
  );
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "var(--positive)",
  neutral: "var(--neutral)",
  negative: "var(--negative)",
};

function ConfidenceRing({ value }: { value: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 128 128" className="size-28 -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--muted)" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
      </svg>
      <div>
        <p className="type-display text-foreground">{value}%</p>
        <p className="type-meta text-muted-foreground">
          Confidence this message lands with the 100-persona panel
        </p>
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Analysis["suggestions"][number] }) {
  const [value, setValue] = useState(suggestion.message);

  async function copy() {
    await navigator.clipboard.writeText(value);
    recordRecommendationCopied(suggestion.title || "a recommendation");
    toast.success(`Copied “${suggestion.title}” to your clipboard`);
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 type-card">{suggestion.title}</h4>
        <CopyConfirmationButton
          variant="ghost"
          size="sm"
          aria-label={`Copy recommendation: ${suggestion.title}`}
          className="min-h-11 shrink-0 gap-2 rounded-xl"
          copy={copy}
          onCopyError={(error) =>
            toast.error(friendlyError(error, { action: "copy this message" }))
          }
        />
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-2 min-h-28 resize-y rounded-xl type-body"
      />
      <p className="mt-2 type-meta text-muted-foreground">{suggestion.rationale}</p>
    </Card>
  );
}

function scoreBand(score: number) {
  if (score >= 80) return "80–100";
  if (score >= 60) return "60–79";
  if (score >= 40) return "40–59";
  if (score >= 20) return "20–39";
  return "0–19";
}

export function AnalysisView({
  analysis,
  analysisId,
}: {
  analysis: Analysis;
  /** Scopes saved annotations; falls back to a fingerprint of the result. */
  analysisId?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [drill, setDrill] = useState<Drilldown | null>(null);

  const notesId = useMemo(
    () => analysisId ?? analysisFingerprint(`${analysis.confidence}|${analysis.summary}`),
    [analysisId, analysis.confidence, analysis.summary],
  );
  const personaNames = useMemo(
    () => analysis.personaReactions.map((r) => r.name),
    [analysis.personaReactions],
  );
  const noteFooter = (target: string, targetLabel: string) => (
    <ChartAnnotations
      analysisId={notesId}
      target={target}
      targetLabel={targetLabel}
      personaNames={personaNames}
    />
  );

  const metricData = (Object.keys(analysis.metrics) as (keyof Analysis["metrics"])[]).map(
    (key) => ({ metric: METRIC_LABELS[key], value: analysis.metrics[key] }),
  );

  const sentimentData = [
    { name: "Positive", value: analysis.sentiment.positive, key: "positive" },
    { name: "Neutral", value: analysis.sentiment.neutral, key: "neutral" },
    { name: "Negative", value: analysis.sentiment.negative, key: "negative" },
  ];

  const sorted = useMemo(
    () => [...analysis.personaReactions].sort((a, b) => b.score - a.score),
    [analysis.personaReactions],
  );

  const distribution = useMemo(() => {
    const bands = ["0–19", "20–39", "40–59", "60–79", "80–100"];
    const counts = new Map(bands.map((b) => [b, 0]));
    for (const r of analysis.personaReactions) {
      const band = scoreBand(r.score);
      counts.set(band, (counts.get(band) ?? 0) + 1);
    }
    return bands.map((band) => ({ band, personas: counts.get(band) ?? 0 }));
  }, [analysis.personaReactions]);

  const segments = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const r of analysis.personaReactions) {
      const entry = map.get(r.segment) ?? { total: 0, count: 0 };
      entry.total += r.score;
      entry.count += 1;
      map.set(r.segment, entry);
    }
    return [...map.entries()]
      .map(([segment, v]) => ({
        full: segment,
        segment: segment.length > 30 ? `${segment.slice(0, 29)}…` : segment,
        score: Math.round(v.total / v.count),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [analysis.personaReactions]);

  const extremes = useMemo(() => [...sorted.slice(0, 10), ...sorted.slice(-10)], [sorted]);

  const visibleReactions = showAll ? sorted : extremes;

  function statsFor(list: Analysis["personaReactions"]) {
    const avg = list.length
      ? Math.round(list.reduce((sum, r) => sum + r.score, 0) / list.length)
      : 0;
    const positive = list.filter((r) => r.sentiment === "positive").length;
    return [
      { label: "Personas", value: String(list.length) },
      { label: "Avg score", value: `${avg}` },
      { label: "Positive", value: String(positive) },
    ];
  }

  function openDrill(title: string, subtitle: string, list: Analysis["personaReactions"]) {
    const ranked = [...list].sort((a, b) => b.score - a.score);
    setDrill({ title, subtitle, stats: statsFor(ranked), personas: ranked });
  }

  function drillSentiment(key: string, name: string) {
    openDrill(
      `${name} personas`,
      "Loudest voices in this group",
      analysis.personaReactions.filter((r) => r.sentiment === key),
    );
  }

  function drillBand(band: string) {
    openDrill(
      `Score band ${band}`,
      "Personas scoring in this range",
      analysis.personaReactions.filter((r) => scoreBand(r.score) === band),
    );
  }

  function drillSegment(label: string) {
    const match = segments.find((s) => s.segment === label);
    if (!match) return;
    openDrill(
      match.full,
      `Average score ${match.score}/100`,
      analysis.personaReactions.filter((r) => r.segment === match.full),
    );
  }

  function drillMetric(label: string) {
    const entry = metricData.find((m) => m.metric === label);
    if (!entry) return;
    setDrill({
      title: entry.metric,
      subtitle: `Scores ${entry.value}/100 - top reactions driving it`,
      stats: [
        { label: entry.metric, value: `${entry.value}` },
        { label: "Confidence", value: `${analysis.confidence}%` },
        { label: "Positive", value: `${analysis.sentiment.positive}%` },
      ],
      personas: sorted.slice(0, 8),
    });
  }

  function downloadReport() {
    const lines = [
      "SMAIT - Message test report",
      "",
      `Confidence: ${analysis.confidence}%`,
      `Sentiment: ${analysis.sentiment.positive}% positive / ${analysis.sentiment.neutral}% neutral / ${analysis.sentiment.negative}% negative`,
      "",
      "Verdict:",
      analysis.summary,
      "",
      "Scores:",
      ...Object.entries(analysis.metrics).map(
        ([k, v]) => `- ${METRIC_LABELS[k as keyof Analysis["metrics"]]}: ${v}`,
      ),
      "",
      "Risks:",
      ...analysis.risks.map((r) => `- ${r}`),
      "",
      "Recommended messages:",
      ...analysis.suggestions.flatMap((s) => [`\n${s.title}`, s.message, `Why: ${s.rationale}`]),
      "",
      "Persona panel (100):",
      ...sorted.map(
        (r) => `${r.score} | ${r.name} (${r.segment}) - ${r.reaction} → ${r.likelyAction}`,
      ),
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
    <div className="space-y-4">
      <Card className="p-4">
        <p className="type-body text-foreground">{analysis.summary}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 min-h-11 gap-2 rounded-xl"
          onClick={downloadReport}
        >
          <Download className="size-4" aria-hidden="true" /> Download report
        </Button>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel
          title="Confidence score"
          help={CONFIDENCE_HELP}
          footer={noteFooter("confidence", "confidence score")}
        >
          <button
            type="button"
            aria-label={`Show details for confidence score, ${analysis.confidence} percent`}
            className="w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() =>
              setDrill({
                title: "Confidence score",
                subtitle: `${analysis.confidence}% confidence across the panel`,
                stats: [
                  { label: "Confidence", value: `${analysis.confidence}%` },
                  { label: "Positive", value: `${analysis.sentiment.positive}%` },
                  { label: "Negative", value: `${analysis.sentiment.negative}%` },
                ],
                personas: sorted.slice(0, 8),
              })
            }
          >
            <ConfidenceRing value={analysis.confidence} />
          </button>
        </Panel>

        <Panel
          title="Panel sentiment"
          subtitle="Share of the 100 personas by reaction"
          help="How the 100-persona panel splits between supporting, ignoring and pushing back on this message. Hover a slice for what each reaction means."
          footer={noteFooter("sentiment", "panel sentiment")}
        >
          <CompactPieChart
            data={sentimentData.map((entry) => ({
              name: entry.name,
              value: entry.value,
              color: SENTIMENT_COLOR[entry.key],
            }))}
            height={180}
            innerRadius={40}
            outerRadius={68}
            ariaLabel="Panel sentiment"
            tooltipContent={
              <ChartTooltip help={SENTIMENT_HELP} suffix="%" valueLabel="of the panel" />
            }
            onSliceClick={(name) => {
              const match = sentimentData.find((entry) => entry.name === name);
              if (match) drillSentiment(match.key, match.name);
            }}
          />
          <ChartDataTable
            caption="Panel sentiment: share of the 100-persona panel by reaction"
            valueLabel="Share of panel"
            suffix="%"
            rows={sentimentData.map((d) => ({
              label: d.name,
              value: d.value,
              note: SENTIMENT_HELP[d.name],
            }))}
          />
        </Panel>
      </div>

      {analysis.risks.length > 0 && (
        <Panel title="Risks & objections">
          <ul className="space-y-2">
            {analysis.risks.map((risk) => (
              <li key={risk} className="flex items-start gap-2 type-body text-muted-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-negative" />
                {risk}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Details title="Details: charts, personas & rewrites">
        <p className="type-meta text-muted-foreground">
          Tap any chart to see the numbers and persona insights behind it.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Panel
            title="Message quality"
            subtitle="How the message scores on each dimension"
            help="Each spoke is scored 0-100. Hover a point to see what that dimension measures and where the message is weakest."
            footer={noteFooter("quality", "message quality")}
          >
            <ComparisonRadarChart
              data={metricData}
              labelKey="metric"
              series={[{ dataKey: "value", label: "Message score", color: "var(--primary)" }]}
              height={230}
              ariaLabel="Message quality scores"
              tooltipContent={<ChartTooltip help={METRIC_HELP} valueLabel="/ 100" />}
              onLabelSelect={drillMetric}
            />
            <ChartDataTable
              caption="Message quality scores by dimension"
              valueLabel="Score / 100"
              rows={metricData.map((d) => ({
                label: d.metric,
                value: d.value,
                note: METRIC_HELP[d.metric],
              }))}
            />
          </Panel>

          <Panel
            title="Score distribution"
            subtitle="How many personas fall in each score band"
            help="Counts personas by how positively they receive the message. A tall left side means the message loses people."
            footer={noteFooter("distribution", "score distribution")}
          >
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={distribution}
                margin={{ left: -20, right: 8 }}
                className="cursor-pointer"
                onClick={(state: { activeLabel?: string }) =>
                  state?.activeLabel && drillBand(state.activeLabel)
                }
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="band" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  content={<ChartTooltip help={BAND_HELP} valueLabel="personas" />}
                />
                <Bar dataKey="personas" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <ChartDataTable
              caption="Score distribution: personas in each score band"
              valueLabel="Personas"
              rows={distribution.map((d) => ({
                label: d.band,
                value: d.personas,
                note: BAND_HELP[d.band],
              }))}
            />
          </Panel>
        </div>

        <Panel
          title="Receptivity by audience segment"
          subtitle="Average score out of 100"
          help="Average persona score per audience segment. Short bars are the audiences to rewrite for."
          footer={noteFooter("segments", "audience segments")}
        >
          <ResponsiveContainer width="100%" height={Math.max(280, segments.length * 34)}>
            <BarChart
              data={segments}
              layout="vertical"
              margin={{ left: 4, right: 16 }}
              className="cursor-pointer"
              onClick={(state: { activeLabel?: string }) =>
                state?.activeLabel && drillSegment(state.activeLabel)
              }
            >
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis
                type="category"
                dataKey="segment"
                width={200}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                content={<ChartTooltip help={SEGMENT_HELP} valueLabel="/ 100 average" />}
              />
              <Bar dataKey="score" fill="var(--chart-2)" radius={[4, 4, 4, 4]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
          <ChartDataTable
            caption="Receptivity by audience segment"
            valueLabel="Average score / 100"
            rows={segments.map((d) => ({ label: d.segment, value: d.score, note: SEGMENT_HELP }))}
          />
        </Panel>

        <Panel
          title="How the panel reacts"
          subtitle={
            showAll
              ? "All 100 personas, highest to lowest"
              : "Top 10 advocates and 10 hardest rejections"
          }
        >
          <ul className="divide-y divide-border">
            {visibleReactions.map((r) => (
              <li key={r.personaId} className="flex items-start gap-3 py-3">
                <span
                  className="mt-2 size-2 shrink-0 rounded-full"
                  style={{ background: SENTIMENT_COLOR[r.sentiment] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="type-card font-medium text-foreground">
                    {r.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {r.segment} · {r.location}
                    </span>
                  </p>
                  <p className="mt-1 type-body text-muted-foreground">“{r.reaction}”</p>
                  <p className="mt-1 type-meta text-muted-foreground">
                    Likely action: {r.likelyAction}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block type-card font-semibold text-foreground">{r.score}</span>
                  <RatingStars
                    rating={r.score / 20}
                    size="xs"
                    className="mt-1"
                    label={`${r.name} scored ${r.score} out of 100`}
                  />
                </div>
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showAll}
            className="mt-2 min-h-11 w-full gap-2 rounded-xl"
            onClick={() => setShowAll((v) => !v)}
          >
            <ChevronDown className={showAll ? "size-4 rotate-180" : "size-4"} aria-hidden="true" />
            {showAll ? "Show fewer" : "Show all 100 personas"}
          </Button>
        </Panel>

        {analysis.suggestions.length > 0 && (
          <div className="space-y-3">
            <h3 className="type-section">Recommended messages</h3>
            <div className="grid gap-3">
              {analysis.suggestions.map((s, i) => (
                <SuggestionCard key={`${s.title}-${i}`} suggestion={s} />
              ))}
            </div>
          </div>
        )}
      </Details>

      <MetricGlossary />

      <ChartDrilldown drill={drill} onOpenChange={(open) => !open && setDrill(null)} />
    </div>
  );
}
