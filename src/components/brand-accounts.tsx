import { VerifiedBadge } from "@/components/external-identity";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useLocation } from "@tanstack/react-router";
import { Globe, Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/ui-kit";
import { OverviewActions } from "@/components/overview-actions";
import { OverviewIntelligencePanel } from "@/components/overview-intelligence";
import { listBrandProfiles, refreshBrandProfiles } from "@/lib/brand-profiles.functions";
import { formatFollowers } from "@/lib/brand-profiles";
import { getBrandHealth } from "@/lib/brand-health.functions";
import { BRAND_HEALTH_PRESETS, presetRange } from "@/lib/brand-health";
import { listSocialProfiles, refreshSocialProfiles } from "@/lib/apify-mentions.functions";
import { formatCount, sourceLabel } from "@/lib/apify-sources";

const STALE_MS = 60 * 60 * 1000;
const SOCIAL_STALE_MS = 12 * 60 * 60 * 1000;

/** X's own default cover, shown when a profile has no banner picture. */
const X_DEFAULT_BANNER = "https://abs.twimg.com/images/themes/theme1/bg.png";

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

/** Live follower stats and profile pictures for the tracked brand accounts. */
export function BrandAccounts() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const fetchProfiles = useServerFn(listBrandProfiles);
  const doRefresh = useServerFn(refreshBrandProfiles);
  const fetchHealth = useServerFn(getBrandHealth);
  const fetchSocial = useServerFn(listSocialProfiles);
  const doSocialRefresh = useServerFn(refreshSocialProfiles);
  const onDashboard = location.pathname === "/dashboard";
  const dashboardRange = currentDashboardRange(location.searchStr || "");

  const { data, isPending } = useQuery({
    queryKey: ["brand-profiles"],
    queryFn: () => fetchProfiles(),
  });

  const { data: socialData } = useQuery({
    queryKey: ["social-profiles"],
    queryFn: () => fetchSocial(),
  });
  const socialProfiles = socialData ?? [];

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

  const socialRefresh = useMutation({
    mutationFn: () => doSocialRefresh(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["social-profiles"] });
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

  const socialOldest = socialProfiles.reduce<number | null>((acc, p) => {
    const t = p.fetchedAt ? new Date(p.fetchedAt).getTime() : 0;
    return acc === null ? t : Math.min(acc, t);
  }, null);
  const socialStale =
    socialData !== undefined &&
    (socialProfiles.length === 0 ||
      socialOldest === null ||
      Date.now() - socialOldest > SOCIAL_STALE_MS);

  useEffect(() => {
    if (socialStale && !socialRefresh.isPending) socialRefresh.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socialStale]);

  const busy = refresh.isPending || socialRefresh.isPending;
  const xCoverUrl = (data ?? []).find((profile) => profile.bannerUrl)?.bannerUrl;
  const checkAll = () => {
    refresh.mutate();
    socialRefresh.mutate();
  };

  return (
    <>
      {onDashboard && overviewData ? (
        <OverviewActions data={overviewData} rangeLabel={dashboardRange.label} />
      ) : null}
      {onDashboard ? <OverviewIntelligencePanel /> : null}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={checkAll}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <RefreshCw className={cn("size-3.5", busy && "animate-spin")} aria-hidden="true" />
          {busy ? "Refreshing…" : "Check for updates"}
        </button>
      </div>
      <section className="mt-2 rounded-2xl border border-border bg-card p-6">
        <div>
          <SectionTitle>Brand accounts</SectionTitle>
          <p className="type-meta mt-1 text-muted-foreground">
            Live followers and activity pulled straight from each platform.
          </p>
        </div>

        {isPending ? (
          <p className="type-meta mt-4 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading brand accounts…
          </p>
        ) : (data ?? []).length === 0 && socialProfiles.length === 0 ? (
          <p className="type-meta mt-4 text-muted-foreground">
            {busy ? "Pulling live profiles…" : "No brand profile data yet."}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(data ?? []).map((p) => (
              <article key={`x-${p.handle}`} className="overflow-hidden rounded-xl border border-border">
                <img
                  src={p.bannerUrl || X_DEFAULT_BANNER}
                  alt={`${p.displayName} cover`}
                  loading="lazy"
                  className="h-20 w-full object-cover"
                />
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
                      <p className="truncate type-meta text-muted-foreground">
                        {p.location ? `${p.location} · ` : ""}X · @{p.handle}
                      </p>
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

            {socialProfiles.map((p) => {
              const stats = [
                {
                  label: p.platform === "youtube" ? "Subscribers" : "Followers",
                  value: p.followers,
                },
                { label: "Following", value: p.platform === "youtube" ? null : p.following },
                {
                  label: p.platform === "youtube" ? "Videos" : "Posts",
                  value: p.postsCount,
                },
                { label: "Likes", value: p.likesCount },
              ]
                .filter((s) => s.value !== null && s.value !== undefined)
                .slice(0, 3);

              return (
                <article
                  key={`${p.platform}-${p.handle}`}
                  className="overflow-hidden rounded-xl border border-border"
                >
                  <img
                    src={p.bannerUrl || xCoverUrl || X_DEFAULT_BANNER}
                    alt={`${p.displayName ?? p.handle} cover`}
                    loading="lazy"
                    className="h-20 w-full object-cover"
                  />
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt={`${p.displayName ?? p.handle} profile picture`}
                          loading="lazy"
                          className="size-12 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary">
                          <Globe className="size-5 text-muted-foreground" aria-hidden="true" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="flex min-w-0 items-center gap-1 type-body font-semibold">
                          <span className="truncate">{p.displayName ?? p.handle}</span>
                          {p.isVerified ? <VerifiedBadge className="size-4" /> : null}
                        </p>
                        <p className="truncate type-meta text-muted-foreground">
                          {sourceLabel(p.platform, "post")} · @{p.handle}
                        </p>
                      </div>
                    </div>

                    {p.description ? (
                      <p className="mt-3 line-clamp-2 type-meta text-muted-foreground">
                        {p.description}
                      </p>
                    ) : null}

                    <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                      {stats.map((s) => (
                        <div key={s.label} className="rounded-lg bg-muted/50 p-2">
                          <dt className="type-meta text-muted-foreground">{s.label}</dt>
                          <dd className="type-body font-semibold tabular-nums">
                            {formatCount(s.value ?? 0)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
