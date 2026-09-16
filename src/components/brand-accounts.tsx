import { VerifiedBadge } from "@/components/external-identity";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useLocation } from "@tanstack/react-router";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/ui-kit";
import { OverviewActions } from "@/components/overview-actions";
import { OverviewIntelligencePanel } from "@/components/overview-intelligence";
import { listBrandProfiles, refreshBrandProfiles } from "@/lib/brand-profiles.functions";
import { formatFollowers } from "@/lib/brand-profiles";
import { getBrandHealth } from "@/lib/brand-health.functions";
import { BRAND_HEALTH_PRESETS, presetRange } from "@/lib/brand-health";

const STALE_MS = 60 * 60 * 1000;

function currentDashboardRange(search: string) {
  const params = new URLSearchParams(search);
  const range = params.get("range") || "all";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  if (range === "custom") {
    return {
      input: { from: from || undefined, to: to || undefined },
      label: `${from || "start"} → ${to || "today"}`,
    };
  }
  const preset = BRAND_HEALTH_PRESETS.find((p) => p.id === range);
  return {
    input: presetRange(preset ? preset.days : null),
    label: preset?.label ?? "All time",
  };
}

/** Live follower stats and profile pictures for the tracked X brand accounts. */
export function BrandAccounts() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const fetchProfiles = useServerFn(listBrandProfiles);
  const doRefresh = useServerFn(refreshBrandProfiles);
  const fetchHealth = useServerFn(getBrandHealth);
  const onDashboard = location.pathname === "/dashboard";
  const dashboardRange = currentDashboardRange(location.searchStr || "");

  const { data, isPending } = useQuery({
    queryKey: ["brand-profiles"],
    queryFn: () => fetchProfiles(),
  });

  const { data: overviewData } = useQuery({
    queryKey: ["overview-actions", dashboardRange.input.from ?? "", dashboardRange.input.to ?? ""],
    queryFn: () => fetchHealth({ data: dashboardRange.input }),
    enabled: onDashboard,
    staleTime: 5 * 60 * 1000,
  });

  const refresh = useMutation({
    mutationFn: () => doRefresh(),
    onSuccess: (res) => {
      queryClient.setQueryData(["brand-profiles"], res.profiles);
      if (res.error)
        toast("Taking longer than usual to load", {
          description: "We'll keep trying in the background.",
        });
    },
    onError: () =>
      toast("Taking longer than usual to load", {
        description: "We'll keep trying in the background.",
      }),
  });

  const oldest = (data ?? []).reduce<number | null>((acc, p) => {
    const t = p.fetchedAt ? new Date(p.fetchedAt).getTime() : 0;
    return acc === null ? t : Math.min(acc, t);
  }, null);
  const stale =
    data !== undefined && (data.length < 2 || oldest === null || Date.now() - oldest > STALE_MS);

  useEffect(() => {
    if (stale && !refresh.isPending) refresh.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);

  return (
    <>
      {onDashboard && overviewData ? (
        <OverviewActions data={overviewData} rangeLabel={dashboardRange.label} />
      ) : null}
      {onDashboard ? <OverviewIntelligencePanel /> : null}
      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionTitle>Brand accounts on X</SectionTitle>
            <p className="type-meta mt-1 text-muted-foreground">
              Live followers and activity pulled straight from X.
            </p>
          </div>
          <InlineAction
            label="Check for updates"
            icon={<RefreshCw className="size-4" aria-hidden="true" />}
            actionText="Refresh"
            onAction={() => refresh.mutateAsync().then(() => undefined)}
            className="w-auto max-w-none"
          />
        </div>

        {isPending ? (
          <p className="type-meta mt-4 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading brand accounts…
          </p>
        ) : (data ?? []).length === 0 ? (
          <p className="type-meta mt-4 text-muted-foreground">
            {refresh.isPending ? "Pulling live profiles…" : "No brand profile data yet."}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(data ?? []).map((p) => (
              <article key={p.handle} className="overflow-hidden rounded-xl border border-border">
                {p.bannerUrl && (
                  <img
                    src={p.bannerUrl}
                    alt={`${p.displayName} cover`}
                    loading="lazy"
                    className="h-20 w-full object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={`${p.displayName} profile picture`}
                        loading="lazy"
                        className="size-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <Users className="size-5 text-muted-foreground" aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-1 type-body font-semibold">
                        <span className="truncate">{p.displayName}</span>
                        {p.isVerified ? <VerifiedBadge className="size-4" /> : null}
                      </p>
                      {p.location && (
                        <p className="truncate type-meta text-muted-foreground">{p.location}</p>
                      )}
                    </div>
                  </div>

                  {p.description && (
                    <p className="mt-3 line-clamp-2 type-meta text-muted-foreground">
                      {p.description}
                    </p>
                  )}

                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Followers", value: formatFollowers(p.followers) },
                      { label: "Following", value: formatFollowers(p.following) },
                      { label: "Posts", value: formatFollowers(p.tweetCount) },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg bg-muted/50 p-2">
                        <dt className="type-meta text-muted-foreground">{s.label}</dt>
                        <dd className="type-body font-semibold tabular-nums">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
