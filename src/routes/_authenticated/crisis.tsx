import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  Eye,
  MessageSquareText,
  RadioTower,
  ShieldAlert,
  Radar,
  Gauge,
  ListChecks,
} from "lucide-react";

import { DataFreshness } from "@/components/data-freshness";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, EmptyState, PageTitle, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  CommandGrid,
  RailAction,
  RailBar,
  RailCard,
  RailStat,
  RailStatList,
} from "@/components/command-layout";
import { listBrandMentions } from "@/lib/brand-mentions.functions";
import { downloadCommandReportPdf } from "@/lib/command-report-pdf";
import { getOverviewIntelligence } from "@/lib/overview-intelligence.functions";
import { getSourceAuthority } from "@/lib/source-authority.functions";

export const Route = createFileRoute("/_authenticated/crisis")({
  head: () => ({
    meta: [
      { title: "Crisis Command - FKF CommsIQ" },
      {
        name: "description",
        content:
          "One operational view of fast-moving risks, damaging mentions, authoritative sources and response actions.",
      },
    ],
  }),
  component: CrisisCommandPage,
});

function CrisisCommandPage() {
  const fetchIntel = useServerFn(getOverviewIntelligence);
  const fetchMentions = useServerFn(listBrandMentions);
  const fetchAuthority = useServerFn(getSourceAuthority);

  const intel = useQuery({
    queryKey: ["crisis", "intelligence"],
    queryFn: () => fetchIntel(),
    refetchInterval: 5 * 60 * 1000,
  });
  const mentions = useQuery({
    queryKey: ["crisis", "mentions"],
    queryFn: () => fetchMentions({ data: { cursor: "" } }),
    refetchInterval: 5 * 60 * 1000,
  });
  const authority = useQuery({
    queryKey: ["crisis", "authority"],
    queryFn: () => fetchAuthority(),
    refetchInterval: 10 * 60 * 1000,
  });

  const narratives = useMemo(
    () =>
      (intel.data?.narratives ?? [])
        .filter(
          (n) =>
            (n.importance === "Critical" || n.importance === "High impact") &&
            (n.velocity === "Breaking" ||
              n.velocity === "Fast rising" ||
              n.velocity === "Rising" ||
              n.negative > n.positive),
        )
        .slice(0, 5),
    [intel.data],
  );

  const damaging = useMemo(
    () =>
      (mentions.data?.mentions ?? [])
        .filter((m) => m.sentiment === "negative")
        .sort((a, b) => {
          const aImpact =
            a.viewCount +
            a.likeCount * 20 +
            (a.isVerified ? 500 : 0) +
            Math.abs(a.sentimentScore) * 100;
          const bImpact =
            b.viewCount +
            b.likeCount * 20 +
            (b.isVerified ? 500 : 0) +
            Math.abs(b.sentimentScore) * 100;
          return bImpact - aImpact;
        })
        .slice(0, 6),
    [mentions.data],
  );

  const highAuthority = (authority.data ?? [])
    .filter((source) => source.authority === "High")
    .slice(0, 5);
  const breaking = narratives.filter(
    (narrative) => narrative.velocity === "Breaking" || narrative.velocity === "Fast rising",
  ).length;
  const topRisk = intel.data?.risks[0] ?? null;
  const totalMentions = mentions.data?.mentions.length ?? 0;
  const negativeMentions = (mentions.data?.mentions ?? []).filter(
    (m) => m.sentiment === "negative",
  ).length;
  const verifiedDamaging = damaging.filter((m) => m.isVerified).length;
  const responseSeed = topRisk
    ? `Prepare a clear, factual response to this issue: ${topRisk.title}. ${topRisk.detail}`
    : narratives[0]
      ? `Prepare a clear, factual response to the ${narratives[0].label} conversation.`
      : "Prepare a clear, factual response to the most important current FKF conversation.";

  const platformMix = useMemo(() => {
    const counts = new Map<string, number>();
    for (const source of authority.data ?? []) {
      counts.set(source.channel, (counts.get(source.channel) ?? 0) + source.mentions);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [authority.data]);
  const platformTotal = platformMix.reduce((sum, [, count]) => sum + count, 0);

  const downloadIncident = () => {
    void downloadCommandReportPdf({
      title: "FKF Crisis Intelligence Brief",
      subtitle: "Current communication risks and observed amplification from monitored sources.",
      filename: `FKF-Crisis-Brief-${new Date().toISOString().slice(0, 10)}.pdf`,
      sections: [
        {
          heading: "Situation",
          stats: [
            {
              label: "Monitored mentions",
              value: String(intel.data?.currentMentions ?? 0),
              tone: "ink" as const,
            },
            {
              label: "Negative share",
              value: `${intel.data?.currentNegativeShare ?? 0}%`,
              tone: "red" as const,
            },
            { label: "Breaking narratives", value: String(breaking), tone: "red" as const },
          ],
          lines: [
            `${intel.data?.currentMentions ?? 0} monitored X mentions in the current comparison window.`,
            `${intel.data?.currentNegativeShare ?? 0}% negative share, ${intel.data?.negativeShift ?? 0} percentage points versus the previous period.`,
            `${breaking} breaking or fast-rising high-impact narratives.`,
          ],
        },
        {
          heading: "Priority narratives",
          chart: {
            title: "Narratives by monitored mentions",
            rows: narratives
              .slice(0, 6)
              .map((narrative) => ({ label: narrative.label, value: narrative.mentions })),
          },
          lines: narratives.map(
            (narrative) =>
              `${narrative.label}: ${narrative.importance}, ${narrative.velocity}, ${narrative.negative} negative of ${narrative.mentions} monitored mentions, ${narrative.growth}% period growth.`,
          ),
        },
        {
          heading: "Risks",
          lines: (intel.data?.risks ?? [])
            .slice(0, 5)
            .map((risk) => `${risk.title}: ${risk.detail}`),
        },
        {
          heading: "High-authority sources",
          lines: highAuthority.map(
            (source) =>
              `${source.name} (${source.channel}): ${source.mentions} mentions, ${source.views.toLocaleString()} recorded views.`,
          ),
        },
        {
          heading: "Recommended response path",
          lines: [
            "Investigate the source conversation.",
            "Draft a factual response.",
            "Test the response with personas.",
            "Approve and launch only after review.",
          ],
        },
      ],
    });
  };

  const leftRail = (
    <>
      <RailCard title="Severity" icon={Gauge}>
        <RailStatList>
          <RailStat
            label="Priority narratives"
            value={narratives.length}
            tone={narratives.length ? "negative" : "positive"}
          />
          <RailStat
            label="Breaking / fast rising"
            value={breaking}
            tone={breaking ? "negative" : "neutral"}
          />
          <RailStat
            label="Negative share"
            value={`${intel.data?.currentNegativeShare ?? 0}%`}
            tone={(intel.data?.currentNegativeShare ?? 0) >= 35 ? "negative" : "neutral"}
          />
        </RailStatList>
      </RailCard>

      <RailCard title="Signal counts" icon={Radar}>
        <RailStatList>
          <RailStat label="Monitored mentions" value={totalMentions} />
          <RailStat
            label="Negative mentions"
            value={negativeMentions}
            tone={negativeMentions ? "negative" : "neutral"}
          />
          <RailStat
            label="Verified damaging"
            value={verifiedDamaging}
            tone={verifiedDamaging ? "negative" : "neutral"}
          />
          <RailStat label="High-authority sources" value={highAuthority.length} />
        </RailStatList>
      </RailCard>

      <RailCard title="Platform mix" icon={ListChecks}>
        {platformMix.length ? (
          platformMix.map(([channel, count]) => (
            <RailBar
              key={channel}
              label={channel}
              value={count}
              total={platformTotal}
              valueLabel={count}
            />
          ))
        ) : (
          <p className="type-meta text-muted-foreground">No source mix available yet.</p>
        )}
      </RailCard>
    </>
  );

  const rightRail = (
    <>
      <RailCard title="Response path" icon={MessageSquareText}>
        <p className="type-meta text-muted-foreground">
          Move from evidence to a tested response without skipping review.
        </p>
        <div className="mt-3 grid gap-2">
          <RailAction to="/mentions" icon={Eye} title="1. Investigate conversation" />
          <RailAction
            to="/new"
            icon={MessageSquareText}
            title="2. Generate & test response"
            description={responseSeed.slice(0, 60) + (responseSeed.length > 60 ? "…" : "")}
          />
          <RailAction to="/preflight" icon={ShieldAlert} title="3. Campaign preflight" />
          <RailAction
            to="/campaign/overview"
            icon={ArrowUpRight}
            title="4. Create response campaign"
          />
        </div>
        <div className="mt-3">
          <Button asChild size="sm" className="w-full">
            <Link to="/new" search={{ text: responseSeed } as any}>
              <MessageSquareText className="size-4" /> Test response now
            </Link>
          </Button>
        </div>
      </RailCard>

      <RailCard title="Export & refresh" icon={Download}>
        <div className="grid gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadIncident}
            disabled={!intel.data}
            className="justify-start"
          >
            <Download className="size-4" /> Incident PDF
          </Button>
          <div className="pt-1">
            <DataFreshness
              at={mentions.data?.mentions[0]?.createdAt}
              label="Conversation"
              staleMinutes={60}
            />
          </div>
        </div>
      </RailCard>

      {topRisk ? (
        <RailCard title="Leading risk" icon={AlertTriangle} className="border-destructive/20">
          <p className="type-body font-semibold text-destructive">{topRisk.title}</p>
          <p className="mt-2 type-meta text-muted-foreground">{topRisk.detail}</p>
        </RailCard>
      ) : null}

      <RailCard title="High-authority sources" icon={Eye}>
        <div className="grid gap-2">
          {highAuthority.length ? (
            highAuthority.map((source) => (
              <div key={source.key} className="min-w-0 rounded-xl border border-border p-2.5">
                <p className="type-meta truncate font-semibold">{source.name}</p>
                <p className="mt-0.5 type-meta truncate text-muted-foreground">
                  {source.channel} · {source.mentions} mentions · {source.views.toLocaleString()}{" "}
                  views
                </p>
              </div>
            ))
          ) : (
            <p className="type-meta text-muted-foreground">
              No high-authority source is currently ranked in the seven-day window.
            </p>
          )}
        </div>
      </RailCard>
    </>
  );

  return (
    <WorkspaceShell title="Crisis Command" wide>
      <PageTitle
        description="A focused operational view for fast-moving communication risk. Signals are based on monitored data and should be verified before public action."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DataFreshness
              at={mentions.data?.mentions[0]?.createdAt}
              label="Conversation"
              staleMinutes={60}
            />
            <Button variant="outline" size="sm" onClick={downloadIncident} disabled={!intel.data}>
              <Download className="size-4" /> Incident PDF
            </Button>
          </div>
        }
      >
        Crisis Command
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Priority narratives"
          value={narratives.length}
          icon={ShieldAlert}
          tone={narratives.length ? "negative" : "positive"}
        />
        <StatCard
          label="Breaking / fast rising"
          value={breaking}
          icon={RadioTower}
          tone={breaking ? "negative" : "neutral"}
        />
        <StatCard
          label="Negative share"
          value={`${intel.data?.currentNegativeShare ?? 0}%`}
          icon={AlertTriangle}
          tone={(intel.data?.currentNegativeShare ?? 0) >= 35 ? "negative" : "neutral"}
        />
        <StatCard label="High-authority sources" value={highAuthority.length} icon={Eye} />
      </div>

      <div className="mt-5">
        <CommandGrid left={leftRail} right={rightRail}>
          <Card className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="type-section">Priority narratives</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/mentions">
                  All mentions <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </div>
            {narratives.length ? (
              <div className="mt-3 divide-y divide-border">
                {narratives.map((narrative) => (
                  <div key={narrative.id} className="min-w-0 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="type-body truncate font-semibold">{narrative.label}</p>
                        <p className="mt-1 type-meta text-muted-foreground">
                          {narrative.importance} · {narrative.velocity} · {narrative.lifecycle} ·{" "}
                          {narrative.mentions} mentions · {narrative.views.toLocaleString()}{" "}
                          recorded views
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive">
                        {narrative.negative} negative
                      </span>
                    </div>
                    {narrative.origin ? (
                      <p className="mt-2 type-meta text-muted-foreground">
                        Likely monitored origin: {narrative.origin.label || narrative.origin.handle}
                      </p>
                    ) : null}
                    {narrative.amplifiers.length ? (
                      <p className="mt-1 type-meta text-muted-foreground">
                        Amplified by{" "}
                        {narrative.amplifiers
                          .slice(0, 3)
                          .map((amplifier) => `@${amplifier.handle}`)
                          .join(", ")}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/mentions" search={{ topic: narrative.query } as any}>
                          Investigate
                        </Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link
                          to="/new"
                          search={
                            {
                              text: `Prepare a factual response to the ${narrative.label} conversation.`,
                            } as any
                          }
                        >
                          Test response
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No high-impact crisis narrative is currently detected"
                description="Continue monitoring. Rising signals will appear here when the stored conversation crosses the intelligence thresholds."
              />
            )}
          </Card>

          <Card className="min-w-0">
            <h2 className="type-section">Top damaging mentions</h2>
            {damaging.length ? (
              <div className="mt-3 divide-y divide-border">
                {damaging.map((mention) => (
                  <div key={mention.id} className="min-w-0 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="type-body truncate font-semibold">
                          {mention.authorName || `@${mention.authorHandle}`}
                        </p>
                        <p className="mt-1 line-clamp-2 type-meta text-muted-foreground">
                          {mention.text}
                        </p>
                        <p className="mt-1 type-meta text-muted-foreground">
                          {mention.viewCount.toLocaleString()} views ·{" "}
                          {mention.likeCount.toLocaleString()} likes
                          {mention.isVerified ? " · verified" : ""}
                        </p>
                      </div>
                      <a
                        href={mention.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-primary"
                        aria-label="Open original mention"
                      >
                        <ArrowUpRight className="size-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 type-meta text-muted-foreground">
                No negative X mentions are available in the current feed.
              </p>
            )}
          </Card>
        </CommandGrid>
      </div>
    </WorkspaceShell>
  );
}
