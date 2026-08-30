import type { PerformanceSummary } from "./performance";

/**
 * Turns raw performance numbers into the narrative shape of a campaign
 * report: a reporting window, headline figures, peak days, share of voice
 * and plain-language "what worked / where we go next" reads.
 */

/** Rough advertising value equivalent: earned impressions priced at a CPM. */
const AVE_CPM_USD = 6.5;

export type ReportSection = { title: string; body: string };

export type PerformanceReport = {
  window: { start: string | null; end: string | null; days: number };
  headline: {
    posts: number;
    reach: number;
    engagements: number;
    impressions: number;
    engagementRate: number;
    aveUsd: number;
    personas: number;
    campaigns: number;
  };
  summaryParagraph: string;
  peakDays: { date: string; reach: number; engagements: number }[];
  peakReachDay: { date: string; reach: number } | null;
  sources: { name: string; value: number; share: number }[];
  shareOfVoice: { handle: string; name: string; posts: number; reach: number; share: number }[];
  worked: ReportSection[];
  next: ReportSection[];
};

function pct(part: number, whole: number) {
  return whole > 0 ? Number(((part / whole) * 100).toFixed(1)) : 0;
}

export type ReportOptions = {
  /** Maps a raw X handle to the persona display name shown across the app. */
  resolveName?: (handle: string) => string;
};

export function buildPerformanceReport(
  summary: PerformanceSummary,
  options: ReportOptions = {},
): PerformanceReport {
  const nameOf = (handle: string) => options.resolveName?.(handle) || handle;
  const { totals, byDay, byAccount, byCampaign, rows } = summary;

  const dates = byDay.map((d) => d.date).sort();
  const start = dates[0] ?? null;
  const end = dates[dates.length - 1] ?? null;
  const days =
    start && end
      ? Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1)
      : 0;

  const personas = new Set(rows.map((r) => r.handle).filter(Boolean)).size;
  const aveUsd = Math.round((totals.impressions / 1000) * AVE_CPM_USD);

  const peakDays = [...byDay]
    .sort((a, b) => b.reach - a.reach || b.engagements - a.engagements)
    .slice(0, 3)
    .map((d) => ({ date: d.date, reach: d.reach, engagements: d.engagements }));
  const peakReachDay = peakDays[0] ? { date: peakDays[0].date, reach: peakDays[0].reach } : null;

  const campaignReplies = byCampaign.reduce((n, c) => n + c.replies, 0);
  const organicPosts = totals.posts;
  const otherReplies = Math.max(0, totals.replies - campaignReplies);
  const sourceRaw = [
    { name: "Persona posts", value: organicPosts },
    { name: "Campaign replies", value: campaignReplies },
    { name: "Scheduled replies", value: otherReplies },
  ].filter((s) => s.value > 0);
  const sourceTotal = sourceRaw.reduce((n, s) => n + s.value, 0);
  const sources = sourceRaw.map((s) => ({ ...s, share: pct(s.value, sourceTotal) }));

  const reachTotal = byAccount.reduce((n, a) => n + a.reach, 0) || totals.reach;
  const shareOfVoice = [...byAccount]
    .sort((a, b) => b.reach - a.reach)
    .slice(0, 5)
    .map((a) => ({
      handle: a.handle,
      name: nameOf(a.handle),
      posts: a.posts,
      reach: a.reach,
      share: pct(a.reach, reachTotal),
    }));

  const topVoice = shareOfVoice[0];
  const topCampaign = [...byCampaign].sort((a, b) => b.engagements - a.engagements)[0];

  const windowPhrase = days <= 1 ? "Over a 24-hour period" : `Over a ${days}-day period`;
  const items = totals.posts + totals.replies;
  const topVoiceShare =
    reachTotal > 0 && topVoice ? ((topVoice.reach / reachTotal) * 100).toFixed(1) : null;

  const summaryParagraph = [
    `${windowPhrase}, ${personas} persona${personas === 1 ? "" : "s"} published ${items} post${
      items === 1 ? "" : "s"
    } and replies, generating ${totals.impressions.toLocaleString()} impression${
      totals.impressions === 1 ? "" : "s"
    } and ${totals.engagements.toLocaleString()} engagement${
      totals.engagements === 1 ? "" : "s"
    }, resulting in an engagement rate of ${totals.engagementRate}%.`,
    topVoice && topVoiceShare
      ? `${topVoice.name} contributed the largest share of overall reach, accounting for ${topVoiceShare}% of total impressions.`
      : "",
    topCampaign
      ? `The ${topCampaign.name} campaign delivered the strongest performance, generating ${topCampaign.engagements.toLocaleString()} engagement${
          topCampaign.engagements === 1 ? "" : "s"
        } across ${topCampaign.replies} campaign-related post${
          topCampaign.replies === 1 ? "" : "s"
        } and replies.`
      : "",
    aveUsd > 0
      ? `The activity carries an estimated earned media value of ${formatUsd(aveUsd)}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const worked: ReportSection[] = [];
  if (totals.engagementRate >= 1)
    worked.push({
      title: "Engagement rate held above benchmark",
      body: `${totals.engagementRate}% of impressions turned into an interaction - above the 1% social benchmark.`,
    });
  if (totals.retweets > 0)
    worked.push({
      title: "The message travelled",
      body: `${totals.retweets.toLocaleString()} retweets and ${totals.quotes.toLocaleString()} quotes pushed the content past the personas' own followers.`,
    });
  if (topVoice)
    worked.push({
      title: "A lead voice emerged",
      body: `${topVoice.name} delivered ${topVoice.share}% of total reach across ${topVoice.posts} posts - worth keeping central to the next push.`,
    });
  if (campaignReplies > 0)
    worked.push({
      title: "Listening campaigns converted",
      body: `${campaignReplies} campaign replies landed in live conversations rather than waiting for an audience to arrive.`,
    });
  if (peakReachDay)
    worked.push({
      title: "A clear spike day",
      body: `Reach peaked at ${peakReachDay.reach.toLocaleString()} on ${peakReachDay.date} - the shape to replicate around the next fixture.`,
    });

  const next: ReportSection[] = [];
  const quietAccounts = byAccount.filter((a) => a.engagements === 0).length;
  if (quietAccounts > 0)
    next.push({
      title: "Wake the quiet personas",
      body: `${quietAccounts} persona${quietAccounts === 1 ? "" : "s"} recorded no interactions this window - clear whitespace to add reach with content that already works.`,
    });
  if (totals.bookmarks > 0)
    next.push({
      title: "Follow the save signal",
      body: `${totals.bookmarks.toLocaleString()} bookmarks show which posts people wanted to keep - build the next round of creative from those.`,
    });
  next.push({
    title: "Seed earlier",
    body: "Start the drumbeat days before the moment so anticipation compounds ahead of the peak.",
  });
  next.push({
    title: "Keep the report live",
    body: "Metrics refresh hourly here, so the story can be read mid-campaign instead of after it.",
  });

  return {
    window: { start, end, days },
    headline: {
      posts: totals.posts + totals.replies,
      reach: totals.reach,
      engagements: totals.engagements,
      impressions: totals.impressions,
      engagementRate: totals.engagementRate,
      aveUsd,
      personas,
      campaigns: byCampaign.length,
    },
    summaryParagraph,
    peakDays,
    peakReachDay,
    sources,
    shareOfVoice,
    worked: worked.slice(0, 6),
    next: next.slice(0, 4),
  };
}

export function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

export function formatWindow(start: string | null, end: string | null): string {
  if (!start || !end) return "No activity yet";
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}
