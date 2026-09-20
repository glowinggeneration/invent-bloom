/**
 * "Current project" is a client-only UI filter, never a permission
 * boundary - matches every other sticky UI preference in this app (theme,
 * active-test resume, tip prefs), all localStorage-only with no server
 * column. This is safe specifically because switching it can never expose
 * another workspace's data: every project/reference/linked-item read goes
 * through server functions (src/lib/projects.functions.ts) that resolve
 * the caller's own workspace via resolveWorkspaceId()/RLS on every call,
 * regardless of what id happens to be sitting in localStorage. Setting
 * this to an arbitrary or stale id (someone else's workspace, a deleted
 * project) just means the next fetch returns nothing - the same "no rows"
 * result RLS already produces for any other unauthorized id.
 */

const KEY = "smait.currentProjectId";

export function readCurrentProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeCurrentProjectId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage can throw (private mode, quota) - losing the sticky
    // selection is harmless, so just drop it silently.
  }
}
