/**
 * Scheduled action engine.
 *
 * Campaign activity is written to `public.scheduled_actions` with a `run_at`
 * time, then drained by the scheduled-actions hook. The queue applies the same
 * compliance and account-health rules regardless of which UI created a job.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  bookmarkTweet,
  likeTweet,
  postTweet,
  replyToTweet,
  retweetTweet,
  sleep,
  uploadMedia,
  type PostingAccount,
} from "./twitterapi.server";
import {
  deferAccountQueue,
  isAccountChallengeError,
  isRateLimitOrCapacityError,
  planCompliantSchedule,
} from "./x-compliance.server";

type Admin = SupabaseClient<any, any, any>;

export type ScheduledActionInsert = {
  user_id: string;
  source: "publish" | "campaign" | "queue";
  job_id?: string | null;
  campaign_id?: string | null;
  publish_action_id?: string | null;
  campaign_reply_id?: string | null;
  account_id: string;
  handle: string;
  persona_name?: string;
  action_type: "tweet" | "comment" | "like" | "retweet" | "bookmark" | "follow";
  content?: string;
  target_tweet_id?: string | null;
  target_handle?: string | null;
  media_urls?: string[];
  run_at: string;
};

const MAX_ATTEMPTS = 6;
/** Backoff for transient non-capacity errors. */
const RETRY_DELAYS_MS = [3, 8, 20, 45, 90].map((m) => m * 60 * 1000);

/** Errors that will never succeed on a retry, so the row is failed straight away. */
function isPermanent(error: string | null) {
  const e = (error ?? "").toLowerCase();
  return (
    e.includes("duplicate") ||
    e.includes("already") ||
    e.includes("no saved login cookies") ||
    e.includes("no longer exists") ||
    e.includes("suspend") ||
    e.includes("temporarily locked") ||
    e.includes("missing twitterusernotsuspended") ||
    e.includes("credits is not enough") ||
    e.includes("insufficient credit") ||
    e.includes("not found")
  );
}

/** Wording X uses when an account has been suspended. */
function looksSuspended(error: string | null) {
  const e = (error ?? "").toLowerCase();
  return e.includes("suspend") || e.includes("missing twitterusernotsuspended");
}

/**
 * Clears the queue of an account that can no longer act. Each waiting action is
 * first offered to a healthy persona; only work that cannot be moved is failed.
 */
async function cancelQueuedFor(admin: Admin, accountId: string, reason: string) {
  const { data: waiting } = await admin
    .from("scheduled_actions")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "pending");

  for (const row of (waiting ?? []) as any[]) {
    const moved = await reassignToHealthyAccount(admin, row, reason);
    if (moved) continue;
    await admin
      .from("scheduled_actions")
      .update({ status: "failed", error: reason })
      .eq("id", row.id)
      .eq("status", "pending");
  }
}

/**
 * Moves a queued action to another healthy persona when its own account can no
 * longer act (suspended, locked, session revoked). Keeps a campaign alive
 * instead of losing the reply/post entirely.
 *
 * @returns the new handle when the action was reassigned, otherwise null.
 */
async function reassignToHealthyAccount(
  admin: Admin,
  row: any,
  reason: string,
): Promise<string | null> {
  if ((row.reassignments ?? 0) >= 3) return null;

  const { data: candidates } = await admin
    .from("x_accounts")
    .select("id, handle, display_name, persona_label")
    .eq("is_active", true)
    .eq("suspended", false)
    .not("auth_token", "is", null);
  const pool = (candidates ?? []).filter((a: any) => a.id !== row.account_id);
  if (!pool.length) return null;

  // Never let two personas act on the same X post.
  let taken = new Set<string>();
  if (row.target_tweet_id) {
    const { data: existing } = await admin
      .from("scheduled_actions")
      .select("account_id")
      .eq("target_tweet_id", row.target_tweet_id)
      .in("status", ["pending", "running", "success", "failed"]);
    taken = new Set((existing ?? []).map((r: any) => r.account_id));
  }

  const next = pool.find((a: any) => !taken.has(a.id));
  if (!next) return null;

  const { data: moved } = await admin
    .from("scheduled_actions")
    .update({
      account_id: next.id,
      handle: next.handle,
      persona_name: next.display_name || next.persona_label || next.handle,
      status: "pending",
      attempts: 0,
      reassignments: (row.reassignments ?? 0) + 1,
      run_at: new Date(Date.now() + 30 * 1000).toISOString(),
      error: `${reason} Reassigned to @${next.handle}.`,
    })
    .eq("id", row.id)
    .select("id")
    .maybeSingle();

  return moved ? next.handle : null;
}

/**
 * Queues actions after a policy and recent-account-load review. The planner may
 * push `run_at` later to respect account cooldowns. Unsafe coordinated batches
 * fail before anything is inserted.
 */
export async function enqueueScheduledActions(
  admin: Admin,
  rows: ScheduledActionInsert[],
): Promise<string[]> {
  if (!rows.length) return [];

  const planned = await planCompliantSchedule(
    admin,
    rows.map((row) => ({
      ...row,
      accountId: row.account_id,
      handle: row.handle,
      actionType: row.action_type,
      content: row.content ?? "",
      targetTweetId: row.target_tweet_id ?? null,
      targetHandle: row.target_handle ?? null,
      runAt: row.run_at,
    })),
  );

  const { data, error } = await admin
    .from("scheduled_actions")
    .insert(
      planned.map(({ row, runAt }) => ({
        user_id: row.user_id,
        source: row.source,
        job_id: row.job_id ?? null,
        campaign_id: row.campaign_id ?? null,
        publish_action_id: row.publish_action_id ?? null,
        campaign_reply_id: row.campaign_reply_id ?? null,
        account_id: row.account_id,
        handle: row.handle,
        persona_name: row.persona_name ?? "",
        action_type: row.action_type,
        content: row.content ?? "",
        target_tweet_id: row.target_tweet_id ?? null,
        target_handle: row.target_handle ?? null,
        media_urls: row.media_urls ?? [],
        run_at: runAt,
      })),
    )
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { id: string }) => r.id);
}

async function mediaIdsFor(posting: PostingAccount, urls: string[]) {
  const ids: string[] = [];
  for (const url of urls) {
    const fetched = await fetch(url);
    if (!fetched.ok) throw new Error(`Could not fetch media: ${fetched.status}`);
    const bytes = new Uint8Array(await fetched.arrayBuffer());
    const upload = await uploadMedia(posting, {
      bytes,
      name: url.split("/").pop()?.split("?")[0] || "media",
      contentType: fetched.headers.get("content-type") || "application/octet-stream",
    });
    if (!upload.ok) throw new Error(upload.error ?? "Media upload failed.");
    ids.push(upload.mediaId);
  }
  return ids;
}

/** Runs one queued action against X and returns the raw API outcome. */
async function performAction(row: any, posting: PostingAccount) {
  switch (row.action_type) {
    case "tweet": {
      const media = await mediaIdsFor(posting, row.media_urls ?? []);
      return postTweet(posting, row.content, media);
    }
    case "comment": {
      const media = await mediaIdsFor(posting, row.media_urls ?? []);
      return replyToTweet(posting, row.target_tweet_id, row.content, media);
    }
    case "like":
      return likeTweet(posting, row.target_tweet_id);
    case "retweet":
      return retweetTweet(posting, row.target_tweet_id);
    case "bookmark":
      return bookmarkTweet(posting, row.target_tweet_id);
    case "follow":
      return {
        ok: false,
        tweetId: null,
        error: "Automated proactive following is disabled by the campaign compliance policy.",
      };
    default:
      return { ok: false, tweetId: null, error: `Unknown action ${row.action_type}` };
  }
}

/** Mirrors the outcome onto the archive row the UI already shows. */
async function mirrorResult(
  admin: Admin,
  row: any,
  ok: boolean,
  tweetId: string | null,
  error: string | null,
) {
  if (row.publish_action_id) {
    await admin
      .from("publish_actions")
      .update({ status: ok ? "success" : "failed", result_tweet_id: tweetId, error })
      .eq("id", row.publish_action_id);
  }
  if (row.campaign_reply_id) {
    await admin
      .from("campaign_replies")
      .update({ status: ok ? "success" : "failed", result_tweet_id: tweetId, error })
      .eq("id", row.campaign_reply_id);
  }
}

export type DrainSummary = { picked: number; succeeded: number; failed: number; retried: number };

/** Drains every action whose time has arrived (optionally for one user/job). */
export async function runDueScheduledActions(input: {
  admin: Admin;
  userId?: string;
  jobId?: string;
  limit?: number;
}): Promise<DrainSummary> {
  const { admin, userId } = input;
  const limit = input.limit ?? 40;

  const { data: workspaceState } = await admin
    .from("workspace_execution_state")
    .select("paused")
    .eq("singleton", true)
    .maybeSingle();
  if (workspaceState?.paused) return { picked: 0, succeeded: 0, failed: 0, retried: 0 };

  // Rescue anything left mid-flight by a crashed or timed-out drain so no
  // action is silently lost.
  await admin
    .from("scheduled_actions")
    .update({ status: "pending" })
    .eq("status", "running")
    .lt("updated_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

  let query = admin
    .from("scheduled_actions")
    .select("*")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("run_at", { ascending: true })
    .limit(limit);
  if (userId) query = query.eq("user_id", userId);
  if (input.jobId) query = query.eq("job_id", input.jobId);

  const { data: due, error } = await query;
  if (error) throw new Error(error.message);

  const summary: DrainSummary = { picked: (due ?? []).length, succeeded: 0, failed: 0, retried: 0 };

  for (const row of (due ?? []) as any[]) {
    // Claim the row so overlapping cron ticks never double-post.
    const { data: claimed } = await admin
      .from("scheduled_actions")
      .update({ status: "running", attempts: (row.attempts ?? 0) + 1 })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const { data: account } = await admin
      .from("x_accounts")
      .select("id, handle, auth_token, proxy, suspended, is_active")
      .eq("id", row.account_id)
      .maybeSingle();

    let ok = false;
    let tweetId: string | null = null;
    let errorText: string | null = null;

    if (!account) {
      errorText = "The linked account no longer exists.";
    } else if (account.suspended) {
      errorText = "Account is suspended on X - action skipped.";
      await cancelQueuedFor(admin, account.id, "Account suspended on X.");
    } else if (!account.is_active) {
      errorText = "Account is switched off - action skipped.";
    } else {
      const posting: PostingAccount = {
        id: account.id,
        handle: account.handle,
        loginCookies: account.auth_token ?? null,
        proxy: account.proxy ?? null,
      };
      try {
        const res = await performAction(row, posting);
        ok = res.ok;
        tweetId = res.tweetId ?? null;
        errorText = res.error ?? null;
      } catch (e) {
        errorText = (e as Error).message;
      }

      if (!ok && looksSuspended(errorText)) {
        await admin.from("x_accounts").update({ suspended: true }).eq("id", account.id);
        await cancelQueuedFor(admin, account.id, "Account suspended on X.");
      } else if (!ok && isAccountChallengeError(errorText)) {
        // Stop rather than repeatedly testing a challenged account. An admin
        // must verify/reactivate it before it can be selected again.
        await admin.from("x_accounts").update({ is_active: false }).eq("id", account.id);
        await cancelQueuedFor(
          admin,
          account.id,
          "Account requires verification on X before further campaign activity.",
        );
      } else if (!ok && isRateLimitOrCapacityError(errorText)) {
        await deferAccountQueue(admin, account.id, 60);
      }
    }

    const attempts = (row.attempts ?? 0) + 1;
    const challenged = isAccountChallengeError(errorText);
    const capacity = isRateLimitOrCapacityError(errorText);

    // The action itself is fine - only the persona's account cannot act. Hand
    // the work to another healthy persona so the campaign still goes out.
    const accountUnusable =
      !ok &&
      (!account ||
        looksSuspended(errorText) ||
        challenged ||
        account.suspended ||
        !account.is_active);
    if (accountUnusable) {
      const movedTo = await reassignToHealthyAccount(
        admin,
        row,
        errorText ?? "Account could not act on X.",
      );
      if (movedTo) {
        summary.retried += 1;
        await sleep(500);
        continue;
      }
    }

    const retry =
      !ok && Boolean(account) && attempts < MAX_ATTEMPTS && !isPermanent(errorText) && !challenged;
    const delay = capacity
      ? 60 * 60 * 1000
      : (RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)] ?? 10 * 60 * 1000);

    await admin
      .from("scheduled_actions")
      .update({
        status: ok ? "success" : retry ? "pending" : "failed",
        result_tweet_id: tweetId,
        error: retry
          ? `${errorText ?? "Action failed"} - retrying (attempt ${attempts})`
          : errorText,
        ...(retry ? { run_at: new Date(Date.now() + delay).toISOString() } : {}),
      })
      .eq("id", row.id);

    if (retry) {
      summary.retried += 1;
    } else {
      await mirrorResult(admin, row, ok, tweetId, errorText);
      if (ok) summary.succeeded += 1;
      else summary.failed += 1;
    }

    // Small fixed delay protects the upstream API and avoids local request bursts.
    await sleep(1000);
  }

  return summary;
}
