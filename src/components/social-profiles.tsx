/**
 * The federation's own public pages on the other platforms, sitting beside the
 * X brand accounts at the top of Mentions. Same card language: picture, name,
 * one line of bio, three numbers.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Globe, Loader2, RefreshCw } from "lucide-react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui-kit";
import { VerifiedBadge } from "@/components/external-identity";
import { formatCount, sourceLabel } from "@/lib/apify-sources";
import { listSocialProfiles, refreshSocialProfiles } from "@/lib/apify-mentions.functions";

const STALE_MS = 12 * 60 * 60 * 1000;

export function SocialProfiles() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const fetchProfiles = useServerFn(listSocialProfiles);
  const doRefresh = useServerFn(refreshSocialProfiles);

  const { data, isPending } = useQuery({
    queryKey: ["social-profiles"],
    queryFn: () => fetchProfiles(),
    staleTime: STALE_MS,
  });

  const refresh = useMutation({
    mutationFn: () => doRefresh(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["social-profiles"] });
    },
    onError: () =>
      toast("Taking longer than usual to load", {
        description: "We'll keep trying in the background.",
      }),
  });

  const profiles = data ?? [];
  const oldest = profiles.reduce<number | null>((acc, p) => {
    const t = p.fetchedAt ? new Date(p.fetchedAt).getTime() : 0;
    return acc === null ? t : Math.min(acc, t);
  }, null);
  const stale =
    data !== undefined &&
    (profiles.length === 0 || oldest === null || Date.now() - oldest > STALE_MS);

  useEffect(() => {
    if (stale && !refresh.isPending) refresh.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);

  if (!isPending && profiles.length === 0 && !refresh.isPending) return null;

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
            aria-hidden="true"
          />
          <span className="min-w-0">
            <SectionTitle>Official pages</SectionTitle>
            <span className="type-meta mt-1 block text-muted-foreground">
              {open
                ? "The federation's own pages on the other platforms we listen to."
                : `${profiles.length} page${profiles.length === 1 ? "" : "s"}`}
            </span>
          </span>
        </button>
        {open ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            {refresh.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Check for updates
          </Button>
        ) : null}
      </div>

      {!open ? null : isPending || (profiles.length === 0 && refresh.isPending) ? (
        <p className="type-meta mt-4 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading pages…
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {profiles.map((p) => {
            const stats = [
              { label: p.platform === "youtube" ? "Subscribers" : "Followers", value: p.followers },
              { label: "Following", value: p.platform === "youtube" ? null : p.following },
              { label: p.platform === "youtube" ? "Videos" : "Posts", value: p.postsCount },
              { label: "Likes", value: p.likesCount },
            ]
              .filter((s) => s.value !== null && s.value !== undefined)
              .slice(0, 3);

            return (
              <article
                key={`${p.platform}-${p.handle}`}
                className="overflow-hidden rounded-xl border border-border"
              >
                {p.bannerUrl && p.platform !== "facebook" ? (
                  <img
                    src={p.bannerUrl}
                    alt={`${p.displayName ?? p.handle} cover`}
                    loading="lazy"
                    className="h-20 w-full object-cover"
                  />
                ) : null}
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
                          {formatCount(s.value)}
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
  );
}
