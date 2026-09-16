import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Star, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AccountAvatar } from "@/components/account-identity";
import { getAudienceLocations } from "@/lib/audience-locations.functions";
import { listNews } from "@/lib/news.functions";
import { listSocialMentions, listSocialProfiles } from "@/lib/apify-mentions.functions";
import { SourceAvatar, faviconFor, type SourcePlatform } from "@/components/source-avatar";

const BARS = [
  "hsl(0 72% 45%)",
  "hsl(150 55% 32%)",
  "hsl(0 0% 20%)",
  "hsl(0 72% 62%)",
  "hsl(150 40% 52%)",
];

/**
 * Where the accounts we reply to and the accounts mentioning us are based.
 * Free-text profile locations are resolved to real places with Google Maps.
 */
export function useAudienceLocations(handles: string[]) {
  const fetchLocations = useServerFn(getAudienceLocations);
  const key = [...new Set(handles.map((h) => h.toLowerCase()))].sort().join(",");
  return useQuery({
    queryKey: ["audience-locations", key],
    queryFn: () => fetchLocations({ data: { handles } }),
    staleTime: 1000 * 60 * 30,
    retry: false,
  });
}

export function AudienceLocationsCard({ handles }: { handles: string[] }) {
  const { data, isLoading } = useAudienceLocations(handles);

  const rows = data?.locations ?? [];
  const placed = data?.placed ?? 0;
  const checked = data?.checked ?? 0;

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-default items-center gap-2">
            <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold leading-tight">Top locations</h3>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-56">
          Where the people we reply to and who mention us are based. {placed} of {checked} accounts
          had a location we could place.
        </TooltipContent>
      </Tooltip>

      {isLoading ? (
        <div className="mt-3 space-y-2" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-5 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {data?.error
            ? "Taking longer than usual to load."
            : "No profile locations we could place yet."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <li key={r.place}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-default">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-muted-foreground">{r.place}</span>
                      <span className="shrink-0 tabular-nums font-medium">{r.share}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${r.share}%`, backgroundColor: BARS[i % BARS.length] }}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="w-56 p-0">
                  <div className="border-b border-border px-3 py-2">
                    <p className="truncate text-xs font-semibold">{r.place}</p>
                  </div>
                  <dl className="divide-y divide-border">
                    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                      <dt className="text-[11px] text-muted-foreground">Accounts</dt>
                      <dd className="text-[11px] font-medium tabular-nums">
                        {r.count} of {placed}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                      <dt className="text-[11px] text-muted-foreground">Share</dt>
                      <dd className="text-[11px] font-medium tabular-nums">{r.share}%</dd>
                    </div>
                  </dl>
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const GENDER_ROWS = [
  { key: "female", label: "Women", color: "hsl(0 72% 45%)" },
  { key: "male", label: "Men", color: "hsl(150 55% 32%)" },
  { key: "unknown", label: "Unclear", color: "hsl(0 0% 60%)" },
] as const;

/**
 * Rough gender split of the accounts in view, read from profile display names.
 * Names we can't place stay in "Unclear" instead of being guessed.
 */
export function AudienceGenderCard({ handles }: { handles: string[] }) {
  const { data, isLoading } = useAudienceLocations(handles);
  const g = data?.gender;
  const total = g ? g.female + g.male + g.unknown : 0;

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-start gap-2">
        <Users className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">Gender split</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Estimated from the names on these profiles.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-5 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : total === 0 ? (
        <p className="mt-3 text-[11px] text-muted-foreground">No profiles to read yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {GENDER_ROWS.map((row) => {
            const count = g?.[row.key] ?? 0;
            const share = total ? Math.round((count / total) * 100) : 0;
            return (
              <li key={row.key}>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate text-muted-foreground">{row.label}</span>
                  <span className="shrink-0 tabular-nums font-medium">
                    {count} · {share}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${share}%`, backgroundColor: row.color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const fmtFollowers = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
      : String(n);

type RankedSource = {
  key: string;
  name: string;
  detail: string;
  href: string | null;
  avatarUrl: string | null;
  platform: SourcePlatform;
  audience: number;
  estimatedReach: number;
};

/**
 * Biggest people, publications and channels in the monitored conversation.
 * X accounts keep their existing estimated reach while news and other social
 * channels are ranked from the audience / view information already collected.
 */
export function AudienceInfluencersCard({ handles }: { handles: string[] }) {
  const { data, isLoading } = useAudienceLocations(handles);
  const fetchNews = useServerFn(listNews);
  const fetchSocial = useServerFn(listSocialMentions);
  const fetchProfiles = useServerFn(listSocialProfiles);

  const { data: newsData } = useQuery({
    queryKey: ["top-sources-news"],
    queryFn: () => fetchNews({ data: { limit: 60 } }),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const { data: socialData } = useQuery({
    queryKey: ["top-sources-social"],
    queryFn: () => fetchSocial({ data: { limit: 150 } }),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const { data: profiles } = useQuery({
    queryKey: ["social-profiles"],
    queryFn: () => fetchProfiles(),
    staleTime: 12 * 60 * 60 * 1000,
    retry: false,
  });

  const rows: RankedSource[] = [];
  for (const r of data?.influencers ?? []) {
    rows.push({
      key: `x-${r.handle}`,
      name: r.name,
      detail: `@${r.handle} · X`,
      href: `https://x.com/${r.handle}`,
      avatarUrl: r.avatarUrl,
      platform: "x",
      audience: r.followers,
      estimatedReach: r.estimatedReach,
    });
  }

  const publications = new Map<string, { count: number; href: string | null }>();
  for (const article of newsData?.articles ?? []) {
    const name = article.sourceId?.trim();
    if (!name) continue;
    const current = publications.get(name) ?? { count: 0, href: null };
    current.count += 1;
    current.href ||= article.link;
    publications.set(name, current);
  }
  for (const [name, p] of publications) {
    rows.push({
      key: `news-${name}`,
      name,
      detail: `News publication · ${p.count} article${p.count === 1 ? "" : "s"}`,
      href: p.href,
      avatarUrl: faviconFor(p.href),
      platform: "news",
      audience: p.count,
      estimatedReach: p.count * 1000,
    });
  }

  const profileMap = new Map(
    (profiles ?? []).map(
      (p) => [`${p.platform}:${p.handle.replace(/^@/, "").toLowerCase()}`, p] as const,
    ),
  );
  const channels = new Map<string, RankedSource>();
  for (const mention of socialData?.mentions ?? []) {
    if (mention.platform === "news") continue;
    const handle = mention.authorHandle?.replace(/^@/, "").toLowerCase() ?? "";
    const profile = handle ? profileMap.get(`${mention.platform}:${handle}`) : undefined;
    const name = mention.authorName || mention.authorHandle || mention.sourceLabel;
    const key = `${mention.platform}:${handle || name}`;
    const audience = profile?.followers ?? 0;
    const reach = Math.max(mention.views ?? 0, audience > 0 ? Math.round(audience * 0.05) : 0);
    const current = channels.get(key);
    if (!current || reach > current.estimatedReach) {
      channels.set(key, {
        key: `social-${key}`,
        name,
        detail: `${mention.sourceLabel}${handle ? ` · @${handle}` : ""}`,
        href: mention.url || profile?.profileUrl || null,
        avatarUrl: mention.authorAvatar || profile?.avatarUrl || null,
        platform: (mention.platform as SourcePlatform) ?? "other",
        audience,
        estimatedReach: reach,
      });
    }
  }
  rows.push(...channels.values());

  const ranked = rows
    .filter((r) => r.name)
    .sort((a, b) => b.estimatedReach - a.estimatedReach)
    .slice(0, 10);

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-default items-center gap-2">
            <Star className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold leading-tight">Top Sources</h3>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-64">
          The people, publications and channels carrying the most visible conversation in the
          current monitored data.
        </TooltipContent>
      </Tooltip>

      {isLoading ? (
        <div className="mt-3 space-y-2" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-6 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <p className="mt-3 text-[11px] text-muted-foreground">No sources to rank yet.</p>
      ) : (
        <ol className="mt-3 space-y-2.5">
          {ranked.map((r, i) => {
            const row = (
              <div className="flex items-center gap-2 rounded-md p-0.5 transition-colors hover:bg-muted/60">
                <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <SourceAvatar src={r.avatarUrl} name={r.name} platform={r.platform} />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium leading-tight">
                    {r.name}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {r.detail}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums font-medium text-muted-foreground">
                  {fmtFollowers(r.estimatedReach)}
                </span>
              </div>
            );
            return (
              <li key={r.key}>
                {r.href ? (
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {row}
                  </a>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
