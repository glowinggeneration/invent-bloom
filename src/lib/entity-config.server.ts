/**
 * Single source of truth for "what does this workspace monitor" - the
 * organisation's name/handle/aliases, its key figures (leadership,
 * spokespeople), and general context terms. Replaces the four
 * independently hand-copied FKF/president regex sets that used to live in
 * overview.server.ts, reports.server.ts, x-mentions-store.server.ts and
 * overview-intelligence.functions.ts, plus the hardcoded term lists in
 * apify-sources.ts, news.ts, social-sources.ts and brand-profiles.ts.
 *
 * The workspace ships with this configuration empty. Every relevance check
 * here MUST treat "unconfigured" as "accept everything," not "reject
 * everything" - the alternative silently stops all mention ingestion on a
 * freshly-provisioned workspace with no error anyone would notice.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LEGACY_SINGLE_WORKSPACE_ID } from "./workspace.server";

export type WorkspaceSettings = {
  orgName: string;
  orgAliases: string[];
  orgHandle: string;
  keyFigures: string[];
  contextTerms: string[];
  workspaceEmailDomain: string | null;
};

const EMPTY_SETTINGS: WorkspaceSettings = {
  orgName: "",
  orgAliases: [],
  orgHandle: "",
  keyFigures: [],
  contextTerms: [],
  workspaceEmailDomain: null,
};

export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  // TODO(Phase 3): thread a real per-request workspaceId through this
  // function's ~17 call sites instead of the LEGACY_SINGLE_WORKSPACE_ID
  // stopgap - see workspace.server.ts for why this is safe for now and why
  // it must change before self-serve signup ships.
  // Cast: the generated Supabase types don't know about workspace_id yet -
  // types are regenerated from the live schema, which this environment has
  // no credentials to reach. Same gap, same fix, as every other workspace_id
  // query added in this migration pass.
  const { data, error } = await (supabaseAdmin as any)
    .from("workspace_settings")
    .select("org_name, org_aliases, org_handle, key_figures, context_terms, workspace_email_domain")
    .eq("workspace_id", LEGACY_SINGLE_WORKSPACE_ID)
    .maybeSingle();
  if (error || !data) return EMPTY_SETTINGS;
  return {
    orgName: data.org_name ?? "",
    orgAliases: data.org_aliases ?? [],
    orgHandle: data.org_handle ?? "",
    keyFigures: data.key_figures ?? [],
    contextTerms: data.context_terms ?? [],
    workspaceEmailDomain: data.workspace_email_domain ?? null,
  };
}

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function alternation(terms: string[]): string | null {
  const cleaned = [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
  if (cleaned.length === 0) return null;
  // Longest first so a multi-word alias matches before a shorter substring of it.
  return cleaned
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
}

/** Matches the organisation's own name/handle/aliases. Null when unconfigured. */
export function buildOrgPattern(settings: WorkspaceSettings): RegExp | null {
  const alt = alternation([settings.orgName, settings.orgHandle, ...settings.orgAliases]);
  return alt ? new RegExp(`\\b(${alt})\\b`, "i") : null;
}

/** Matches configured key figures (leadership, spokespeople). Null when unconfigured. */
export function buildKeyFigurePattern(settings: WorkspaceSettings): RegExp | null {
  const alt = alternation(settings.keyFigures);
  return alt ? new RegExp(`\\b(${alt})\\b`, "i") : null;
}

/**
 * Matches anything configured as relevant to this workspace at all - org
 * identity, key figures, or general context terms. Null when nothing is
 * configured.
 */
export function buildRelevancePattern(settings: WorkspaceSettings): RegExp | null {
  const alt = alternation([
    settings.orgName,
    settings.orgHandle,
    ...settings.orgAliases,
    ...settings.keyFigures,
    ...settings.contextTerms,
  ]);
  return alt ? new RegExp(`\\b(${alt})\\b`, "i") : null;
}

/** True when unconfigured (accept-all) or the text matches the relevance pattern. */
export function isRelevantText(
  settings: WorkspaceSettings,
  ...text: (string | null | undefined)[]
): boolean {
  const pattern = buildRelevancePattern(settings);
  if (!pattern) return true;
  return pattern.test(text.filter(Boolean).join(" "));
}

export type EntityMatch = { org: boolean; keyFigure: boolean };

/** Replaces the repeated `FEDERATION.test(text)` / `PRESIDENT.test(text)` pairs. */
export function classifyEntityMention(settings: WorkspaceSettings, text: string): EntityMatch {
  const orgPattern = buildOrgPattern(settings);
  const figurePattern = buildKeyFigurePattern(settings);
  return {
    org: orgPattern ? orgPattern.test(text) : false,
    keyFigure: figurePattern ? figurePattern.test(text) : false,
  };
}

/** The organisation's own social handle(s), for reply-targeting. Empty when unconfigured. */
export function brandHandles(settings: WorkspaceSettings): string[] {
  return settings.orgHandle ? [settings.orgHandle] : [];
}

/** Short natural-language description of the monitored subject, for AI prompts. */
export function describeSubject(settings: WorkspaceSettings): string {
  const org = settings.orgName.trim();
  const figures = settings.keyFigures.filter(Boolean);
  if (!org && figures.length === 0) return "the organisation and its leadership";
  if (figures.length === 0) return org;
  if (!org) return `the organisation and ${figures.join(", ")}`;
  return `${org} and ${figures.join(", ")}`;
}
