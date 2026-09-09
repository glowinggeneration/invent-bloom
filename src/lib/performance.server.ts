// Server-only: refreshes public metrics for every post/reply the linked
// accounts have published, and stores them in public.tweet_metrics.

import { fetchTweetMetrics, sleep } from "./twitterapi.server";

export type RefreshResult = {
  userId: string;
  tracked: number;
  updated: number;
  remaining: number;
  total: number;
  errors: string[];
};

const POST_ACTIONS = new Set(["tweet", "post", "reply", "comment", "quote"]);

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Pull fresh engagement numbers for one workspace owner. */
export async function refreshUserMetrics(
  userId: string,
  workspaceId: string,
): Promise<RefreshResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const errors: string[] = [];

  const byTweet = new Map<
    string,
    { accountId: string | null; handle: string; kind: string; content: string }
  >();

  // Published posts and replies, paged so a busy workspace is covered in full.
  const PAGE = 1000;
  for (let page = 0; page < 20; page += 1) {
    const { data: actions, error } = await (supabaseAdmin as any)
      .from("publish_actions")
      .select("account_id, action_type, content, result_tweet_id, x_accounts(handle)")
      .eq("workspace_id", workspaceId)
      .eq("status", "success")
      .in("action_type", [...POST_ACTIONS])
      .not("result_tweet_id", "is", null)
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) {
      errors.push(error.message);
      break;
    }
    const rows = (actions ?? []) as any[];
    for (const a of rows) {
      const tweetId = String(a.result_tweet_id ?? "");
      if (!tweetId || byTweet.has(tweetId)) continue;
      byTweet.set(tweetId, {
        accountId: a.account_id ?? null,
        handle: a.x_accounts?.handle ?? "",
        kind:
          String(a.action_type) === "tweet" || String(a.action_type) === "post" ? "tweet" : "reply",
        content: String(a.content ?? ""),
      });
    }
    if (rows.length < PAGE) break;
  }

  // Campaign replies live in their own table but are just as much "published
  // by a persona", so their engagement belongs in Performance too.
  const { data: campaignReplies } = await (supabaseAdmin as any)
    .from("campaign_replies")
    .select("account_id, handle, reply_text, result_tweet_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "success")
    .not("result_tweet_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  for (const r of (campaignReplies ?? []) as any[]) {
    const tweetId = String(r.result_tweet_id ?? "");
    if (!tweetId || byTweet.has(tweetId)) continue;
    byTweet.set(tweetId, {
      accountId: r.account_id ?? null,
      handle: r.handle ?? "",
      kind: "reply",
      content: String(r.reply_text ?? ""),
    });
  }

  // Always-on daily posts publish outside the composer, so pull them in too.
  const { data: dailyPosts } = await (supabaseAdmin as any)
    .from("persona_daily_posts")
    .select("account_id, content, result_tweet_id, x_accounts(handle)")
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .not("result_tweet_id", "is", null)
    .order("published_at", { ascending: false })
    .limit(2000);
  for (const p of (dailyPosts ?? []) as any[]) {
    const tweetId = String(p.result_tweet_id ?? "");
    if (!tweetId || byTweet.has(tweetId)) continue;
    byTweet.set(tweetId, {
      accountId: p.account_id ?? null,
      handle: p.x_accounts?.handle ?? "",
      kind: "tweet",
      content: String(p.content ?? ""),
    });
  }

  const allIds = [...byTweet.keys()];

  // Posts we have never measured come first, then the ones measured longest
  // ago, so a big backlog fills in over consecutive runs.
  const seen = new Map<string, string>();
  for (let page = 0; page < 20; page += 1) {
    const { data: known } = await (supabaseAdmin as any)
      .from("tweet_metrics")
      .select("tweet_id, fetched_at")
      .eq("workspace_id", workspaceId)
      .range(page * 1000, page * 1000 + 999);
    const rows = (known ?? []) as { tweet_id: string; fetched_at: string }[];
    for (const r of rows) seen.set(r.tweet_id, r.fetched_at);
    if (rows.length < 1000) break;
  }
  allIds.sort((a, b) => (seen.get(a) ?? "").localeCompare(seen.get(b) ?? ""));

  // The provider caps each lookup at 50 ids, and one run is time-boxed so the
  // request always returns; the caller repeats until `remaining` hits zero.
  const BATCH = 50;
  const MAX_PER_RUN = 400;
  const ids = allIds.slice(0, MAX_PER_RUN);
  let updated = 0;

  for (const batch of chunk(ids, BATCH)) {
    const { tweets, error: apiError } = await fetchTweetMetrics(batch);
    if (apiError && errors.length < 3) errors.push(apiError);
    if (!tweets.length) {
      await sleep(200);
      continue;
    }

    const rows = tweets.map((t) => {
      const meta = byTweet.get(t.tweetId);
      return {
        workspace_id: workspaceId,
        user_id: userId,
        account_id: meta?.accountId ?? null,
        handle: meta?.handle || t.authorHandle,
        tweet_id: t.tweetId,
        kind: meta?.kind ?? (t.isReply ? "reply" : "tweet"),
        content: t.text || meta?.content || "",
        like_count: t.likeCount,
        retweet_count: t.retweetCount,
        reply_count: t.replyCount,
        quote_count: t.quoteCount,
        bookmark_count: t.bookmarkCount,
        impression_count: t.impressionCount,
        tweeted_at: t.createdAt,
        fetched_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await (supabaseAdmin as any)
      .from("tweet_metrics")
      .upsert(rows, { onConflict: "user_id,tweet_id" });
    if (upsertError) errors.push(upsertError.message);
    else updated += rows.length;

    await sleep(200);
  }

  return {
    userId,
    tracked: ids.length,
    updated,
    remaining: Math.max(0, allIds.length - ids.length),
    total: allIds.length,
    errors,
  };
}

/** Refresh metrics for every workspace that owns linked accounts. */
export async function refreshAllMetrics(): Promise<RefreshResult[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("x_accounts")
    .select("user_id, workspace_id")
    .eq("is_active", true);
  const pairs = new Map<string, string>();
  for (const r of (data ?? []) as { user_id: string; workspace_id: string }[]) {
    pairs.set(r.user_id, r.workspace_id);
  }
  const results: RefreshResult[] = [];
  for (const [userId, workspaceId] of pairs) {
    try {
      results.push(await refreshUserMetrics(userId, workspaceId));
    } catch (e) {
      results.push({
        userId,
        tracked: 0,
        updated: 0,
        remaining: 0,
        total: 0,
        errors: [(e as Error).message],
      });
    }
  }
  return results;
}
