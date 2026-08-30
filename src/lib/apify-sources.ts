/**
 * What the platform listens to outside X, and how a collected item is judged.
 *
 * Everything editable lives here: the monitoring subject's search terms, the
 * pages and accounts we watch by name, the relevance test and the entity
 * tags. No network calls and no secrets, so both the browser and the server
 * can import it.
 *
 * The collection itself runs through Apify actors on the server
 * (`apify-collect.server.ts`); this file only decides what to ask for and
 * what is worth keeping.
 */

/** Every platform that can put an item in the mentions feed via Apify. */
export type ApifyPlatform =
  "facebook" | "tiktok" | "linkedin" | "threads" | "instagram" | "snapchat" | "youtube" | "news";

export type ApifyContentType =
  "post" | "video" | "short" | "story" | "article" | "group_post" | "reel";

/** One collection lane. Each maps to a single Apify actor call. */
export type ApifySourceKey =
  | "tiktok"
  | "facebook_search"
  | "facebook_pages"
  | "facebook_groups"
  | "instagram"
  | "instagram_stories"
  | "threads"
  | "linkedin"
  | "youtube"
  | "youtube_shorts"
  | "snapchat"
  | "google_news";

/**
 * The label shown in the Mentions source filter. Stored on the row so the
 * filter never has to re-derive it, and so Groups / Stories / Shorts read as
 * their own channel while still belonging to their parent platform.
 */
export function sourceLabel(platform: ApifyPlatform, contentType: ApifyContentType): string {
  if (platform === "facebook" && contentType === "group_post") return "Facebook Groups";
  if (platform === "instagram" && contentType === "story") return "Instagram Stories";
  if (platform === "youtube" && contentType === "short") return "YouTube Shorts";
  const names: Record<ApifyPlatform, string> = {
    facebook: "Facebook",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
    threads: "Threads",
    instagram: "Instagram",
    snapchat: "Snapchat",
    youtube: "YouTube",
    news: "News",
  };
  return names[platform];
}

/** Order the source filter lists platforms in, once each has data. */
export const APIFY_SOURCE_LABELS: string[] = [
  "Facebook",
  "Facebook Groups",
  "Instagram",
  "Instagram Stories",
  "TikTok",
  "Threads",
  "LinkedIn",
  "YouTube",
  "YouTube Shorts",
  "Snapchat",
  "News",
];

/* ------------------------------------------------------------------ */
/* Monitoring subject                                                   */
/* ------------------------------------------------------------------ */

/**
 * Terms that on their own prove an item is about the federation or its
 * president. A single hit is enough to keep the item.
 */
export const SUBJECT_TERMS: string[] = [
  "football kenya federation",
  "footballkenyafederation",
  "fkf",
  "football kenya",
  "footballkenya",
  "hussein mohammed",
  "hussein mohamed",
  "husseinmoha",
  "football_kenya",
  "football_kenya_federation",
  "harambee stars",
  "harambeestars",
  "harambee starlets",
  "harambeestarlets",
  "fkf premier league",
  "fkfpl",
  "national super league",
  "pamoja 2027",
];

/**
 * Terms that only count when the item is also clearly about Kenyan football.
 * "grassroots football" alone is noise; "grassroots football" plus Kenya is
 * the federation's own beat.
 */
export const CONTEXT_TERMS: string[] = [
  "kenya national team",
  "kenyan football",
  "kenya football",
  "grassroots football",
  "youth football",
  "football development",
  "fkf grassroots",
  "fkf u15",
  "fkf u17",
  "afcon 2027",
  "kenyan premier league",
  "gor mahia",
  "afc leopards",
  "mcdonald mariga",
];

const KENYA_TERMS = ["kenya", "kenyan", "nairobi", "harambee", "254"];
const FOOTBALL_TERMS = ["football", "soccer", "mpira", "league", "afcon", "fifa", "caf"];

/** Search phrases handed to the actors that support keyword search. */
export const SEARCH_QUERIES: string[] = [
  "Football Kenya Federation",
  "FKF Kenya",
  "Hussein Mohammed FKF",
  "FKF President",
  "Harambee Stars",
  "Kenyan football federation",
];

/** Narrower query set for the slower, per-item-priced lanes. */
export const CORE_QUERIES: string[] = [
  "Football Kenya Federation",
  "Hussein Mohammed FKF",
  "Harambee Stars",
];

/** Hashtags used where a platform only searches tags (Instagram). */
export const HASHTAGS: string[] = [
  "harambeestars",
  "footballkenyafederation",
  "fkfpl",
  "harambeestarlets",
];

/* ------------------------------------------------------------------ */
/* Watched accounts. Empty slots stay dormant — the sweep skips them.   */
/* ------------------------------------------------------------------ */

export const FACEBOOK_PAGES: string[] = ["https://www.facebook.com/FootballKenyaFederation"];

/** Public groups only. Private groups are never attempted. */
export const FACEBOOK_GROUPS: string[] = [
  "https://www.facebook.com/groups/375773392445938/",
  "https://www.facebook.com/groups/716130020228848/",
  "https://www.facebook.com/groups/944699093685479/",
  "https://www.facebook.com/groups/1303164080155766/",
  "https://www.facebook.com/groups/37665162488/",
  "https://www.facebook.com/groups/1049565702204411/",
  "https://www.facebook.com/groups/588502012102727/",
  "https://www.facebook.com/groups/861087688138515/",
  "https://www.facebook.com/groups/Kplchart/",
  "https://www.facebook.com/groups/1921866558092523/",
];

/** Public Instagram accounts followed for posts and reels. */
export const INSTAGRAM_ACCOUNTS: string[] = ["footballkenyafederation"];

/**
 * Stories need an account that is both public and currently posting, and the
 * available actors are unreliable without a logged-in session. Left empty so
 * the lane reports itself unavailable instead of inventing rows.
 */
export const INSTAGRAM_STORY_ACCOUNTS: string[] = [];

/**
 * Snapchat has no public keyword search; only named public profiles can be
 * read. Empty until a federation profile is confirmed.
 */
export const SNAPCHAT_PROFILES: string[] = [];

/** Official profiles shown at the top of Mentions, alongside the X accounts. */
export const WATCHED_PROFILES: {
  platform: ApifyPlatform;
  handle: string;
  url: string;
}[] = [
  {
    platform: "facebook",
    handle: "FootballKenyaFederation",
    url: "https://www.facebook.com/FootballKenyaFederation",
  },
  {
    platform: "youtube",
    handle: "FootballKenyaFederation",
    url: "https://www.youtube.com/@FootballKenyaFederation",
  },
  {
    platform: "instagram",
    handle: "football_kenya_federation",
    url: "https://www.instagram.com/football_kenya_federation/",
  },
  {
    platform: "tiktok",
    handle: "footballkenya",
    url: "https://www.tiktok.com/@footballkenya",
  },
];

/* ------------------------------------------------------------------ */
/* Relevance and classification                                         */
/* ------------------------------------------------------------------ */

function haystack(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9@_ ]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Which of the monitored terms an item actually names. An empty list means the
 * item is not about the federation and is discarded before it reaches the feed.
 */
export function matchKeywords(...parts: (string | null | undefined)[]): string[] {
  const text = haystack(...parts);
  if (!text.trim()) return [];

  const hits = SUBJECT_TERMS.filter((t) => text.includes(t.replace(/[^a-z0-9@_ ]+/g, " ")));
  if (hits.length) return hits;

  // Context terms need the item to be about Kenya and about football before
  // they count, which is what keeps generic "football development" posts out.
  const kenyan = KENYA_TERMS.some((t) => text.includes(t));
  const footballish = FOOTBALL_TERMS.some((t) => text.includes(t));
  if (!kenyan || !footballish) return [];
  return CONTEXT_TERMS.filter((t) => text.includes(t));
}

export function isRelevant(...parts: (string | null | undefined)[]): boolean {
  return matchKeywords(...parts).length > 0;
}

/** The tags a mention can carry. A mention may carry several. */
export const ENTITY_TAGS = [
  "FKF",
  "Hussein Mohammed",
  "FKF + Hussein Mohammed",
  "Harambee Stars",
  "Harambee Starlets",
  "Grassroots Football",
  "Kenyan Football",
  "League / Competitions",
  "Governance",
  "Other FKF-related",
] as const;

export type EntityTag = (typeof ENTITY_TAGS)[number];

/** Reads the subject tags off an item's own words. */
export function classifyEntities(...parts: (string | null | undefined)[]): EntityTag[] {
  const text = haystack(...parts);
  const tags = new Set<EntityTag>();

  const fkf = /\bfkf\b/.test(text) || text.includes("football kenya");
  const president =
    text.includes("hussein moha") || text.includes("husseinmoha") || text.includes("fkf president");

  if (fkf) tags.add("FKF");
  if (president) tags.add("Hussein Mohammed");
  if (fkf && president) tags.add("FKF + Hussein Mohammed");
  if (text.includes("harambee stars") || text.includes("harambeestars")) tags.add("Harambee Stars");
  if (text.includes("starlets")) tags.add("Harambee Starlets");
  if (/grassroots|youth|u15|u17|academy|school|scouting|talent/.test(text))
    tags.add("Grassroots Football");
  if (/kenya|kenyan/.test(text)) tags.add("Kenyan Football");
  if (/league|cup|afcon|qualifier|fixture|championship|tournament|nsl|premier/.test(text))
    tags.add("League / Competitions");
  if (
    /election|court|tribunal|corruption|audit|governance|constitution|ban|committee|fifa/.test(text)
  )
    tags.add("Governance");

  if (tags.size === 0) tags.add("Other FKF-related");
  return [...tags];
}

/** Compact metric label: 42300 -> 42.3K. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}K`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}
