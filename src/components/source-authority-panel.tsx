import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radio } from "lucide-react";
import { SectionTitle } from "@/components/ui-kit";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { getSourceAuthority } from "@/lib/source-authority.functions";
import { ScoreRing, type ScoreRingTone } from "@/components/smait/primitives/score-ring";
import { VerifiedBadge } from "@/components/smait/verified-badge";
import {
  EvidenceDrawer,
  type EvidenceCitation,
} from "@/components/smait/primitives/evidence-drawer";

const AUTHORITY_SCORE = { High: 92, Medium: 62, Standard: 32 } as const;
const AUTHORITY_TONE: Record<keyof typeof AUTHORITY_SCORE, ScoreRingTone> = {
  High: "success",
  Medium: "warning",
  Standard: "muted",
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function SourceAuthorityPanel() {
  const fetchSources = useServerFn(getSourceAuthority);
  const { data, isPending } = useQuery({
    queryKey: ["overview-source-authority"],
    queryFn: () => fetchSources(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openSource = data?.find((s) => s.key === openKey) ?? null;
  const citations: EvidenceCitation[] =
    openSource?.citations.map((c) => ({
      id: c.id,
      title: c.title,
      source: openSource.name,
      ...(c.url ? { url: c.url } : {}),
      ...(c.timestamp ? { timestamp: c.timestamp } : {}),
    })) ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Radio className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <SectionTitle>Top sources by authority</SectionTitle>
          <p className="mt-1 type-meta text-muted-foreground">
            Prioritised from observable source type, verification, reach and engagement already
            collected by the platform. Click a source to see the mentions behind its score.
          </p>
        </div>
      </div>

      {isPending ? (
        <SkeletonRegion label="Reading source signals" className="mt-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-border py-3 last:border-0"
            >
              <Skeleton className="h-3 w-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-14 shrink-0" />
            </div>
          ))}
        </SkeletonRegion>
      ) : !data?.length ? (
        <p className="mt-4 type-meta text-muted-foreground">
          No source authority data is available in the current seven-day window.
        </p>
      ) : (
        <ol className="mt-3 max-h-[22rem] divide-y divide-border overflow-y-auto pr-1">
          {data.map((source, index) => (
            <li key={source.key}>
              <button
                type="button"
                onClick={() => source.citations.length && setOpenKey(source.key)}
                disabled={!source.citations.length}
                className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default"
              >
                <span className="w-5 shrink-0 text-right type-meta tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate type-body font-semibold">
                    <span className="truncate">{source.name}</span>
                    {source.verified ? (
                      <VerifiedBadge className="size-4 shrink-0" title="Verified source" />
                    ) : null}
                  </p>
                  <p className="mt-0.5 type-meta text-muted-foreground">
                    {source.channel} · {source.mentions} mention{source.mentions === 1 ? "" : "s"}
                    {source.views > 0 ? ` · ${fmt(source.views)} views` : ""}
                    {source.engagement > 0 ? ` · ${fmt(source.engagement)} engagements` : ""}
                    {source.citations.length ? " · view sources" : ""}
                  </p>
                </div>
                <ScoreRing
                  value={AUTHORITY_SCORE[source.authority]}
                  size={44}
                  stroke={5}
                  tone={AUTHORITY_TONE[source.authority]}
                  showValue={false}
                  animate={false}
                  className="shrink-0"
                />
                <span className="shrink-0 type-meta font-semibold text-muted-foreground">
                  {source.authority}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <EvidenceDrawer
        open={openSource !== null}
        onClose={() => setOpenKey(null)}
        title={openSource ? `Evidence — ${openSource.name}` : "Evidence & sources"}
        description="Sample mentions behind this source's authority score, most recent first."
        citations={citations}
      />
    </section>
  );
}
