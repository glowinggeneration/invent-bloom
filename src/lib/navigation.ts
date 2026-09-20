/**
 * Pure active-state matching for the five-destination navigation
 * (sidebar groups, mobile tabs, command search). Kept separate from
 * workspace-shell.tsx so the nested-route matching logic is unit-testable
 * without rendering the component tree.
 */

/** True when `pathname` is inside a destination's section, given its match prefixes. */
export function isSectionActive(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

export type DestinationGroupKey = "intelligence" | "studio" | "campaigns" | "results";

/**
 * Extra path prefixes that belong to a group beyond its literal nav item
 * paths - nested/detail routes that don't share a URL prefix with any
 * member item (e.g. `/campaign/post` belongs to Campaigns even though no
 * sidebar item's `to` is `/campaign`).
 */
export const GROUP_EXTRA_PREFIXES: Record<DestinationGroupKey, string[]> = {
  intelligence: [],
  studio: ["/chat", "/recommendations"],
  campaigns: ["/campaign", "/publish"],
  results: [],
};
