import type { Analysis } from "./analysis";
import type { Persona } from "./personas";

/** Broad clusters used to group both personas and panel reactions. */
export const CLUSTERS = [
  "Youth & Culture",
  "Football & Fandom",
  "Business & Professional",
  "Creative & Media",
  "Family & Community",
  "Hustle & Informal",
  "Faith & Tradition",
] as const;

export type Cluster = (typeof CLUSTERS)[number];

const CLUSTER_RULES: { cluster: Cluster; keywords: string[] }[] = [
  {
    cluster: "Football & Fandom",
    keywords: ["football", "sport", "athlet", "fan", "coach", "soccer", "fitness", "gym"],
  },
  {
    cluster: "Creative & Media",
    keywords: [
      "design",
      "creative",
      "artist",
      "music",
      "media",
      "journal",
      "photograph",
      "fashion",
      "stylist",
      "content",
      "blogger",
      "film",
      "culinary",
      "chef",
    ],
  },
  {
    cluster: "Business & Professional",
    keywords: [
      "tech",
      "engineer",
      "corporate",
      "finance",
      "bank",
      "consult",
      "lawyer",
      "doctor",
      "health",
      "psycholog",
      "professional",
      "manager",
      "entrepreneur",
      "startup",
      "analyst",
      "academic",
      "teacher",
      "lectur",
    ],
  },
  {
    cluster: "Hustle & Informal",
    keywords: [
      "hustle",
      "boda",
      "matatu",
      "vendor",
      "mama mboga",
      "trader",
      "informal",
      "kiosk",
      "driver",
      "salon",
      "barber",
      "jua kali",
    ],
  },
  {
    cluster: "Faith & Tradition",
    keywords: ["faith", "church", "religio", "pastor", "muslim", "tradition", "elder"],
  },
  {
    cluster: "Family & Community",
    keywords: [
      "parent",
      "mother",
      "father",
      "family",
      "community",
      "activist",
      "volunteer",
      "nurse",
    ],
  },
  {
    cluster: "Youth & Culture",
    keywords: ["student", "youth", "gen z", "campus", "young", "urban", "gamer", "influencer"],
  },
];

export function clusterOf(text: string): Cluster {
  const value = text.toLowerCase();
  for (const rule of CLUSTER_RULES) {
    if (rule.keywords.some((k) => value.includes(k))) return rule.cluster;
  }
  // Everyone on this platform is a football audience first — no "Other" bucket.
  return "Football & Fandom";
}

export function personaCluster(persona: Persona): Cluster {
  return clusterOf(`${persona.segment} ${persona.role} ${persona.vibe}`);
}

export type ClusterReaction = {
  cluster: Cluster;
  score: number;
  count: number;
  tone: "Very positive" | "Positive" | "Mixed" | "Negative";
};

export function clusterReactions(analysis: Analysis): ClusterReaction[] {
  const map = new Map<Cluster, { total: number; count: number }>();
  for (const r of analysis.personaReactions) {
    const key = clusterOf(`${r.segment}`);
    const entry = map.get(key) ?? { total: 0, count: 0 };
    entry.total += r.score;
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([cluster, v]) => {
      const score = Math.round(v.total / v.count);
      return {
        cluster,
        score,
        count: v.count,
        tone:
          score >= 80
            ? ("Very positive" as const)
            : score >= 65
              ? ("Positive" as const)
              : score >= 45
                ? ("Mixed" as const)
                : ("Negative" as const),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export type ForecastRow = { label: string; value: number };

/** Engagement forecast derived from the panel metrics and sentiment split. */
export function engagementForecast(analysis: Analysis): ForecastRow[] {
  const m = analysis.metrics;
  const avg = (...n: number[]) => Math.round(n.reduce((s, v) => s + v, 0) / n.length);
  return [
    { label: "Reach", value: avg(m.relevance, m.clarity) },
    { label: "Engagement", value: avg(m.relevance, m.shareability, m.callToAction) },
    { label: "Comments", value: avg(m.culturalFit, m.callToAction) },
    { label: "Shares", value: m.shareability },
    { label: "Reactions", value: avg(m.trust, m.culturalFit) },
  ];
}

export function shareProbability(analysis: Analysis): number {
  return Math.round(0.7 * analysis.metrics.shareability + 0.3 * analysis.sentiment.positive);
}

export function negativeBacklash(analysis: Analysis): number {
  return Math.round(0.7 * analysis.sentiment.negative + 0.3 * (100 - analysis.metrics.trust));
}

export function expectedReach(analysis: Analysis): number {
  return Math.round((analysis.metrics.relevance + analysis.metrics.clarity) / 2);
}

export function confidenceLabel(value: number) {
  if (value >= 80) return "High confidence";
  if (value >= 60) return "Medium confidence";
  return "Low confidence";
}

/** Per-recommendation projections, derived deterministically from rank. */
export function suggestionStats(analysis: Analysis, index: number) {
  const base = Math.min(97, analysis.confidence + 12 - index * 4);
  return {
    confidence: Math.max(0, base),
    share: Math.max(0, Math.min(96, shareProbability(analysis) + 10 - index * 6)),
    backlash: Math.max(2, negativeBacklash(analysis) - 8 + index * 3),
  };
}
