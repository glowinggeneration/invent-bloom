import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INTERNAL_ACCOUNT_BUDGETS,
  firstBlockingMessage,
  reviewBatch,
  type ComplianceCandidate,
  type CompliancePolicyOptions,
  type XCampaignAction,
} from "./x-compliance";

export type CompliancePlanRow<T> = {
  row: T;
  runAt: string;
};

type Admin = SupabaseClient<any, any, any>;

type RecentAction = {
  account_id: string;
  action_type: XCampaignAction;
  status: string;
  run_at: string;
  target_tweet_id: string | null;
  content: string | null;
};

function maxDate(a: number, b: number) {
  return Number.isFinite(a) ? Math.max(a, b) : b;
}

/**
 * Reviews a proposed batch against anti-spam safeguards and the account's own
 * recent activity, then pushes execution times forward where a cooldown is
 * needed. It never randomises timing to mimic a person.
 */
export async function planCompliantSchedule<T extends ComplianceCandidate & { runAt: string }>(
  admin: Admin,
  candidates: T[],
  options: CompliancePolicyOptions = {},
): Promise<CompliancePlanRow<T>[]> {
  if (!candidates.length) return [];

  const batchIssues = reviewBatch(candidates, options);
  const batchBlock = firstBlockingMessage(batchIssues);
  if (batchBlock) throw new Error(`Campaign policy check failed. ${batchBlock}`);

  const accountIds = [...new Set(candidates.map((c) => c.accountId))];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("scheduled_actions")
    .select("account_id, action_type, status, run_at, target_tweet_id, content")
    .in("account_id", accountIds)
    .gte("run_at", since)
    .in("status", ["pending", "running", "success"])
    .order("run_at", { ascending: true });
  if (error) throw new Error(error.message);

  const recent = (data ?? []) as RecentAction[];

  // Existing cross-account targeting is also considered. This prevents two
  // campaigns launched separately from coordinating on the same X post.
  const targetIds = [
    ...new Set(candidates.map((c) => c.targetTweetId).filter(Boolean)),
  ] as string[];
  if (targetIds.length && !options.allowMultiAccountTarget) {
    const { data: collisions, error: collisionError } = await admin
      .from("scheduled_actions")
      .select("account_id, action_type, target_tweet_id, status")
      .in("target_tweet_id", targetIds)
      .in("status", ["pending", "running", "success"])
      .gte("run_at", since);
    if (collisionError) throw new Error(collisionError.message);
    for (const candidate of candidates) {
      if (
        !candidate.targetTweetId ||
        candidate.actionType === "tweet" ||
        candidate.actionType === "follow"
      )
        continue;
      const other = (collisions ?? []).find(
        (row: any) =>
          row.target_tweet_id === candidate.targetTweetId && row.account_id !== candidate.accountId,
      );
      if (other) {
        throw new Error(
          "Campaign policy check failed. Another linked account has already acted on or is queued against this X post. Use the existing account for that conversation rather than coordinating several linked accounts on the same target.",
        );
      }
    }
  }

  const countByAccountKind = new Map<string, number>();
  const lastByAccount = new Map<string, number>();
  for (const row of recent) {
    const key = `${row.account_id}:${row.action_type}`;
    countByAccountKind.set(key, (countByAccountKind.get(key) ?? 0) + 1);
    const at = new Date(row.run_at).getTime();
    if (Number.isFinite(at))
      lastByAccount.set(row.account_id, maxDate(lastByAccount.get(row.account_id) ?? 0, at));
  }

  const planned: CompliancePlanRow<T>[] = [];
  const plannedCount = new Map<string, number>();
  const cursorByAccount = new Map(lastByAccount);

  for (const candidate of candidates) {
    if (candidate.actionType === "follow") {
      throw new Error("Campaign policy check failed. Automated proactive following is disabled.");
    }

    const budget = INTERNAL_ACCOUNT_BUDGETS[candidate.actionType];
    const countKey = `${candidate.accountId}:${candidate.actionType}`;
    const already = countByAccountKind.get(countKey) ?? 0;
    const inBatch = plannedCount.get(countKey) ?? 0;
    if (already + inBatch >= budget.rolling24h) {
      throw new Error(
        `Campaign policy check failed for @${candidate.handle}. This account has reached the platform's conservative internal 24-hour ${candidate.actionType} budget. Reduce the batch or use a later campaign window.`,
      );
    }

    let runAt = new Date(candidate.runAt).getTime();
    if (!Number.isFinite(runAt)) runAt = Date.now();
    const prior = cursorByAccount.get(candidate.accountId) ?? 0;
    if (prior > 0) runAt = Math.max(runAt, prior + budget.minGapMinutes * 60 * 1000);

    planned.push({ row: candidate, runAt: new Date(runAt).toISOString() });
    cursorByAccount.set(candidate.accountId, runAt);
    plannedCount.set(countKey, inBatch + 1);
  }

  return planned;
}

export function isRateLimitOrCapacityError(error: string | null | undefined) {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("rate limit") ||
    value.includes("too many requests") ||
    value.includes("429") ||
    value.includes("capacity")
  );
}

export function isAccountChallengeError(error: string | null | undefined) {
  const value = (error ?? "").toLowerCase();
  return (
    value.includes("account is locked") ||
    value.includes("account locked") ||
    value.includes("temporarily locked") ||
    value.includes("missing twitterusernotsuspended") ||
    value.includes("challenge") ||
    value.includes("verify your") ||
    value.includes("verification required")
  );
}

type AccountHealthActionType = Exclude<XCampaignAction, "follow">;

export type AccountHealthActionStatus = {
  actionType: AccountHealthActionType;
  budget: number;
  minGapMinutes: number;
  usedToday: number;
  remaining: number;
  /** ISO timestamp of when the next action of this type is allowed, or null when one can run now. */
  nextAvailableAt: string | null;
};

export type AccountHealthResult = {
  accountId: string;
  handle: string;
  suspended: boolean;
  isActive: boolean;
  hasSession: boolean;
  actions: AccountHealthActionStatus[];
  /** False when this account cannot safely take part in the requested actions right now. */
  healthy: boolean;
  /** Short human-readable reason when `healthy` is false. */
  reason: string | null;
};

type XAccountRow = {
  id: string;
  handle: string;
  is_active: boolean | null;
  suspended: boolean | null;
  auth_token: string | null;
};

/**
 * Proactive, read-only account-health preflight used by the campaign
 * planner UIs. It mirrors the same rolling-24h budgets and minimum-gap rules
 * `planCompliantSchedule` enforces server-side at enqueue time, so the
 * operator can see "this account only has 2 of its 8 daily tweets left"
 * before they submit rather than getting a thrown error afterward.
 *
 * This is a UI convenience only: `planCompliantSchedule` remains the final
 * source of truth and still hard-stops an over-budget batch even if this
 * check was skipped, stale, or bypassed.
 */
export async function checkAccountHealth(
  supabase: Admin,
  { accountIds, actionTypes }: { accountIds: string[]; actionTypes: AccountHealthActionType[] },
): Promise<AccountHealthResult[]> {
  const ids = [...new Set(accountIds)].filter(Boolean);
  const types = [...new Set(actionTypes)];
  if (!ids.length || !types.length) return [];

  const { data: accountRows, error: accountsError } = await supabase
    .from("x_accounts")
    .select("id, handle, is_active, suspended, auth_token")
    .in("id", ids);
  if (accountsError) throw new Error(accountsError.message);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRows, error: recentError } = await supabase
    .from("scheduled_actions")
    .select("account_id, action_type, status, run_at")
    .in("account_id", ids)
    .in("action_type", types)
    .gte("run_at", since)
    .in("status", ["pending", "running", "success"]);
  if (recentError) throw new Error(recentError.message);

  const recent = (recentRows ?? []) as {
    account_id: string;
    action_type: string;
    status: string;
    run_at: string;
  }[];

  const now = Date.now();
  const results: AccountHealthResult[] = [];

  for (const accountId of ids) {
    const account = (accountRows ?? []).find((r: XAccountRow) => r.id === accountId) as
      XAccountRow | undefined;

    const handle = account?.handle ?? "";
    const suspended = Boolean(account?.suspended);
    const isActive = account ? account.is_active !== false : false;
    const hasSession = Boolean(account?.auth_token);

    const actions: AccountHealthActionStatus[] = types.map((actionType) => {
      const budget = INTERNAL_ACCOUNT_BUDGETS[actionType];
      const rowsForAction = recent.filter(
        (r) => r.account_id === accountId && r.action_type === actionType,
      );
      const usedToday = rowsForAction.length;
      const remaining = Math.max(0, budget.rolling24h - usedToday);

      let lastAt = 0;
      for (const row of rowsForAction) {
        const at = new Date(row.run_at).getTime();
        if (Number.isFinite(at) && at > lastAt) lastAt = at;
      }
      const gapMs = budget.minGapMinutes * 60 * 1000;
      const nextAvailableAt =
        lastAt > 0 && lastAt + gapMs > now ? new Date(lastAt + gapMs).toISOString() : null;

      return {
        actionType,
        budget: budget.rolling24h,
        minGapMinutes: budget.minGapMinutes,
        usedToday,
        remaining,
        nextAvailableAt,
      };
    });

    let reason: string | null = null;
    if (!account) reason = "Account not found";
    else if (suspended) reason = "Suspended";
    else if (!isActive) reason = "Inactive";
    else if (!hasSession) reason = "No active session";
    else {
      const exhausted = actions.find((a) => a.remaining <= 0);
      if (exhausted) {
        reason = `Daily ${exhausted.actionType} limit reached (${exhausted.usedToday}/${exhausted.budget})`;
      }
    }

    results.push({
      accountId,
      handle,
      suspended,
      isActive,
      hasSession,
      actions,
      healthy: reason === null,
      reason,
    });
  }

  return results;
}

/**
 * Respect an X capacity/rate response by deferring the account's remaining
 * queue. This is reliability backoff, not an attempt to route around limits.
 */
export async function deferAccountQueue(admin: Admin, accountId: string, minutes = 60) {
  const resumeAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  await admin
    .from("scheduled_actions")
    .update({
      run_at: resumeAt,
      error: `Deferred after X capacity/rate response until ${resumeAt}`,
    })
    .eq("account_id", accountId)
    .eq("status", "pending");
}
