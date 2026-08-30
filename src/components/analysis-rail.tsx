import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Send, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { Analysis } from "@/lib/analysis";
import { Card } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  clusterReactions,
  confidenceLabel,
  engagementForecast,
  suggestionStats,
} from "@/lib/insights";

function toneColor(score: number) {
  if (score >= 75) return "var(--fkf-green)";
  if (score >= 55) return "var(--neutral)";
  return "var(--primary)";
}

export function Meter({ value, color }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${Math.max(2, Math.min(100, value))}%`,
          background: color ?? toneColor(value),
        }}
      />
    </div>
  );
}

function RailCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-card">{title}</h3>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

export function AnalysisRail({
  analysis,
  threadId,
  hideContext = false,
}: {
  analysis: Analysis;
  threadId: string;
  hideContext?: boolean;
}) {
  const clusters = clusterReactions(analysis).slice(0, 6);
  const forecast = engagementForecast(analysis);
  const best = analysis.suggestions[0];
  const bestStats = suggestionStats(analysis, 0);
  const [selectedMessage, setSelectedMessage] = useState(best?.message ?? "");

  useEffect(() => {
    setSelectedMessage(best?.message ?? "");
  }, [best?.message]);

  return (
    <div className="space-y-4">
      {best && (
        <RailCard title="Ready to use">
          <p className="type-meta text-muted-foreground">
            Review the recommended message, make any final edit, then move directly into campaign
            setup.
          </p>
          <Textarea
            value={selectedMessage}
            onChange={(e) => setSelectedMessage(e.target.value)}
            aria-label="Selected campaign message"
            className="mt-3 min-h-32 resize-y rounded-xl type-body"
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="rounded-full bg-fkf-green/10 px-2 py-1 type-meta font-semibold text-fkf-green">
              {bestStats.confidence}% confidence
            </span>
            <Link
              to="/recommendations/$threadId"
              params={{ threadId }}
              className="inline-flex items-center gap-1 type-meta font-semibold text-primary hover:underline"
            >
              Other versions <ArrowRight className="size-4" />
            </Link>
          </div>
          <Button
            asChild
            className="mt-3 w-full gap-2 rounded-xl"
            disabled={!selectedMessage.trim()}
          >
            <Link
              to="/campaign/$action"
              params={{ action: "post" }}
              search={{ text: selectedMessage.trim() }}
            >
              <Send className="size-4" /> Run campaign
            </Link>
          </Button>
        </RailCard>
      )}

      {!hideContext && (
        <RailCard title="Communication confidence">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-fkf-green">{analysis.confidence}%</span>
            <span className="type-meta font-medium text-muted-foreground">
              {confidenceLabel(analysis.confidence)}
            </span>
          </div>
          <div className="mt-3 flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className="h-2 flex-1 rounded-full"
                style={{
                  background:
                    i < Math.round(analysis.confidence / 10) ? "var(--fkf-green)" : "var(--muted)",
                }}
              />
            ))}
          </div>
        </RailCard>
      )}

      {!hideContext && (
        <RailCard title="Persona clusters">
          <ul className="space-y-3">
            {clusters.map((c) => (
              <li key={c.cluster}>
                <div className="flex items-center justify-between gap-2 type-meta">
                  <span className="min-w-0 truncate font-medium text-foreground">{c.cluster}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {c.count} · {c.score}%
                  </span>
                </div>
                <div className="mt-2">
                  <Meter value={c.score} />
                </div>
              </li>
            ))}
          </ul>
        </RailCard>
      )}

      {analysis.risks.length > 0 && (
        <RailCard title="Potential risks">
          <ul className="space-y-2">
            {analysis.risks.map((risk) => (
              <li key={risk} className="flex items-start gap-2 type-meta text-muted-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-negative" />
                {risk}
              </li>
            ))}
            {analysis.sentiment.positive >= 50 && (
              <li className="flex items-start gap-2 type-meta text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-fkf-green" />
                Positive public sentiment expected
              </li>
            )}
          </ul>
        </RailCard>
      )}

      <RailCard title="Engagement forecast">
        <ul className="space-y-2">
          {forecast.map((row) => (
            <li key={row.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 type-meta text-muted-foreground">{row.label}</span>
              <span className="min-w-0 flex-1">
                <Meter value={row.value} />
              </span>
              <span className="w-9 shrink-0 text-right type-meta font-semibold tabular-nums">
                {row.value}%
              </span>
            </li>
          ))}
        </ul>
      </RailCard>
    </div>
  );
}
