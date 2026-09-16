import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listBrandMentions } from "@/lib/brand-mentions.functions";

import { WorkspaceShell } from "@/components/workspace-shell";
import { Card } from "@/components/ui-kit";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { OverviewStateGate, type SourceHealth } from "@/components/overview/state-gate";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import { listXAccounts } from "@/lib/publish.functions";
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
      { title: "Overview - SMAIT" },
      {
        name: "description",
        content:
          "See how your organisation and its leadership are being talked about — health, mood, trends, and what to do next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Overview - SMAIT" },
      {
        property: "og:description",
        content: "One screen for how your organisation is being talked about.",
      },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const [window, setWindow] = useState<OverviewWindow>("24h");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getOverview);
  const fetchIntel = useServerFn(getOverviewIntel);
  const fetchBrandHealth = useServerFn(getBrandHealth);
  const fetchXAccounts = useServerFn(listXAccounts);

  const { data: profile } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);

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

  // Connected-source health: this app only models it for X accounts, and
  // only administrators can see or manage connections (same gate as the
  // Linked Accounts page). Reuses that page's query key so the two share a
  // cache instead of double-fetching.
  const sourcesQuery = useQuery({
    queryKey: ["x-accounts", "all"],
    queryFn: () => fetchXAccounts({ data: { scope: "all" } }),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  const sources: SourceHealth[] = useMemo(
    () =>
      (sourcesQuery.data ?? []).map((account) => ({
        id: account.id,
        label: account.displayName || account.handle,
        status: account.suspended || !account.isActive || !account.hasToken ? "error" : "ready",
      })),
    [sourcesQuery.data],
  );

  const fetchBrandMentions = useServerFn(listBrandMentions);
  const collect = useMutation({
    mutationFn: () => fetchBrandMentions({ data: {} }),
    onSuccess: async (result) => {
      if (result?.error) {
        toast.error("Could not pull from X right now.");
      } else {
        toast.success(
          result?.mentions?.length
            ? `Pulled ${result.mentions.length} posts from X.`
            : "Checked X — no new qualifying posts.",
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () => toast.error("Could not pull from X right now."),
  });

  const refreshIntel = async () => {
    const fresh = await fetchIntel({ data: { refresh: true } });
    queryClient.setQueryData(["overview", "intel"], fresh);
  };


  const rangeLabel =
    OVERVIEW_WINDOWS.find((item) => item.value === window)?.label ?? "Current window";

  const lastCheckedLabel = overview.dataUpdatedAt
    ? `Checked ${new Date(overview.dataUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : undefined;

  return (
    <WorkspaceShell title="Overview" wide>
      <OverviewStateGate
        loading={overview.isLoading || (isAdmin && sourcesQuery.isLoading)}
        fatalQueryError={overview.isError || (!overview.isLoading && !overview.data)}
        sourcesKnown={isAdmin && !sourcesQuery.isLoading}
        sources={sources}
        empty={overview.data?.empty ?? false}
        range={window}
        lastCheckedLabel={lastCheckedLabel}
        isAdmin={isAdmin}
        onRangeChange={setWindow}
        onViewMentions={() => void navigate({ to: "/mentions" })}
        onOpenConnections={() => void navigate({ to: "/linked-accounts" })}
        onRefresh={() => {
          void overview.refetch();
          void intel.refetch();
          if (isAdmin) void sourcesQuery.refetch();
        }}
      >
        {overview.data ? (
          <div className="grid gap-5">
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
      </OverviewStateGate>
    </WorkspaceShell>
  );
}
