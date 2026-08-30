import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radio } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { listNews } from "@/lib/news.functions";
import { SOCIAL_PROVIDERS, isSocialProvider } from "@/lib/news";

const BARS = [
  "hsl(0 72% 45%)",
  "hsl(150 55% 32%)",
  "hsl(0 0% 20%)",
  "hsl(0 72% 62%)",
  "hsl(150 40% 50%)",
  "hsl(0 0% 45%)",
  "hsl(24 80% 50%)",
  "hsl(210 70% 45%)",
];

/**
 * Every channel we listen to, and how much of the coverage in view came from
 * each. Lanes with nothing yet still show, so it is clear what is monitored.
 */
export function MentionSourcesCard({
  mentionCount,
  keywordCount,
  byPlatform = {},
}: {
  mentionCount: number;
  keywordCount: number;
  /** Item counts keyed by the social source label, e.g. "Facebook Groups". */
  byPlatform?: Record<string, number>;
}) {
  const fetchNews = useServerFn(listNews);
  const { data } = useQuery({
    queryKey: ["mention-sources-news"],
    queryFn: () => fetchNews({ data: { limit: 100 } }),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const articles = data?.articles ?? [];
  // Press wires are one line — which wire carried the story is not a decision
  // anyone makes from this card. Social platforms are listed individually.
  const news = articles.filter((a) => !isSocialProvider(a.provider)).length;
  const fromNews = (provider: string) => articles.filter((a) => a.provider === provider).length;
  const platform = (label: string) => (byPlatform[label] ?? 0) + fromNews(label);

  const rows = [
    { key: "mention", label: "X direct mentions", count: mentionCount },
    { key: "keyword", label: "X topic matches", count: keywordCount },
    { key: "facebook", label: "Facebook posts", count: platform("Facebook") },
    { key: "facebook_groups", label: "Facebook Groups", count: platform("Facebook Groups") },
    { key: "instagram", label: "Instagram", count: platform("Instagram") },
    { key: "tiktok", label: "TikTok", count: platform("TikTok") },
    { key: "linkedin", label: "LinkedIn", count: platform("LinkedIn") },
    { key: "youtube", label: "YouTube", count: platform("YouTube") },
    { key: "threads", label: "Threads", count: platform("Threads") },
    { key: "news", label: "News", count: news },
    ...SOCIAL_PROVIDERS.filter((p) => !["Facebook", "Instagram", "YouTube"].includes(p))
      .map((provider) => ({
        key: `news-${provider}`,
        label: provider,
        count: fromNews(provider),
      }))
      .filter((r) => r.count > 0),
  ];

  const total = rows.reduce((acc, r) => acc + r.count, 0);

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-default items-center gap-2">
            <Radio className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold leading-tight">Sources</h3>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-56">
          Where this coverage came from: posts on X, social platforms and press articles.
        </TooltipContent>
      </Tooltip>

      {rows.length === 0 ? (
        <p className="mt-3 text-[11px] text-muted-foreground">Nothing in view yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r, i) => {
            const share = total > 0 ? Math.round((r.count / total) * 100) : 0;
            return (
              <li key={r.key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-default">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate text-muted-foreground">{r.label}</span>
                        <span className="shrink-0 tabular-nums font-medium">{r.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(share, 2)}%`,
                            backgroundColor: BARS[i % BARS.length],
                          }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="w-56 p-0">
                    <div className="border-b border-border px-3 py-2">
                      <p className="truncate text-xs font-semibold">{r.label}</p>
                    </div>
                    <dl className="divide-y divide-border">
                      <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <dt className="text-[11px] text-muted-foreground">Items</dt>
                        <dd className="text-[11px] font-medium tabular-nums">
                          {r.count} of {total}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <dt className="text-[11px] text-muted-foreground">Share</dt>
                        <dd className="text-[11px] font-medium tabular-nums">{share}%</dd>
                      </div>
                    </dl>
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
