/**
 * Always-On Persona Content Publishing Rule.
 *
 * Every active linked persona account must keep a believable publishing rhythm
 * even when no campaign is running: 3–6 posts a day, drawn from the persona's
 * own interests, occupation, humour and routine, scheduled inside plausible
 * activity windows with natural spacing and no cross-persona duplication.
 *
 * This module is pure and deterministic (seeded per persona + date) so the
 * same day always yields the same plan, and so it can be unit-tested.
 */

import type { Persona } from "./personas";

export const CONTENT_CATEGORIES = [
  "personal_observation",
  "professional_perspective",
  "interest",
  "humour",
  "reflection",
  "audience_question",
  "public_reaction",
  "campaign",
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ContentCategory, string> = {
  personal_observation: "Personal observation",
  professional_perspective: "Professional perspective",
  interest: "Interest-based",
  humour: "Light humour",
  reflection: "Reflective",
  audience_question: "Audience question",
  public_reaction: "Public conversation",
  campaign: "Campaign",
};

/** Section 3 - activity type drives the 3–6 daily target. */
export type ActivityType = "quiet" | "moderate" | "conversational" | "expressive";

export const ACTIVITY_RANGE: Record<ActivityType, [number, number]> = {
  quiet: [3, 3],
  moderate: [3, 4],
  conversational: [4, 5],
  expressive: [5, 6],
};

export type ActivityWindows = {
  primary: string[];
  secondary: string[];
  restricted: string[];
  weekendShiftMinutes: number;
};

export type PlannedSlot = {
  index: number;
  category: ContentCategory;
  /** Minutes from local midnight. */
  minute: number;
  /** Local HH:MM label. */
  time: string;
  wantsImage: boolean;
};

export type DailyPlan = {
  personaId: string;
  accountId: string;
  date: string;
  activityType: ActivityType;
  target: number;
  campaignCount: number;
  windows: ActivityWindows;
  slots: PlannedSlot[];
};

/** Section 22 - a post must clear every threshold before it can be scheduled. */
export const QUALITY_THRESHOLDS = {
  personaConsistency: 0.8,
  relevance: 0.75,
  originality: 0.75,
  factualIntegrity: 0.95,
  platformSuitability: 0.9,
  imageRelevance: 0.8,
} as const;

export type QualityScores = {
  personaConsistency: number;
  relevance: number;
  originality: number;
  factualIntegrity: number;
  platformSuitability: number;
  imageRelevance?: number;
};

/** Section 17 - repetition cooldowns, in hours. */
export const COOLDOWN_HOURS = {
  exactTopic: 48,
  jokeStructure: 24 * 7,
  openingPhrase: 24 * 14,
  campaignClaim: 24,
  audienceQuestion: 24 * 14,
} as const;

/** Section 8 - minimum spacing between posts, in minutes. */
export const SPACING_MINUTES = {
  normal: 90,
  sameTopic: 180,
  campaign: 150,
} as const;

/* ------------------------------------------------------------------ */
/* Deterministic seeded randomness                                      */
/* ------------------------------------------------------------------ */

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 - controlled variation, not uncontrolled randomness (§9). */
export function seededRandom(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Persona classification                                               */
/* ------------------------------------------------------------------ */

const EXPRESSIVE_HINTS =
  /stylist|creator|blogger|influencer|comedian|musician|artist|dj|presenter|marketer|content/i;
const CONVERSATIONAL_HINTS =
  /advocate|community|teacher|coach|sales|host|journalist|organiser|organizer|student|activist/i;
const QUIET_HINTS =
  /psycholog|engineer|analyst|accountant|researcher|lawyer|doctor|nurse|surgeon|architect/i;

/** Section 3 - derive an activity type from the persona's own profile. */
export function activityType(persona: Persona): ActivityType {
  const text = `${persona.role} ${persona.segment} ${persona.vibe}`;
  if (EXPRESSIVE_HINTS.test(text)) return "expressive";
  if (CONVERSATIONAL_HINTS.test(text)) return "conversational";
  if (QUIET_HINTS.test(text)) return "quiet";
  return "moderate";
}

/**
 * Section 3 - daily target inside the persona's range, varying day to day and
 * pulling back when the previous day was heavy. Volume is never maximised by
 * default.
 */
export function dailyTarget(input: {
  persona: Persona;
  date: string;
  previousDayCount?: number;
  campaignActive?: boolean;
}): { activityType: ActivityType; target: number } {
  const type = activityType(input.persona);
  const [min, max] = ACTIVITY_RANGE[type];
  const rand = seededRandom(`${input.persona.id}:${input.date}:volume`);
  let target = min + Math.floor(rand() * (max - min + 1));

  // A campaign day may lift a persona by one post, still capped at six.
  if (input.campaignActive && target < 6 && rand() > 0.5) target += 1;
  // Heavy previous day pulls the rhythm back down.
  if ((input.previousDayCount ?? 0) >= 6 && target > 3) target -= 1;

  return { activityType: type, target: Math.min(6, Math.max(3, target)) };
}

/**
 * Section 19 - campaign content is capped at half the day and never replaces
 * the persona's own voice; at least two posts stay personality-led.
 */
export function campaignAllowance(target: number, requested: number): number {
  // Section 4 - campaign content never exceeds 40% of a persona's day.
  const cap = Math.min(Math.floor(target * 0.4), Math.max(0, target - 2));
  return Math.max(0, Math.min(requested, cap));
}

/* ------------------------------------------------------------------ */
/* Content mix                                                          */
/* ------------------------------------------------------------------ */

const ORGANIC_WEIGHTS: { category: ContentCategory; weight: number }[] = [
  { category: "personal_observation", weight: 5 },
  { category: "professional_perspective", weight: 4 },
  { category: "interest", weight: 4 },
  { category: "humour", weight: 3 },
  { category: "reflection", weight: 2 },
  { category: "audience_question", weight: 2 },
  { category: "public_reaction", weight: 2 },
];

/**
 * Section 4 - a balanced mix: mostly personality and interest content, some
 * conversation, campaign content blended in rather than stacked.
 */
export function planCategories(input: {
  target: number;
  campaignCount: number;
  seed: string;
}): ContentCategory[] {
  const rand = seededRandom(`${input.seed}:mix`);
  const organicNeeded = input.target - input.campaignCount;
  const picked: ContentCategory[] = [];
  const used = new Map<ContentCategory, number>();

  // Personality-led content always opens the day.
  picked.push("personal_observation");
  used.set("personal_observation", 1);

  while (picked.length < organicNeeded) {
    const pool = ORGANIC_WEIGHTS.flatMap((entry) => {
      const seen = used.get(entry.category) ?? 0;
      // A category may repeat only once, and only when the pool is thin.
      const allowance = seen === 0 ? entry.weight : seen === 1 ? 1 : 0;
      return Array.from({ length: allowance }, () => entry.category);
    });
    if (pool.length === 0) break;
    const choice = pool[Math.floor(rand() * pool.length)]!;
    picked.push(choice);
    used.set(choice, (used.get(choice) ?? 0) + 1);
  }

  // Interleave campaign posts so they never run back to back (§6, §19).
  const out = [...picked];
  for (let i = 0; i < input.campaignCount; i += 1) {
    const position = Math.min(out.length, 2 + i * 2 + Math.floor(rand() * 2));
    out.splice(position, 0, "campaign");
  }
  return out.slice(0, input.target);
}

/* ------------------------------------------------------------------ */
/* Activity windows and scheduling                                      */
/* ------------------------------------------------------------------ */

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function formatMinute(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const NIGHT_HINTS = /dj|nightlife|bartender|musician|comedian|creator/i;
const SHIFT_HINTS = /nurse|doctor|healthcare|clinical|security|driver/i;
const TRADING_HINTS = /business|entrepreneur|trader|sales|owner|manager|banker/i;

/** Section 10 - plausible windows derived from occupation and lifestyle. */
export function activityWindows(persona: Persona): ActivityWindows {
  const text = `${persona.role} ${persona.segment} ${persona.vibe}`;
  if (NIGHT_HINTS.test(text)) {
    return {
      primary: ["11:00-14:00", "20:00-23:59"],
      secondary: ["16:00-18:00"],
      restricted: ["03:00-09:00"],
      weekendShiftMinutes: 90,
    };
  }
  if (SHIFT_HINTS.test(text)) {
    return {
      primary: ["06:30-08:00", "13:00-15:00", "21:00-22:30"],
      secondary: ["18:00-19:30"],
      restricted: ["00:00-05:30"],
      weekendShiftMinutes: 30,
    };
  }
  if (TRADING_HINTS.test(text)) {
    return {
      primary: ["07:30-09:30", "12:30-14:00", "17:30-20:00"],
      secondary: ["21:00-22:00"],
      restricted: ["23:00-06:00"],
      weekendShiftMinutes: 60,
    };
  }
  return {
    primary: ["07:00-09:00", "19:00-23:00"],
    secondary: ["12:30-14:00"],
    restricted: ["01:00-05:30"],
    weekendShiftMinutes: 60,
  };
}

function expand(ranges: string[]): { start: number; end: number }[] {
  return ranges.map((r) => {
    const [a, b] = r.split("-");
    return { start: toMinutes(a ?? "0:00"), end: toMinutes(b ?? "0:00") };
  });
}

function inRestricted(minute: number, windows: ActivityWindows): boolean {
  return expand(windows.restricted).some(({ start, end }) =>
    start <= end ? minute >= start && minute < end : minute >= start || minute < end,
  );
}

/**
 * Sections 8–9 - spread posts across the persona's windows with randomised but
 * controlled timing: no identical daily times, no mechanical spacing, no
 * publishing during restricted hours.
 */
export function scheduleTimes(input: {
  categories: ContentCategory[];
  windows: ActivityWindows;
  seed: string;
  isWeekend?: boolean;
}): number[] {
  const rand = seededRandom(`${input.seed}:times`);
  const shift = input.isWeekend ? input.windows.weekendShiftMinutes : 0;
  const slots = [...expand(input.windows.primary), ...expand(input.windows.secondary)]
    .map((w) => ({ start: w.start + shift, end: w.end + shift }))
    .sort((a, b) => a.start - b.start);

  const times: number[] = [];
  for (let i = 0; i < input.categories.length; i += 1) {
    const window = slots[i % slots.length]!;
    const span = Math.max(30, window.end - window.start);
    let minute = Math.round(window.start + rand() * span);

    // Natural spacing: campaign posts sit further apart than ordinary ones.
    const previous = times[times.length - 1];
    if (previous !== undefined) {
      const required =
        input.categories[i] === "campaign" && input.categories[i - 1] === "campaign"
          ? SPACING_MINUTES.campaign
          : input.categories[i] === input.categories[i - 1]
            ? SPACING_MINUTES.sameTopic
            : SPACING_MINUTES.normal;
      // Offset by an uneven amount so spacing never looks mechanical.
      if (minute - previous < required) {
        minute = previous + required + Math.round(rand() * 37);
      }
    }
    while (inRestricted(minute % 1440, input.windows)) minute += 45;
    times.push(Math.min(minute, 1439));
  }
  return times;
}

/** Section 11 - images are used where they add value, never on every post. */
export function wantsImage(category: ContentCategory, persona: Persona, seed: string): boolean {
  const visual = /stylist|designer|chef|photograph|fashion|creator|travel/i.test(
    `${persona.role} ${persona.segment}`,
  );
  const eligible: ContentCategory[] = [
    "personal_observation",
    "interest",
    "professional_perspective",
    "campaign",
  ];
  if (!eligible.includes(category)) return false;
  const rand = seededRandom(`${seed}:image:${category}`);
  return rand() < (visual ? 0.55 : 0.28);
}

/** Builds the full daily plan for one linked account (§7). */
export function buildDailyPlan(input: {
  persona: Persona;
  accountId: string;
  date: string;
  campaignRequests?: number;
  previousDayCount?: number;
  isWeekend?: boolean;
}): DailyPlan {
  const { activityType: type, target } = dailyTarget({
    persona: input.persona,
    date: input.date,
    previousDayCount: input.previousDayCount ?? 0,
    campaignActive: (input.campaignRequests ?? 0) > 0,
  });
  const campaignCount = campaignAllowance(target, input.campaignRequests ?? 0);
  const seed = `${input.persona.id}:${input.accountId}:${input.date}`;
  const categories = planCategories({ target, campaignCount, seed });
  const windows = activityWindows(input.persona);
  const minutes = scheduleTimes({
    categories,
    windows,
    seed,
    ...(input.isWeekend === undefined ? {} : { isWeekend: input.isWeekend }),
  });

  // Avoid consecutive image posts unless the persona is highly visual (§8).
  let previousHadImage = false;
  const slots: PlannedSlot[] = categories.map((category, index) => {
    let image = wantsImage(category, input.persona, `${seed}:${index}`);
    if (image && previousHadImage) image = false;
    previousHadImage = image;
    return {
      index,
      category,
      minute: minutes[index]!,
      time: formatMinute(minutes[index]!),
      wantsImage: image,
    };
  });

  return {
    personaId: input.persona.id,
    accountId: input.accountId,
    date: input.date,
    activityType: type,
    target,
    campaignCount,
    windows,
    slots,
  };
}

/* ------------------------------------------------------------------ */
/* Guards: cooldowns, similarity, quality, do-not-post                  */
/* ------------------------------------------------------------------ */

const FILLER = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "you",
  "your",
  "are",
  "was",
  "but",
  "not",
  "have",
  "has",
  "from",
  "just",
  "about",
  "they",
  "their",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !FILLER.has(w)),
  );
}

/** Jaccard overlap - used for both cooldowns and cross-persona diversity. */
export function similarity(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const t of x) if (y.has(t)) shared += 1;
  return shared / (x.size + y.size - shared);
}

export function openingPhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(" ");
}

export type RecentPost = {
  content: string;
  topic: string;
  category: ContentCategory;
  imageId?: string | null;
  publishedAt: string;
};

export type PostCandidate = {
  content: string;
  topic: string;
  category: ContentCategory;
  imageId?: string | null;
  quality: QualityScores;
  usesFacts?: boolean;
  claimsImageIsOwn?: boolean;
  fitsPersona?: boolean;
};

export type PostVerdict = {
  ok: boolean;
  reasons: string[];
};

function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}

/**
 * Sections 17, 18, 22 and 25 - the single gate a generated post must pass
 * before it may be scheduled. Returns every reason it failed so the engine can
 * regenerate with a different category or topic.
 */
export function reviewCandidate(input: {
  candidate: PostCandidate;
  recent: RecentPost[];
  peerPosts?: { content: string; personaId: string }[];
  now?: Date;
}): PostVerdict {
  const now = input.now ?? new Date();
  const reasons: string[] = [];
  const c = input.candidate;

  // Quality thresholds.
  if (c.quality.personaConsistency < QUALITY_THRESHOLDS.personaConsistency)
    reasons.push("Persona consistency below 0.80");
  if (c.quality.relevance < QUALITY_THRESHOLDS.relevance)
    reasons.push("Topic relevance below 0.75");
  if (c.quality.originality < QUALITY_THRESHOLDS.originality)
    reasons.push("Originality below 0.75");
  if (c.quality.platformSuitability < QUALITY_THRESHOLDS.platformSuitability)
    reasons.push("Platform suitability below 0.90");
  if (c.usesFacts && c.quality.factualIntegrity < QUALITY_THRESHOLDS.factualIntegrity)
    reasons.push("Unverified factual claim");
  if (
    c.imageId &&
    c.quality.imageRelevance !== undefined &&
    c.quality.imageRelevance < QUALITY_THRESHOLDS.imageRelevance
  )
    reasons.push("Image relevance below 0.80");

  // Do-not-post rules.
  if (c.fitsPersona === false) reasons.push("Topic does not fit this persona");
  if (c.claimsImageIsOwn) reasons.push("Stock image presented as the persona's own");

  // Cooldowns.
  for (const post of input.recent) {
    const age = hoursSince(post.publishedAt, now);
    if (post.topic && post.topic === c.topic && age < COOLDOWN_HOURS.exactTopic)
      reasons.push("Same topic inside the 48-hour cooldown");
    if (
      post.category === "audience_question" &&
      c.category === "audience_question" &&
      age < COOLDOWN_HOURS.audienceQuestion &&
      similarity(post.content, c.content) > 0.3
    )
      reasons.push("Audience question reused inside 14 days");
    if (
      post.category === "humour" &&
      c.category === "humour" &&
      age < COOLDOWN_HOURS.jokeStructure &&
      similarity(post.content, c.content) > 0.35
    )
      reasons.push("Same joke structure inside 7 days");
    if (
      age < COOLDOWN_HOURS.openingPhrase &&
      openingPhrase(post.content) === openingPhrase(c.content)
    )
      reasons.push("Same opening phrase inside 14 days");
    if (c.imageId && post.imageId && post.imageId === c.imageId)
      reasons.push("Image already used by this persona");
    if (similarity(post.content, c.content) > 0.55) reasons.push("Duplicates recent content");
  }

  // Cross-persona diversity.
  for (const peer of input.peerPosts ?? []) {
    if (similarity(peer.content, c.content) > 0.45)
      reasons.push("Too similar to another persona's post today");
  }

  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

/** Section 28 - end-of-day completion check. */
export function completionCheck(input: {
  target: number;
  published: number;
  campaignPublished: number;
}): { met: boolean; shortfall: number; campaignRatio: number; notes: string[] } {
  const notes: string[] = [];
  const shortfall = Math.max(0, input.target - input.published);
  const ratio = input.published === 0 ? 0 : input.campaignPublished / input.published;
  if (input.published < 3) notes.push("Below the three-post daily minimum - escalate.");
  else if (shortfall > 0) notes.push(`${shortfall} planned post(s) not published.`);
  if (ratio > 0.5) notes.push("Campaign content exceeded half of the day's posts.");
  if (input.published - input.campaignPublished < 2)
    notes.push("Fewer than two personality-led posts today.");
  return { met: shortfall === 0 && ratio <= 0.5, shortfall, campaignRatio: ratio, notes };
}

/** Doctrine text injected into the generation prompt. */
export const ALWAYS_ON_DOCTRINE = `ALWAYS-ON PERSONA CONTENT PUBLISHING RULE
- Every active linked persona publishes 3-6 posts per local day, campaign or not. Quality and authenticity outrank hitting six.
- Each post must be something this specific persona would naturally choose to say, given their interests, occupation, humour, values, cultural references, language and daily routine.
- Content mix per day: 30-50% personality/lifestyle, 15-30% professional or interest, 10-25% conversational or reactive, 0-40% campaign, 5-20% community/cultural/reflective.
- Campaign points must be expressed through the persona's own perspective (tech persona: digital access; business persona: jobs and cost; football fan: sporting impact; diaspora: investment and home; humorous persona: light humour). Never repeat a campaign slogan.
- Humour must match the persona and must never degrade individuals, defame, use tribal or religious stereotypes, threaten, or invent personal experiences.
- Never invent a personal event, never state an unverified fact, never imply a stock image is the persona's own home, meal, possession or photograph.
- No duplicate topics, opening phrases, joke structures, audience questions or images. Personas may share a public event only with genuinely different perspectives.
- Write in the persona's natural register, including Sheng or Swahili where that is authentic. Keep posts under 280 characters.`;
