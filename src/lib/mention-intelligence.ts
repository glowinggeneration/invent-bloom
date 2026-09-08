export type MentionImportance = "Critical" | "High impact" | "Relevant" | "Low signal";
export type SourceAuthority = "High" | "Medium" | "Standard";

/**
 * Single source of truth for the narrative topic taxonomy - shared by the
 * Overview narrative breakdown, the Mentions topic filter and the
 * Conversation Context panel. Previously hand-copied across those three
 * modules, which had already drifted once (three separately-worded
 * "leadership" patterns).
 */
export const NARRATIVE_TOPICS = [
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
    re: /league|club|premier|nsl|competition|cup|referee|officiat/i,
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
] as const;

const TOPIC_PATTERNS: Record<string, RegExp> = Object.fromEntries(
  NARRATIVE_TOPICS.map((topic) => [topic.query, topic.re]),
);

/** Match an Overview narrative drill-down against the text already collected. */
export function matchesMentionTopic(text: string, topic?: string | null): boolean {
  const query = (topic ?? "").trim().toLowerCase();
  if (!query) return true;
  const known = TOPIC_PATTERNS[query];
  if (known) return known.test(text);

  const tokens = query
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9#@_-]/gi, ""))
    .filter((token) => token.length >= 3);
  if (!tokens.length) return true;
  const haystack = text.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

/** Stable text signature used to collapse near-identical reposts without deleting anything. */
export function mentionNoiseKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@[a-z0-9_]+/g, " ")
    .replace(/#[a-z0-9_]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(rt|via)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

export function sourceAuthority(input: {
  verified?: boolean;
  isPublication?: boolean;
  views?: number | null;
  engagement?: number | null;
}): SourceAuthority {
  const views = Number(input.views ?? 0);
  const engagement = Number(input.engagement ?? 0);
  if (input.verified || input.isPublication) return "High";
  if (views >= 10_000 || engagement >= 500) return "Medium";
  return "Standard";
}

/**
 * A conservative, explainable importance label based only on signals already
 * present in the feed. It is a prioritisation aid, not a claim of objective influence.
 */
export function mentionImportance(input: {
  sentiment?: "positive" | "neutral" | "negative";
  views?: number | null;
  engagement?: number | null;
  authority?: SourceAuthority;
  directReply?: boolean;
}): MentionImportance {
  const views = Number(input.views ?? 0);
  const engagement = Number(input.engagement ?? 0);
  const authority = input.authority ?? "Standard";

  if (
    input.sentiment === "negative" &&
    authority === "High" &&
    (views >= 50_000 || engagement >= 1_000 || input.directReply)
  ) {
    return "Critical";
  }
  if (
    views >= 25_000 ||
    engagement >= 500 ||
    input.directReply ||
    (authority === "High" && (views >= 5_000 || engagement >= 100 || input.sentiment !== "neutral"))
  ) {
    return "High impact";
  }
  if (views >= 2_500 || engagement >= 50 || authority === "High" || authority === "Medium") {
    return "Relevant";
  }
  return "Low signal";
}

export const IMPORTANCE_RANK: Record<MentionImportance, number> = {
  Critical: 4,
  "High impact": 3,
  Relevant: 2,
  "Low signal": 1,
};
