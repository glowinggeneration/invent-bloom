/**
 * Server-only half of apify-sources.ts: the accounts/queries the Apify
 * collectors watch and the relevance/classification tests applied to what
 * they return. Split out because this now reads workspace_settings via
 * entity-config.server.ts (which touches the service-role client), and
 * apify-sources.ts's display helpers (formatCount, sourceLabel,
 * APIFY_SOURCE_LABELS) are imported directly by client components -
 * bundling a service-role-touching module into those would either fail the
 * client build or leak server-only code into the browser bundle.
 *
 * All the account/query lists here are empty by default. This workspace
 * ships generic/unconfigured: there is no hardcoded organisation to watch
 * for until one is configured (via setup or governance). Wiring these
 * lists to the already-built Monitoring Watchlist (kind: "account", which
 * already carries a platform column) is a natural next step, tracked in
 * the Exception Register rather than built speculatively here.
 */
import type { ApifyPlatform } from "./apify-sources";
import {
  buildRelevancePattern,
  classifyEntityMention,
  type WorkspaceSettings,
} from "./entity-config.server";

/** Search phrases handed to the actors that support keyword search. Empty until configured. */
export const SEARCH_QUERIES: string[] = [];

/** Narrower query set for the slower, per-item-priced lanes. Empty until configured. */
export const CORE_QUERIES: string[] = [];

/** Hashtags used where a platform only searches tags (Instagram). Empty until configured. */
export const HASHTAGS: string[] = [];

export const FACEBOOK_PAGES: string[] = [];

/** Public groups only. Private groups are never attempted. */
export const FACEBOOK_GROUPS: string[] = [];

/** Public Instagram accounts followed for posts and reels. */
export const INSTAGRAM_ACCOUNTS: string[] = [];

/**
 * Stories need an account that is both public and currently posting, and the
 * available actors are unreliable without a logged-in session. Left empty so
 * the lane reports itself unavailable instead of inventing rows.
 */
export const INSTAGRAM_STORY_ACCOUNTS: string[] = [];

/**
 * Snapchat has no public keyword search; only named public profiles can be
 * read. Empty until a profile is confirmed.
 */
export const SNAPCHAT_PROFILES: string[] = [];

/** Official profiles shown at the top of Mentions, alongside the X accounts. */
export const WATCHED_PROFILES: {
  platform: ApifyPlatform;
  handle: string;
  url: string;
}[] = [];

function haystack(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9@_ ]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Which of the monitored terms an item actually names, for display
 * (`apify_mentions.matched_keywords`). Genuinely empty when the workspace
 * has nothing configured - there is nothing to report as "matched" - but
 * that must NOT be read as "not relevant"; use isRelevant() for the gate.
 */
export function matchKeywords(
  settings: WorkspaceSettings,
  ...parts: (string | null | undefined)[]
): string[] {
  const text = haystack(...parts);
  const pattern = buildRelevancePattern(settings);
  if (!pattern || !text.trim()) return [];
  const match = text.match(new RegExp(pattern.source, "gi"));
  return match ? [...new Set(match)] : [];
}

/**
 * The actual relevance gate. An unconfigured workspace (no pattern to test
 * against) accepts everything - the alternative silently discards the
 * entire collection pipeline with nothing configured to reject against.
 */
export function isRelevant(settings: WorkspaceSettings, ...parts: (string | null | undefined)[]): boolean {
  const pattern = buildRelevancePattern(settings);
  if (!pattern) return true;
  return matchKeywords(settings, ...parts).length > 0;
}

/** The tags a mention can carry. A mention may carry several. */
export const ENTITY_TAGS = [
  "Organisation",
  "Leadership",
  "Organisation + Leadership",
  "Governance",
  "Other",
] as const;

export type EntityTag = (typeof ENTITY_TAGS)[number];

/** Reads the configured-subject tags off an item's own words. */
export function classifyEntities(
  settings: WorkspaceSettings,
  ...parts: (string | null | undefined)[]
): EntityTag[] {
  const text = haystack(...parts);
  const tags = new Set<EntityTag>();

  const { org, keyFigure } = classifyEntityMention(settings, text);
  if (org) tags.add("Organisation");
  if (keyFigure) tags.add("Leadership");
  if (org && keyFigure) tags.add("Organisation + Leadership");
  if (/election|court|tribunal|corruption|audit|governance|constitution|ban|committee/.test(text))
    tags.add("Governance");

  if (tags.size === 0) tags.add("Other");
  return [...tags];
}
