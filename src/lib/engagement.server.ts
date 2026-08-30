/**
 * X account utilities.
 *
 * Legacy fleet-wide engagement helpers remain exported for compatibility, but
 * coordinated cross-following, peer boosting and multi-account engagement of
 * one target are intentionally disabled. Monitoring helpers remain available.
 */

export type SweepSummary = {
  jobId: string | null;
  accounts: number;
  follows: { ok: number; failed: number };
  watch: { targets: number; ok: number; failed: number };
};

type Row = { id: string; handle: string; auth_token: string | null; proxy: string | null };

/** Every linked, active account that can act (has a session token). */
export async function loadActiveAccounts(admin: any, _userId: string): Promise<Row[]> {
  const { data, error } = await admin
    .from("x_accounts")
    .select("id, handle, auth_token, proxy")
    .eq("is_active", true)
    .eq("suspended", false)
    .order("handle");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).filter((a) => Boolean(a.auth_token));
}

/**
 * The old execution watchlist has been retired. Monitoring priorities now live
 * in `monitoring_watchlist` and never become automatic engagement targets.
 */
export async function loadWatchTargets(
  _twitter: typeof import("./twitterapi.server"),
): Promise<{ handle: string; tweetId: string }[]> {
  return [];
}

const DISABLED_COORDINATION =
  "This fleet-wide engagement action is disabled. X campaign activity must use explicitly selected accounts and may not coordinate multiple linked accounts to inflate the same post or account.";

/** Legacy standing engagement sweep. Disabled by policy. */
export async function sweepEngagement(_userId: string): Promise<SweepSummary> {
  throw new Error(DISABLED_COORDINATION);
}

/** Legacy 'engage one post with every linked account' action. Disabled by policy. */
export async function engageWithTweet(
  _userId: string,
  tweetUrl: string,
): Promise<{
  jobId: string | null;
  accounts: number;
  ok: number;
  failed: number;
  tweetId: string;
}> {
  void tweetUrl;
  throw new Error(DISABLED_COORDINATION);
}

export type FollowLogEntry = {
  actor: string;
  target: string;
  status: "ok" | "failed";
  attempts: number;
  error?: string | null | undefined;
  at: string;
};

/** Legacy cross-follow operation. Automated proactive following is disabled. */
export async function crossFollowBatch(
  _userId: string,
  _offset: number,
  _batchSize = 3,
): Promise<{
  total: number;
  processed: number;
  nextOffset: number | null;
  ok: number;
  failed: number;
  retried: number;
  log: FollowLogEntry[];
}> {
  throw new Error(
    "Automated proactive following is disabled. Follow decisions must be made manually on X.",
  );
}

export type LatestTarget = { handle: string; tweetId: string; accountId: string };

/** Newest post of every linked, active account. Read-only monitoring helper. */
export async function loadOwnLatestTargets(userId: string): Promise<LatestTarget[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const twitter = await import("./twitterapi.server");
  const accounts = await loadActiveAccounts(supabaseAdmin as any, userId);

  const out: LatestTarget[] = [];
  const chunk = 8;
  for (let i = 0; i < accounts.length; i += chunk) {
    const slice = accounts.slice(i, i + chunk);
    const res = await Promise.all(
      slice.map(async (a) => {
        try {
          const { ids } = await twitter.fetchLatestTweetIds(a.handle, 1);
          return ids[0]
            ? { handle: a.handle.replace(/^@/, ""), tweetId: ids[0], accountId: a.id }
            : null;
        } catch {
          return null;
        }
      }),
    );
    for (const row of res) if (row) out.push(row);
  }
  return out;
}

/** Legacy cross-engagement operation. Disabled by policy. */
export async function crossEngageLatestBatch(
  _userId: string,
  _offset: number,
  targetsIn: LatestTarget[] | null,
  _batchSize = 3,
): Promise<{
  total: number;
  processed: number;
  nextOffset: number | null;
  ok: number;
  failed: number;
  targets: LatestTarget[];
}> {
  void targetsIn;
  throw new Error(DISABLED_COORDINATION);
}

/**
 * Legacy helper used by older publish code. Peer posts are no longer automatic
 * execution targets, so this returns no targets.
 */
export async function loadPeerLatestTargets(
  _twitter: typeof import("./twitterapi.server"),
  _accounts: { id: string; handle: string }[],
  _max = 12,
): Promise<LatestTarget[]> {
  return [];
}

/** Legacy 'every account follows one handle' operation. Disabled by policy. */
export async function followHandleBatch(
  _userId: string,
  _handle: string,
  _offset: number,
  _batchSize = 8,
): Promise<{
  total: number;
  processed: number;
  nextOffset: number | null;
  ok: number;
  failed: number;
  retried: number;
  log: FollowLogEntry[];
}> {
  throw new Error(
    "Automated proactive following is disabled. Follow decisions must be made manually on X.",
  );
}
