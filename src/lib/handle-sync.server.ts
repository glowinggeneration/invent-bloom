// Server-only: refresh stored @usernames from X and flag suspended accounts.
import { fetchXProfile, sleep } from "./twitterapi.server";

export type HandleSyncRow = {
  accountId: string;
  handle: string;
  newHandle: string | null;
  suspended: boolean;
  /** Whether the live X profile carries a verified check. */
  verified: boolean;
};

type Account = { id: string; handle: string; displayName: string };

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Look each account up on X by its stored username. When that lookup fails the
 * account was renamed, suspended or deleted - we then try to find it by its
 * profile name among the usernames the other accounts report, because a rename
 * only changes the @username, never the persona's display name. Anything we
 * cannot confirm by name is left alone and marked suspended, so an account
 * never inherits somebody else's username.
 */
export async function syncHandles(accounts: Account[]): Promise<HandleSyncRow[]> {
  // Pass 1: live lookup of every stored username.
  const liveNameToHandle = new Map<string, string>();
  const confirmed = new Map<string, string>();
  const verifiedByHandle = new Map<string, boolean>();

  for (const acc of accounts) {
    const { profile } = await fetchXProfile(acc.handle);
    if (profile?.handle) {
      confirmed.set(acc.id, profile.handle);
      verifiedByHandle.set(profile.handle.toLowerCase(), Boolean(profile.isVerified));
      const name = profile.displayName ? norm(profile.displayName) : "";
      if (name && !liveNameToHandle.has(name)) liveNameToHandle.set(name, profile.handle);
    }
    await sleep(120);
  }

  // Pass 2: assign each account the username whose live profile name matches
  // that account's persona name; fall back to a self-confirmed lookup.
  const claimed = new Set<string>();
  const rows: HandleSyncRow[] = [];

  for (const acc of accounts) {
    const byName = liveNameToHandle.get(norm(acc.displayName));
    const own = confirmed.get(acc.id);
    const target = byName ?? (own && norm(own) === norm(acc.handle) ? own : null);

    if (!target || claimed.has(target.toLowerCase())) {
      rows.push({
        accountId: acc.id,
        handle: acc.handle,
        newHandle: null,
        suspended: true,
        verified: false,
      });
      continue;
    }

    claimed.add(target.toLowerCase());
    rows.push({
      accountId: acc.id,
      handle: acc.handle,
      newHandle: target.toLowerCase() === acc.handle.toLowerCase() ? null : target,
      suspended: false,
      verified: verifiedByHandle.get(target.toLowerCase()) ?? false,
    });
  }

  return rows;
}
