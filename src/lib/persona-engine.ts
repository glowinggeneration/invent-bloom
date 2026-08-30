import { PERSONAS, type Persona } from "./personas";

/**
 * Doctrine extracted from the "FKF Persona Engine" project scope.
 *
 * This module holds the shared rules that govern how synthetic personas
 * interpret a post and how replies are written for authorised accounts.
 * It is pure data + pure functions so it can be imported from server
 * generation code and from client UI alike.
 */

/** 7.3 - voice dimensions the generator must vary along. */
export const VOICE_DIMENSIONS = [
  "formal vs casual",
  "warm vs confrontational",
  "serious vs humorous",
  "analytical vs emotional",
  "optimistic vs sceptical",
  "verbose vs brief",
  "English-dominant vs code-switching (Kiswahili / Sheng)",
  "institutional vs street-level",
  "consensus-seeking vs independent",
  "evidence-driven vs experience-driven",
] as const;

/** 8.3 - intent labels used when classifying a source post. */
export const INTENT_LABELS = [
  "genuine question",
  "criticism",
  "complaint",
  "sarcasm",
  "humour",
  "praise",
  "news sharing",
  "misinformation",
  "provocation",
  "request for help",
  "policy debate",
  "football discussion",
  "governance discussion",
] as const;

/** 8.4 - the response strategy is chosen per persona, before wording. */
export const RESPONSE_STRATEGIES = [
  "acknowledge and clarify",
  "agree and expand",
  "correct respectfully",
  "disagree with evidence",
  "add practical context",
  "use light humour",
  "ask a useful question",
  "refer to an official source",
  "de-escalate",
  "do not engage",
  "escalate to an official spokesperson",
] as const;

export type ResponseStrategy = (typeof RESPONSE_STRATEGIES)[number];

/** 8.5 - persona selection scoring weights (sum = 1). */
export const SELECTION_WEIGHTS = {
  topicRelevance: 0.3,
  characterFit: 0.2,
  audienceFit: 0.15,
  platformFit: 0.1,
  languageFit: 0.1,
  campaignPriority: 0.1,
  postingBalance: 0.05,
} as const;

/** 8.7 - distinctiveness rules applied across a batch of replies. */
export const DISTINCTIVENESS_RULES = [
  "No two replies may share an opening phrase or closing phrase.",
  "No two replies may repeat the same argument, joke or statistic.",
  "Vary sentence rhythm and punctuation patterns between replies.",
  "Do not reuse the same Kiswahili or Sheng expression across replies.",
  "Difference must be in reasoning, emphasis and emotional angle - not synonyms.",
] as const;

/** 9.x + 19.x - writing rules and ethical guardrails, always enforced. */
export const WRITING_RULES = [
  "Respond directly to the actual subject of the post; never generic slogans.",
  "Preserve the persona's documented voice - consistency is not repetition.",
  "Match the source tone without copying its wording.",
  "Acknowledge valid criticism instead of ignoring it; avoid hostility and avoid excessive praise.",
  "Use Kenyan English, Kiswahili or Sheng only where natural for that persona - never mechanically.",
  "Hashtags only when contextually justified; emojis only when consistent with the persona.",
  "Use only verified factual claims; if a fact is uncertain, speak in general terms instead.",
] as const;

export const ETHICS_RULES = [
  "Personas are synthetic and used for message testing and clearly authorised organisational channels.",
  "Never claim to be an independent citizen, never impersonate a real person, never fabricate grassroots consensus.",
  "Never present centrally coordinated messaging as spontaneous public opinion.",
] as const;

/** 13/14 - content risk banding that drives the approval requirement. */
export type RiskLevel = "low" | "medium" | "high";

export const RISK_GUIDANCE: Record<RiskLevel, string> = {
  low: "Routine information, fixtures, results, encouragement. Streamlined approval.",
  medium:
    "Criticism, corrections, spending, performance or complaints. Requires reviewer approval.",
  high: "Legal, governance, safety, elections or crisis matters. Requires director approval or escalation.",
};

function bullet(items: readonly string[]): string {
  return items.map((r) => `- ${r}`).join("\n");
}

/** Compact doctrine block injected into generation prompts. */
export const PERSONA_ENGINE_DOCTRINE = [
  "PERSONA ENGINE DOCTRINE (FKF Persona Engine scope v1.0):",
  "",
  `Voice dimensions to differentiate on: ${VOICE_DIMENSIONS.join("; ")}.`,
  `Choose a response strategy per persona before writing: ${RESPONSE_STRATEGIES.join("; ")}.`,
  "",
  "Writing rules:",
  bullet(WRITING_RULES),
  "",
  "Distinctiveness control:",
  bullet(DISTINCTIVENESS_RULES),
  "",
  "Ethics:",
  bullet(ETHICS_RULES),
].join("\n");

/* ------------------------------------------------------------------ */
/* Persona eligibility (7.5 / 8.5)                                     */
/* ------------------------------------------------------------------ */

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function overlap(haystack: string, words: string[]): number {
  const lower = haystack.toLowerCase();
  if (!words.length) return 0;
  const hits = words.filter((w) => lower.includes(w)).length;
  return Math.min(1, hits / Math.max(4, Math.round(words.length * 0.35)));
}

export type PersonaFit = {
  persona: Persona;
  /** 0-100 contextual fit for this post. */
  score: number;
  reasons: string[];
};

/**
 * Ranks personas by contextual fit for a source post, using the weighted
 * model in section 8.5. Deterministic, cheap, and runs before any AI call
 * so publishing mode only uses personas with a credible reason to reply.
 */
export function rankPersonaFit(
  post: string,
  options: { platform?: string; excludeIds?: string[]; recentlyUsedIds?: string[] } = {},
): PersonaFit[] {
  const words = tokens(post);
  const exclude = new Set(options.excludeIds ?? []);
  const recent = new Set(options.recentlyUsedIds ?? []);
  const platform = (options.platform ?? "Twitter / X").toLowerCase();

  return PERSONAS.filter((p) => !exclude.has(p.id))
    .map((p) => {
      const reasons: string[] = [];

      const topic = overlap(`${p.segment} ${p.role} ${p.profile}`, words);
      if (topic > 0.4) reasons.push("topic matches their world");

      const character = overlap(`${p.vibe} ${p.decisionStyle} ${p.quote}`, words) * 0.6 + 0.4;

      const audience = overlap(`${p.location} ${p.age} ${p.segment}`, words) * 0.5 + 0.5;

      const platformFit = p.platforms.some((x) =>
        x.toLowerCase().includes(platform.split(" ")[0] ?? ""),
      )
        ? 1
        : 0.35;
      if (platformFit === 1) reasons.push("active on this platform");

      const sheng = /\b(sasa|poa|mambo|bro|manze|fam)\b/i.test(post);
      const languageFit = sheng ? (/sheng|street|youth|hustle/i.test(p.profile) ? 1 : 0.5) : 0.75;

      const campaign = /fkf|harambee|football|league|stadium|referee|ticket/i.test(post)
        ? /football|sport|fan|coach|community/i.test(`${p.segment} ${p.role} ${p.profile}`)
          ? 1
          : 0.5
        : 0.7;
      if (campaign === 1) reasons.push("credible football voice");

      const balance = recent.has(p.id) ? 0.2 : 1;
      if (balance < 1) reasons.push("recently used - cooling off");

      const score =
        SELECTION_WEIGHTS.topicRelevance * topic +
        SELECTION_WEIGHTS.characterFit * character +
        SELECTION_WEIGHTS.audienceFit * audience +
        SELECTION_WEIGHTS.platformFit * platformFit +
        SELECTION_WEIGHTS.languageFit * languageFit +
        SELECTION_WEIGHTS.campaignPriority * campaign +
        SELECTION_WEIGHTS.postingBalance * balance;

      return { persona: p, score: Math.round(score * 100), reasons };
    })
    .sort((a, b) => b.score - a.score);
}

/** Picks the top-N eligible personas for publishing mode (8.5). */
export function selectPersonasForPost(
  post: string,
  count: number,
  options: { platform?: string; recentlyUsedIds?: string[] } = {},
): Persona[] {
  const ranked = rankPersonaFit(post, options);
  // Take a slightly wider eligible pool, then spread across segments so a
  // batch never reads as one voice repeated.
  const pool = ranked.slice(0, Math.max(count * 3, count));
  const picked: Persona[] = [];
  const usedSegments = new Set<string>();
  for (const fit of pool) {
    if (picked.length >= count) break;
    if (usedSegments.has(fit.persona.segment)) continue;
    usedSegments.add(fit.persona.segment);
    picked.push(fit.persona);
  }
  for (const fit of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(fit.persona)) picked.push(fit.persona);
  }
  while (picked.length < count && picked.length > 0) {
    picked.push(picked[picked.length % picked.length]!);
  }
  return picked.slice(0, count);
}

/** Simple, deterministic risk banding used to flag approval need (13). */
export function classifyRisk(post: string): RiskLevel {
  const t = post.toLowerCase();
  if (/court|fraud|corrupt|ban|election|fifa sanction|death|violence|lawsuit|arrest/.test(t)) {
    return "high";
  }
  if (/refund|complaint|criticis|budget|spend|salary|performance|apolog|delay|scandal/.test(t)) {
    return "medium";
  }
  return "low";
}
