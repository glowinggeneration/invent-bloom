/**
 * News listening config. Everything editable lives here: both query sets, the
 * Google News freshness window and locale, and how often a full sweep runs.
 *
 * Two sources feed one deduplicated press feed:
 *  - NewsData.io — broad and structured (images, snippets), 12-hour delay on
 *    the free tier. Caps `q` at 100 characters, so one request per query.
 *  - Google News RSS — free, keyless and real-time, but no images or snippets
 *    and its links are redirect tokens rather than publisher URLs.
 *
 * 12 NewsData queries per sweep at ~75 minutes stays inside the free tier's
 * 200 requests/day. Google News RSS is unmetered.
 */

export const NEWS_QUERIES: string[] = [
  '"Football Kenya Federation" OR FKF OR "Harambee Stars"',
  '"AFCON 2027" OR "Pamoja 2027" OR (AFCON AND Kenya)',
  '("Hussein Mohammed" OR "McDonald Mariga") AND FKF',
  "FKF AND (corruption OR court OR tribunal OR crisis OR audit)",
  '"Harambee Stars" AND (squad OR coach OR match OR qualifier)',
  '"Harambee Starlets" OR "Kenya women football"',
  '"FKF Premier League" OR "Kenya Premier League" OR "National Super League"',
  '"Gor Mahia" OR "AFC Leopards" OR "Tusker FC" OR "Shabana"',
  "Kenya AND (football OR FKF) AND (Ruto OR government OR ministry)",
  "(Talanta OR Kasarani OR Nyayo) AND (stadium OR AFCON)",
  'FKF AND (sponsor OR broadcast OR "media rights" OR SportPesa)',
  "Kenya AND (grassroots OR youth OR academy) AND football",
];

/**
 * Google News search syntax differs from NewsData: a space means AND and OR
 * must be explicit, so the anchor term is repeated per clause
 * (`FKF corruption OR FKF court`) rather than factored out. Keep that pattern
 * when editing. The trailing `when:` window is appended automatically from
 * GOOGLE_NEWS_WINDOWS, since this feed otherwise skews toward older stories.
 */
export const GOOGLE_NEWS_QUERIES: string[] = [
  '"Football Kenya Federation" OR FKF OR "Harambee Stars"',
  '"AFCON 2027" OR "Pamoja 2027" Kenya',
  '"Hussein Mohammed" FKF OR "McDonald Mariga" FKF',
  "FKF corruption OR FKF court OR FKF tribunal OR FKF crisis",
  '"Harambee Stars" squad OR "Harambee Stars" coach OR "Harambee Stars" qualifier',
  '"Harambee Starlets" OR "Kenya women football"',
  '"FKF Premier League" OR "Kenya Premier League" OR "National Super League"',
  '"Gor Mahia" OR "AFC Leopards" OR "Tusker FC" OR "Shabana"',
  'FKF sponsor OR FKF broadcast OR "SportPesa Premier League"',
  "Talanta Stadium OR Kasarani OR Nyayo AFCON",
];

/**
 * Freshness window appended to each Google News query, by index. Fast-moving
 * topics (fixtures, squads, results) use a tight window; slower storylines use
 * a wider one. Anything not listed falls back to `defaultWindow`.
 */
export const GOOGLE_NEWS_WINDOWS = {
  defaultWindow: "7d",
  /** Query index -> window. Indexes match GOOGLE_NEWS_QUERIES above. */
  byIndex: { 0: "2d", 4: "2d", 6: "2d", 7: "2d" } as Record<number, string>,
};

/** Kenya / English edition. Swap to hl=sw, ceid=KE:sw for a Swahili edition. */
export const GOOGLE_NEWS_LOCALE = {
  base: "https://news.google.com/rss/search",
  hl: "en-KE",
  gl: "KE",
  ceid: "KE:en",
  /** The feed caps out around 100 items and has no pagination. */
  maxPerQuery: 40,
};

/** Minutes between full sweeps. Keep between 60 and 90 on the free tier. */
export const NEWS_SWEEP_MINUTES = 75;

/** Fixed request parameters for every NewsData sweep call. */
export const NEWS_REQUEST = {
  endpoint: "https://newsdata.io/api/1/latest",
  country: "ke",
  language: "en,sw",
  /** Free tier returns ~10 articles on the first page; we never deep-paginate. */
  maxPerQuery: 10,
};

/** Which ingestion path an article arrived on. Shown in the UI as provenance. */
/**
 * Every channel that can put an item in the mentions feed. The first two are
 * press wires; the rest are social platforms read over RSS/Atom.
 */
export type NewsProvider =
  | "NewsData"
  | "Google News"
  | "Reddit"
  | "Mastodon"
  | "YouTube"
  | "Bluesky"
  | "Facebook"
  | "Instagram";

export const NEWS_PROVIDERS: NewsProvider[] = ["NewsData", "Google News"];

export const SOCIAL_PROVIDERS: NewsProvider[] = [
  "Reddit",
  "Mastodon",
  "YouTube",
  "Bluesky",
  "Facebook",
  "Instagram",
];

const ALL_PROVIDERS: NewsProvider[] = [...NEWS_PROVIDERS, ...SOCIAL_PROVIDERS];

/** Reads a stored provider string back into a known channel. */
export function toProvider(value: string | null | undefined): NewsProvider {
  const match = ALL_PROVIDERS.find((p) => p === value);
  return match ?? "NewsData";
}

export function isSocialProvider(provider: NewsProvider): boolean {
  return SOCIAL_PROVIDERS.includes(provider);
}

/** One cleaned article. `link` is unique per source; `titleKey` spans sources. */
export type NewsArticle = {
  link: string;
  title: string;
  description: string;
  pubDate: string | null;
  sourceId: string;
  imageUrl: string | null;
  category: string[];
  /** The sweep query that surfaced the article. */
  matchedQuery: string;
  /** Whether the item is press coverage or a social post. */
  source: "News" | "Social";
  provider: NewsProvider;
  /** Normalized headline — the cross-source deduplication key. */
  titleKey: string;
};

/**
 * Deduplication key for a headline. Google's redirect links never match
 * NewsData's canonical URLs for the same story, so the title is the only
 * thing the two sources share. Lowercased, punctuation-stripped, with common
 * publisher suffixes (" - Nation", " | Standard") removed.
 */
export function normalizeTitle(title: string): string {
  return (
    String(title ?? "")
      .toLowerCase()
      .replace(/\s+[-–—|]\s+[^-–—|]{1,40}$/u, "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’`"“”]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      // Aggregator boilerplate that syndicated copies carry ahead of the headline.
      .replace(/^(news comments|comments|breaking|live|watch|video|photos|opinion)\s+/g, "")
      .trim()
  );
}

/** Filler words that carry no signal when comparing two headlines. */
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "after",
  "into",
  "over",
  "their",
  "they",
  "have",
  "has",
  "was",
  "are",
  "will",
  "what",
  "how",
  "why",
  "who",
  "his",
  "her",
  "its",
  "not",
  "but",
  "out",
  "off",
  "new",
  "says",
  "said",
]);

/** Crude plural stemmer so "dreams" matches "dream" and "sports" "sport". */
function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("es") && !token.endsWith("ses")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/**
 * Meaningful words in a headline: 3+ characters, stopwords removed, stemmed.
 */
export function significantTokens(title: string): string[] {
  return [
    ...new Set(
      normalizeTitle(title)
        .split(" ")
        .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
        .map(stem),
    ),
  ];
}

/**
 * Numbers in a headline, including short ones. Scorelines, years and counts are
 * exactly what separates otherwise identical headlines ("beat Leopards 2-0" vs
 * "beat Leopards 3-1"), and short tokens are dropped from the word comparison.
 */
function numberTokens(title: string): string[] {
  return [
    ...new Set(
      normalizeTitle(title)
        .split(" ")
        .filter((t) => /^\d+$/.test(t)),
    ),
  ];
}

/**
 * Teams and bodies the feed covers. Two headlines naming different entities are
 * different stories even when the rest of the wording matches almost exactly
 * ("Tusker sign Ugandan striker" vs "AFC Leopards sign Ugandan striker").
 * Add new clubs here as coverage widens.
 */
export const NEWS_ENTITIES: string[] = [
  "harambee stars",
  "harambee starlets",
  "gor mahia",
  "afc leopards",
  "tusker",
  "shabana",
  "bandari",
  "kariobangi sharks",
  "rayon sport",
  "kenya police",
  "ulinzi stars",
  "fkf",
  "cecafa",
  "caf",
  "fifa",
];

function entitiesIn(title: string): string[] {
  // Compare on stemmed words so "Rayon Sports" matches "Rayon Sport".
  const text = ` ${normalizeTitle(title).split(" ").map(stem).join(" ")} `;
  return NEWS_ENTITIES.filter((e) => text.includes(` ${e.split(" ").map(stem).join(" ")} `));
}

/**
 * Words that describe the beat rather than the event. Two headlines about the
 * same tournament share these no matter how unrelated the actual stories are
 * (a match preview and the match result share "cecafa kagame cup final"), so
 * they never count towards evidence that two headlines are the same story.
 */
const TOPIC_TERMS = new Set([
  "football",
  "soccer",
  "kenya",
  "kenyan",
  "afcon",
  "wafcon",
  "cecafa",
  "kagame",
  "cup",
  "league",
  "premier",
  "final",
  "semi",
  "quarter",
  "match",
  "game",
  "tie",
  "club",
  "team",
  "squad",
  "coach",
  "player",
  "star",
  "title",
  "season",
  "tournament",
  "qualifier",
  "campaign",
  "fixture",
  "derby",
  "sport",
  "sports",
]);

/** Words that carry event-level meaning: not filler, entity or beat vocabulary. */
function distinctiveTokens(title: string): string[] {
  const entityWords = new Set(entitiesIn(title).flatMap((e) => e.split(" ").map(stem)));
  return significantTokens(title).filter((t) => !TOPIC_TERMS.has(t) && !entityWords.has(t));
}

/**
 * Headlines this similar are treated as the same story, once the entity, number
 * and distinctiveness guards pass. Scored symmetrically (shared / union), so a
 * headline is not swallowed merely because a longer one repeats most of it.
 */
export const SAME_STORY_THRESHOLD = 0.5;

/** Shared event-level words required before two headlines can be merged. */
export const MIN_SHARED_DISTINCTIVE = 2;

/**
 * Whether two headlines describe the same story. Exact normalized match wins
 * outright. Otherwise every test must pass:
 *
 *  1. Entities agree — the named clubs and bodies must be the same set, so
 *     Harambee Stars is never merged with Harambee Starlets.
 *  2. Numbers do not contradict — if both headlines carry numbers and share
 *     none, they are different stories (different scorelines, different years).
 *     One side having numbers the other omits is fine.
 *  3. Enough meaningful words overlap, as a share of the combined vocabulary.
 *  4. At least two of the shared words are event-level rather than beat
 *     vocabulary, which is what stops a match preview from collapsing into the
 *     match report just because both name the tournament and the two clubs.
 *
 * Headlines with fewer than four meaningful words are only ever matched
 * exactly, since short titles overlap by accident. The guards are deliberately
 * tuned to under-merge: showing two near-identical headlines is a much smaller
 * failure than hiding a genuinely different story.
 */
export function isSameStory(a: string, b: string): boolean {
  const keyA = normalizeTitle(a);
  const keyB = normalizeTitle(b);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;

  const entA = entitiesIn(a);
  const entB = entitiesIn(b);
  if (entA.length !== entB.length || entA.some((e) => !entB.includes(e))) return false;

  const numA = numberTokens(a);
  const numB = numberTokens(b);
  if (numA.length && numB.length && !numA.some((n) => numB.includes(n))) return false;

  const tokensA = significantTokens(a);
  const tokensB = significantTokens(b);
  if (tokensA.length < 4 || tokensB.length < 4) return false;

  const setB = new Set(tokensB);
  const shared = tokensA.filter((t) => setB.has(t));
  const union = new Set([...tokensA, ...tokensB]).size;
  if (shared.length / union < SAME_STORY_THRESHOLD) return false;

  const distinctiveB = new Set(distinctiveTokens(b));
  const sharedDistinctive = distinctiveTokens(a).filter((t) => distinctiveB.has(t)).length;
  return sharedDistinctive >= MIN_SHARED_DISTINCTIVE;
}

/**
 * Collapses a list of articles to one entry per story, preferring the richest
 * record (image, then snippet) so a headline-only RSS item never displaces a
 * NewsData item covering the same event. Input order is otherwise preserved.
 */
export function dedupeByStory<
  T extends { title: string; imageUrl: string | null; description: string },
>(articles: T[]): { kept: T[]; duplicates: number } {
  const richness = (a: T) => (a.imageUrl ? 2 : 0) + (a.description ? 1 : 0);
  const kept: T[] = [];
  let duplicates = 0;

  for (const article of articles) {
    const matchIndex = kept.findIndex((k) => isSameStory(k.title, article.title));
    if (matchIndex === -1) {
      kept.push(article);
      continue;
    }
    duplicates += 1;
    const existing = kept[matchIndex]!;
    if (richness(article) > richness(existing)) kept[matchIndex] = article;
  }

  return { kept, duplicates };
}

/** Builds the localized Google News RSS URL for one query. */
export function googleNewsUrl(query: string, window: string): string {
  const q = window ? `${query} when:${window}` : query;
  const { base, hl, gl, ceid } = GOOGLE_NEWS_LOCALE;
  return `${base}?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`;
}

/** Sentiment label carried by a press article, mirroring the mention labels. */
export type NewsSentiment = "positive" | "neutral" | "negative";

/**
 * Terms that make a story genuinely about Kenyan football and the federation.
 * Both news sources return the occasional stray result (foreign leagues,
 * betting spam, unrelated politics), and the feed sits next to the federation's
 * own mentions, so anything that names none of these is dropped.
 *
 * Split in two: STRONG terms are unique to Kenyan football and stand alone.
 * SHARED terms (AFCON, CECAFA, Tusker, stadium names) also describe other
 * countries' stories, so they only count when the text also names Kenya.
 */
export const FKF_STRONG_TERMS: string[] = [
  "fkf",
  "football kenya",
  "harambee stars",
  "harambee starlets",
  "kenyan football",
  "kenya football",
  "kenya premier league",
  "fkf premier league",
  "national super league",
  "gor mahia",
  "afc leopards",
  "kariobangi sharks",
  "ulinzi stars",
  "hussein mohammed",
  "mcdonald mariga",
  "pamoja 2027",
];

/** Ambiguous terms: only relevant when the story is also about Kenya. */
export const FKF_SHARED_TERMS: string[] = [
  "tusker",
  "shabana",
  "bandari",
  "kenya police",
  "afcon",
  "cecafa",
  "talanta",
  "kasarani",
  "nyayo",
];

/** Words that establish the story is set in Kenya. */
export const KENYA_TERMS: string[] = ["kenya", "kenyan", "nairobi", "mombasa", "kisumu", "eldoret"];

/** Kept for callers that just want the full vocabulary. */
export const FKF_RELEVANCE_TERMS: string[] = [...FKF_STRONG_TERMS, ...FKF_SHARED_TERMS];

/** Whether a headline/snippet is about Kenyan football at all. */
export function isFkfRelevant(...parts: (string | null | undefined)[]): boolean {
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  if (!text.trim()) return false;
  if (FKF_STRONG_TERMS.some((term) => text.includes(term))) return true;
  const kenyan = KENYA_TERMS.some((term) => text.includes(term));
  return kenyan && FKF_SHARED_TERMS.some((term) => text.includes(term));
}
