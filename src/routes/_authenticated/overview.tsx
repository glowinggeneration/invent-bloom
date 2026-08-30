import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { WorkspaceShell } from "@/components/workspace-shell";
import { PageTitle, Card } from "@/components/ui-kit";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import {
  ConversationMixCard,
  EntityFocusCard,
  OverviewKpis,
  VolumeCard,
} from "@/components/overview/health";
import {
  ConversationsToJoinCard,
  OverviewIntelPanel,
  TrendingTopicsCard,
} from "@/components/overview/intel";
import { AccountsCard, OverviewSignals, TopContentCard } from "@/components/overview/signals";
import { OfficialPosts } from "@/components/overview/official";
import { OverviewSectionNav } from "@/components/overview/section-nav";
import { SourceAuthorityPanel } from "@/components/source-authority-panel";
import { OverviewNextMove } from "@/components/overview-actions";
import {
  ComparedWithNormalCard,
  IntelligenceBriefSection,
  OpportunitiesCard,
  RisksCard,
  TopNarrativesCard,
} from "@/components/overview-intelligence";
import { ConversationContextPanel } from "@/components/conversation-context";
import { getOverview, getOverviewIntel } from "@/lib/overview.functions";
import { getBrandHealth } from "@/lib/brand-health.functions";
import { OVERVIEW_WINDOWS, type OverviewWindow } from "@/lib/overview";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({
    meta: [
      { title: "Overview - CommsIQ" },
      {
        name: "description",
        content:
          "See how Football Kenya Federation and President Hussein Mohammed are being talked about — health, mood, trends, and what to do next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Overview - CommsIQ" },
      {
        property: "og:description",
        content: "One screen for how the federation and the president are being talked about.",
      },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const [window, setWindow] = useState<OverviewWindow>("24h");
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getOverview);
  const fetchIntel = useServerFn(getOverviewIntel);
  const fetchBrandHealth = useServerFn(getBrandHealth);

  const overview = useQuery({
    queryKey: ["overview", "data", window],
    queryFn: () => fetchOverview({ data: { window } }),
    refetchInterval: 5 * 60 * 1000,
  });

  const intel = useQuery({
    queryKey: ["overview", "intel"],
    queryFn: () => fetchIntel({ data: { refresh: false } }),
    staleTime: 15 * 60 * 1000,
  });

  const brandHealthRange = useMemo(() => {
    if (!overview.data) return {};
    return {
      from: overview.data.from.slice(0, 10),
      to: overview.data.to.slice(0, 10),
    };
  }, [overview.data]);

  const brandHealth = useQuery({
    queryKey: ["overview", "brand-health", brandHealthRange.from ?? "", brandHealthRange.to ?? ""],
    queryFn: () => fetchBrandHealth({ data: brandHealthRange }),
    enabled: Boolean(overview.data),
    staleTime: 5 * 60 * 1000,
  });

  const refreshIntel = async () => {
    const fresh = await fetchIntel({ data: { refresh: true } });
    queryClient.setQueryData(["overview", "intel"], fresh);
  };

  const rangeLabel =
    OVERVIEW_WINDOWS.find((item) => item.value === window)?.label ?? "Current window";

  return (
    <WorkspaceShell title="Overview" wide>
      <PageTitle
        description="How the federation and the president are being talked about, across every connected platform."
        actions={
          <div className="flex items-center gap-1 rounded-full border border-border p-1">
            {OVERVIEW_WINDOWS.map((w) => (
              <button
                key={w.value}
                type="button"
                onClick={() => setWindow(w.value)}
                className={
                  w.value === window
                    ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    : "rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                }
              >
                {w.label}
              </button>
            ))}
          </div>
        }
      >
        Overview
      </PageTitle>

      {overview.isLoading ? (
        <SkeletonRegion label="Loading overview" className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4">
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="mt-3 h-7 w-1/3" />
              </div>
            ))}
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
            <div className="grid gap-4 xl:order-1">
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
            <div className="grid min-w-0 gap-4 xl:order-2">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
              <div className="grid gap-4 2xl:grid-cols-2">
                <Skeleton className="h-40 rounded-2xl" />
                <Skeleton className="h-40 rounded-2xl" />
              </div>
            </div>
            <div className="grid gap-4 xl:order-3">
              <Skeleton className="h-56 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
          </div>
        </SkeletonRegion>
      ) : overview.data ? (
        <div className="grid gap-5">
          {overview.data.empty ? (
            <Card className="p-5">
              <p className="type-body">Nothing here yet.</p>
              <p className="type-meta mt-1 text-muted-foreground">
                Check Mentions, or widen the time range.
              </p>
            </Card>
          ) : null}

          {/* Full-width executive KPIs */}
          <OverviewKpis data={overview.data} />

          {/* Left context · centre intelligence · right decisions */}
          <div className="grid items-start gap-5 xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
            <div className="grid gap-4 xl:order-1">
              <ConversationMixCard data={overview.data} />
              <EntityFocusCard data={overview.data} />
              <ComparedWithNormalCard />
            </div>

            <div className="grid min-w-0 gap-4 xl:order-2">
              <VolumeCard data={overview.data} />
              <TopNarrativesCard />
              <div className="grid gap-4 2xl:grid-cols-2">
                <ConversationContextPanel />
                <TopContentCard data={overview.data} />
              </div>
            </div>

            <div className="grid gap-4 xl:order-3">
              {brandHealth.data ? (
                <OverviewNextMove data={brandHealth.data} rangeLabel={rangeLabel} />
              ) : brandHealth.isLoading ? (
                <SkeletonRegion label="Loading recommended next move">
                  <Skeleton className="h-56 rounded-2xl" />
                </SkeletonRegion>
              ) : null}
              <RisksCard />
              <OpportunitiesCard />
              <ConversationsToJoinCard intel={intel.data} loading={intel.isFetching} />
            </div>
          </div>

          {/* Jump nav so the deeper sections are reachable from the top */}
          <OverviewSectionNav />

          {/* Deeper intelligence: dominant narrative column + narrow evidence column */}
          <div className="grid gap-5 border-t border-border pt-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="grid min-w-0 gap-4">
              <div id="signals" className="scroll-mt-28">
                <OverviewSignals data={overview.data} />
              </div>
              <div id="intelligence" className="scroll-mt-28">
                <OverviewIntelPanel
                  intel={intel.data}
                  loading={intel.isFetching}
                  onRefresh={() => void refreshIntel()}
                />
              </div>
              <div id="brief" className="scroll-mt-28">
                <IntelligenceBriefSection includeSourceAuthority={false} />
              </div>
              <div id="official" className="scroll-mt-28">
                <OfficialPosts />
              </div>
            </div>

            <div className="grid gap-4">
              <div id="accounts" className="scroll-mt-28">
                <AccountsCard data={overview.data} />
              </div>
              <div id="topics" className="scroll-mt-28">
                <TrendingTopicsCard intel={intel.data} loading={intel.isFetching} />
              </div>
              <div id="sources" className="scroll-mt-28">
                <SourceAuthorityPanel />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Card className="p-5">
          <p className="type-meta text-muted-foreground">We couldn't load this right now.</p>
        </Card>
      )}
    </WorkspaceShell>
  );
}
