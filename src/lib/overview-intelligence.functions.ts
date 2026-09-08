import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NarrativeOrigin = {
  label: string;
  handle: string;
  postedAt: string | null;
  url: string | null;
};

export type NarrativeAmplifier = {
  handle: string;
  views: number;
  mentions: number;
  verified: boolean;
};

export type IntelligenceNarrative = {
  id: string;
  label: string;
  mentions: number;
  negative: number;
  positive: number;
  views: number;
  growth: number;
  normalMentions: number;
  vsNormal: number;
  velocity: "Breaking" | "Fast rising" | "Rising" | "Stable" | "Declining";
  lifecycle: "Emerging" | "Growing" | "Peaking" | "Stable" | "Declining";
  importance: "Critical" | "High impact" | "Relevant" | "Low signal";
  query: string;
  origin: NarrativeOrigin | null;
  amplifiers: NarrativeAmplifier[];
};

export type IntelligenceSignal = {
  title: string;
  detail: string;
  tone: "risk" | "opportunity" | "neutral";
  query?: string;
};

export type ComparedWithNormal = {
  normalWeeklyMentions: number;
  mentionVsNormal: number;
  normalNegativeShare: number;
  negativeVsNormal: number;
  normalWeeklyViews: number;
  viewsVsNormal: number;
};

export type OverviewIntelligence = {
  currentMentions: number;
  previousMentions: number;
  mentionChange: number;
  currentNegativeShare: number;
  previousNegativeShare: number;
  negativeShift: number;
  currentViews: number;
  previousViews: number;
  viewChange: number;
  comparedWithNormal: ComparedWithNormal;
  whatChanged: IntelligenceSignal[];
  narratives: IntelligenceNarrative[];
  risks: IntelligenceSignal[];
  opportunities: IntelligenceSignal[];
  brief: string[];
};

type MentionRow = {
  text: string | null;
  author_handle: string | null;
  author_verified: boolean | null;
  posted_at: string | null;
  like_count: number | null;
  view_count: number | null;
  sentiment: string | null;
  sentiment_score: number | null;
  matched_keyword: string | null;
  url: string | null;
};

const TOPICS: { id: string; label: string; query: string; re: RegExp }[] = [
  {
    id: "leadership",
    label: "Leadership & governance",
    query: "leadership",
    re: /leadership|governance|election|office|chairman|chairperson|director|board/i,
  },
  {
    id: "national-teams",
    label: "National teams & performance",
    query: "harambee",
    re: /harambee|starlets|stars|national team|qualif|afcon|match|fixture|coach/i,
  },
  {
    id: "grassroots",
    label: "Grassroots & youth development",
    query: "grassroots",
    re: /grassroots|youth|academy|school|u15|u17|talent|development|coach education/i,
  },
  {
    id: "league",
    label: "League, clubs & competitions",
    query: "league",
    re: /league|club|premier|fkfpl|nsl|competition|cup|referee|officiat/i,
  },
  {
    id: "facilities",
    label: "Facilities & football investment",
    query: "stadium",
    re: /stadium|facility|facilities|investment|infrastructure|pitch|training ground/i,
  },
  {
    id: "integrity",
    label: "Integrity, disputes & accountability",
    query: "integrity",
    re: /court|tribunal|corrupt|fraud|scandal|dispute|ban|suspend|protest|accountab|integrity/i,
  },
];

function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function share(rows: MentionRow[], sentiment: string): number {
  if (!rows.length) return 0;
  return Math.round((rows.filter((r) => r.sentiment === sentiment).length / rows.length) * 100);
}

function velocity(
  growth: number,
  current: number,
  vsNormal: number,
): IntelligenceNarrative["velocity"] {
  if (current >= 8 && growth >= 150 && vsNormal >= 100) return "Breaking";
  if (growth >= 75 && vsNormal >= 40) return "Fast rising";
  if (growth >= 25 || vsNormal >= 35) return "Rising";
  if (growth <= -25 && vsNormal <= 0) return "Declining";
  return "Stable";
}

function lifecycle(
  growth: number,
  current: number,
  previous: number,
  normalMentions: number,
): IntelligenceNarrative["lifecycle"] {
  if (previous === 0 && current > 0 && normalMentions < 1) return "Emerging";
  if (current > previous && current > normalMentions * 1.25) return "Growing";
  if (current >= Math.max(6, normalMentions * 1.4) && Math.abs(growth) < 25) return "Peaking";
  if (current < previous && current <= normalMentions) return "Declining";
  return "Stable";
}

function importance(rows: MentionRow[]): IntelligenceNarrative["importance"] {
  const views = rows.reduce((n, r) => n + Number(r.view_count ?? 0), 0);
  const negative = share(rows, "negative");
  const verified = rows.some((r) => r.author_verified);
  if ((views >= 100000 || verified) && negative >= 45) return "Critical";
  if (views >= 30000 || verified || rows.length >= 10) return "High impact";
  if (rows.length >= 3 || views >= 3000) return "Relevant";
  return "Low signal";
}

function fmtChange(value: number): string {
  if (value > 0) return `up ${value}%`;
  if (value < 0) return `down ${Math.abs(value)}%`;
  return "unchanged";
}

function likelyOrigin(rows: MentionRow[]): NarrativeOrigin | null {
  const earliest = [...rows]
    .filter((r) => r.posted_at)
    .sort((a, b) => String(a.posted_at).localeCompare(String(b.posted_at)))[0];
  if (!earliest) return null;
  const handle = (earliest.author_handle ?? "").replace(/^@/, "").trim();
  return {
    label: handle ? `@${handle}` : "Earliest monitored mention",
    handle,
    postedAt: earliest.posted_at,
    url: earliest.url,
  };
}

function topAmplifiers(rows: MentionRow[]): NarrativeAmplifier[] {
  const map = new Map<string, NarrativeAmplifier>();
  for (const row of rows) {
    const handle = (row.author_handle ?? "").replace(/^@/, "").trim();
    if (!handle) continue;
    const existing = map.get(handle) ?? {
      handle,
      views: 0,
      mentions: 0,
      verified: false,
    };
    existing.views += Number(row.view_count ?? 0);
    existing.mentions += 1;
    existing.verified ||= Boolean(row.author_verified);
    map.set(handle, existing);
  }
  return [...map.values()]
    .sort(
      (a, b) =>
        Number(b.verified) - Number(a.verified) || b.views - a.views || b.mentions - a.mentions,
    )
    .slice(0, 3);
}

export const getOverviewIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OverviewIntelligence> => {
    const now = Date.now();
    const currentStart = new Date(now - 7 * 86400000).toISOString();
    const previousStart = new Date(now - 14 * 86400000).toISOString();
    const baselineStart = new Date(now - 35 * 86400000).toISOString();

    const { data } = await context.supabase
      .from("x_mentions")
      .select(
        "text, author_handle, author_verified, posted_at, like_count, view_count, sentiment, sentiment_score, matched_keyword, url",
      )
      .gte("posted_at", baselineStart)
      .order("posted_at", { ascending: false })
      .limit(3000);

    const rows = (data ?? []) as MentionRow[];
    const current = rows.filter((r) => (r.posted_at ?? "") >= currentStart);
    const previous = rows.filter(
      (r) => (r.posted_at ?? "") >= previousStart && (r.posted_at ?? "") < currentStart,
    );
    const baseline = rows.filter(
      (r) => (r.posted_at ?? "") >= baselineStart && (r.posted_at ?? "") < currentStart,
    );

    const currentViews = current.reduce((n, r) => n + Number(r.view_count ?? 0), 0);
    const previousViews = previous.reduce((n, r) => n + Number(r.view_count ?? 0), 0);
    const baselineViews = baseline.reduce((n, r) => n + Number(r.view_count ?? 0), 0);
    const currentNegativeShare = share(current, "negative");
    const previousNegativeShare = share(previous, "negative");
    const baselineNegativeShare = share(baseline, "negative");
    const mentionChange = pctChange(current.length, previous.length);
    const viewChange = pctChange(currentViews, previousViews);
    const negativeShift = currentNegativeShare - previousNegativeShare;

    const normalWeeklyMentions = Math.round((baseline.length / 4) * 10) / 10;
    const normalWeeklyViews = Math.round(baselineViews / 4);
    const mentionVsNormal = pctChange(current.length, normalWeeklyMentions);
    const viewsVsNormal = pctChange(currentViews, normalWeeklyViews);
    const negativeVsNormal = currentNegativeShare - baselineNegativeShare;

    const narratives = TOPICS.map((topic): IntelligenceNarrative | null => {
      const cur = current.filter((r) =>
        topic.re.test(`${r.text ?? ""} ${r.matched_keyword ?? ""}`),
      );
      const prev = previous.filter((r) =>
        topic.re.test(`${r.text ?? ""} ${r.matched_keyword ?? ""}`),
      );
      const base = baseline.filter((r) =>
        topic.re.test(`${r.text ?? ""} ${r.matched_keyword ?? ""}`),
      );
      if (!cur.length && !prev.length && !base.length) return null;
      const growth = pctChange(cur.length, prev.length);
      const normalMentions = Math.round((base.length / 4) * 10) / 10;
      const vsNormal = pctChange(cur.length, normalMentions);
      return {
        id: topic.id,
        label: topic.label,
        mentions: cur.length,
        negative: share(cur, "negative"),
        positive: share(cur, "positive"),
        views: cur.reduce((n, r) => n + Number(r.view_count ?? 0), 0),
        growth,
        normalMentions,
        vsNormal,
        velocity: velocity(growth, cur.length, vsNormal),
        lifecycle: lifecycle(growth, cur.length, prev.length, normalMentions),
        importance: importance(cur),
        query: topic.query,
        origin: likelyOrigin(cur),
        amplifiers: topAmplifiers(cur),
      };
    })
      .filter((n): n is IntelligenceNarrative => n !== null)
      .sort((a, b) => {
        const rank = { Critical: 4, "High impact": 3, Relevant: 2, "Low signal": 1 };
        return (
          rank[b.importance] - rank[a.importance] || b.views - a.views || b.mentions - a.mentions
        );
      })
      .slice(0, 6);

    const whatChanged: IntelligenceSignal[] = [
      {
        title: "Conversation volume",
        detail: `${current.length} mentions in the last 7 days, ${fmtChange(mentionChange)} versus the previous 7 days.`,
        tone: "neutral",
      },
      {
        title: "Negative conversation",
        detail: `${currentNegativeShare}% of current mentions are negative, ${negativeShift > 0 ? `up ${negativeShift} points` : negativeShift < 0 ? `down ${Math.abs(negativeShift)} points` : "unchanged"}.`,
        tone: negativeShift >= 8 ? "risk" : negativeShift <= -8 ? "opportunity" : "neutral",
      },
      {
        title: "Conversation reach",
        detail: `${currentViews.toLocaleString()} recorded views, ${fmtChange(viewChange)} against the previous period.`,
        tone: viewChange >= 30 ? "opportunity" : "neutral",
      },
    ];

    const risks = narratives
      .filter(
        (n) =>
          n.negative >= 45 &&
          (n.velocity === "Breaking" ||
            n.velocity === "Fast rising" ||
            n.importance === "Critical" ||
            n.importance === "High impact"),
      )
      .slice(0, 3)
      .map((n) => ({
        title: n.label,
        detail: `${n.negative}% negative sentiment · ${n.velocity.toLowerCase()} · ${n.mentions} mentions.`,
        tone: "risk" as const,
        query: n.query,
      }));

    const opportunities = narratives
      .filter((n) => n.positive >= 45 && n.growth >= 0)
      .slice(0, 3)
      .map((n) => ({
        title: n.label,
        detail: `${n.positive}% positive sentiment · ${n.velocity.toLowerCase()} · ${n.mentions} mentions.`,
        tone: "opportunity" as const,
        query: n.query,
      }));

    const brief: string[] = [];
    if (mentionChange !== 0)
      brief.push(`Conversation volume is ${fmtChange(mentionChange)} week on week.`);
    if (Math.abs(mentionVsNormal) >= 20)
      brief.push(
        `Current mention volume is ${fmtChange(mentionVsNormal)} versus the four-week weekly norm.`,
      );
    if (negativeShift >= 8)
      brief.push(`Negative sentiment has increased by ${negativeShift} percentage points.`);
    else if (negativeShift <= -8)
      brief.push(`Negative sentiment has eased by ${Math.abs(negativeShift)} percentage points.`);
    const lead = narratives[0];
    if (lead)
      brief.push(
        `${lead.label} is the highest-priority narrative and is currently ${lead.velocity.toLowerCase()}.`,
      );
    if (risks[0])
      brief.push(
        `Watch ${risks[0].title.toLowerCase()} closely because negative conversation is gaining weight.`,
      );
    if (opportunities[0])
      brief.push(`${opportunities[0].title} is the clearest positive conversation to reinforce.`);
    if (!brief.length)
      brief.push("Conversation is broadly stable against recent historical patterns.");

    return {
      currentMentions: current.length,
      previousMentions: previous.length,
      mentionChange,
      currentNegativeShare,
      previousNegativeShare,
      negativeShift,
      currentViews,
      previousViews,
      viewChange,
      comparedWithNormal: {
        normalWeeklyMentions,
        mentionVsNormal,
        normalNegativeShare: baselineNegativeShare,
        negativeVsNormal,
        normalWeeklyViews,
        viewsVsNormal,
      },
      whatChanged,
      narratives,
      risks,
      opportunities,
      brief: brief.slice(0, 6),
    };
  });
