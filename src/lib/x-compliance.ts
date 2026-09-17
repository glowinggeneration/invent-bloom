/**
 * Compliance-aware campaign rules for X.
 *
 * These are conservative internal product safeguards, not estimates of X's
 * private detection thresholds. The objective is to prevent spammy or
 * coordinated patterns before they are queued, while preserving legitimate
 * publishing across authorised accounts with distinct purposes.
 */

export type XCampaignAction = "tweet" | "comment" | "like" | "retweet" | "bookmark" | "follow";

export type ComplianceCandidate = {
  accountId: string;
  handle: string;
  actionType: XCampaignAction;
  content?: string | null;
  targetTweetId?: string | null;
  targetHandle?: string | null;
};

export type ComplianceIssue = {
  code:
    | "AUTOMATED_FOLLOW"
    | "AUTOMATED_LIKE"
    | "AUTOMATED_BOOKMARK"
    | "TARGET_COLLISION"
    | "NEAR_DUPLICATE_CONTENT"
    | "EMPTY_REPLY"
    | "ACCOUNT_DAILY_BUDGET";
  message: string;
  accountIds: string[];
};

/**
 * Deliberately conservative internal budgets. They are not X-published safety
 * thresholds and must never be presented as a way to evade enforcement.
 */
export const INTERNAL_ACCOUNT_BUDGETS: Record<
  Exclude<XCampaignAction, "follow">,
  { rolling24h: number; minGapMinutes: number }
> = {
  tweet: { rolling24h: 8, minGapMinutes: 30 },
  comment: { rolling24h: 20, minGapMinutes: 10 },
  // These remain here for historical queue accounting; new automated Likes
  // and Bookmarks are blocked before scheduling.
  like: { rolling24h: 30, minGapMinutes: 5 },
  retweet: { rolling24h: 12, minGapMinutes: 10 },
  bookmark: { rolling24h: 30, minGapMinutes: 5 },
};

function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@[a-z0-9_]+/gi, " ")
    .replace(/#[a-z0-9_]+/gi, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shingles(text: string, width = 2) {
  const words = normalise(text).split(" ").filter(Boolean);
  if (words.length <= width) return new Set(words);
  const out = new Set<string>();
  for (let i = 0; i <= words.length - width; i += 1) out.add(words.slice(i, i + width).join(" "));
  return out;
}

/** Jaccard similarity over word pairs. Exact duplicates return 1. */
export function contentSimilarity(a: string, b: string) {
  const aa = shingles(a);
  const bb = shingles(b);
  if (!aa.size && !bb.size) return 1;
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection += 1;
  const union = aa.size + bb.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Per-campaign relaxations, set explicitly by the campaign type that needs
 * them. Defaults keep the conservative safeguards in place.
 */
export type CompliancePolicyOptions = {
  /** Boost campaigns deliberately perform Likes and Bookmarks. */
  allowAutomatedEngagement?: boolean;
  /** Reply and Boost campaigns may use several accounts on one post. */
  allowMultiAccountTarget?: boolean;
};

export function reviewBatch(
  candidates: ComplianceCandidate[],
  options: CompliancePolicyOptions = {},
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  const follows = candidates.filter((c) => c.actionType === "follow");
  if (follows.length) {
    issues.push({
      code: "AUTOMATED_FOLLOW",
      message:
        "Automated proactive following is disabled. Follow decisions must be made manually on X.",
      accountIds: [...new Set(follows.map((c) => c.accountId))],
    });
  }

  const likes = candidates.filter((c) => c.actionType === "like");
  if (likes.length && !options.allowAutomatedEngagement) {
    issues.push({
      code: "AUTOMATED_LIKE",
      message: "Automated Likes are disabled. X's automation rules do not permit automated liking.",
      accountIds: [...new Set(likes.map((c) => c.accountId))],
    });
  }

  const bookmarks = candidates.filter((c) => c.actionType === "bookmark");
  if (bookmarks.length && !options.allowAutomatedEngagement) {
    issues.push({
      code: "AUTOMATED_BOOKMARK",
      message:
        "Automated Bookmarks are disabled in campaign execution. Use the native X interface for individual bookmark actions.",
      accountIds: [...new Set(bookmarks.map((c) => c.accountId))],
    });
  }

  const emptyReplies = candidates.filter(
    (c) => c.actionType === "comment" && !(c.content ?? "").trim(),
  );
  if (emptyReplies.length) {
    issues.push({
      code: "EMPTY_REPLY",
      message: "Replies need relevant text before they can be queued.",
      accountIds: [...new Set(emptyReplies.map((c) => c.accountId))],
    });
  }

  // One linked account may act on a specific external post. A fleet may not
  // coordinate replies/reposts or other engagement against the same post.
  const byTarget = new Map<string, ComplianceCandidate[]>();
  for (const c of candidates) {
    if (!c.targetTweetId || c.actionType === "tweet" || c.actionType === "follow") continue;
    const list = byTarget.get(c.targetTweetId) ?? [];
    list.push(c);
    byTarget.set(c.targetTweetId, list);
  }
  for (const [target, rows] of byTarget) {
    const accounts = [...new Set(rows.map((r) => r.accountId))];
    if (accounts.length > 1 && !options.allowMultiAccountTarget) {
      issues.push({
        code: "TARGET_COLLISION",
        message: `Multiple linked accounts are targeting the same X post (${target}). Use one account for that post, or switch the campaign to distinct original posts for different audiences.`,
        accountIds: accounts,
      });
    }
  }

  // Block batches where different linked accounts are publishing materially
  // the same wording. This is intentionally stricter than exact deduplication.
  const textRows = candidates.filter(
    (c) =>
      (c.actionType === "tweet" || c.actionType === "comment") &&
      (c.content ?? "").trim().length > 0,
  );
  const duplicateAccounts = new Set<string>();
  for (let i = 0; i < textRows.length; i += 1) {
    for (let j = i + 1; j < textRows.length; j += 1) {
      const a = textRows[i]!;
      const b = textRows[j]!;
      if (a.accountId === b.accountId) continue;
      if (contentSimilarity(a.content ?? "", b.content ?? "") >= 0.72) {
        duplicateAccounts.add(a.accountId);
        duplicateAccounts.add(b.accountId);
      }
    }
  }
  if (duplicateAccounts.size) {
    issues.push({
      code: "NEAR_DUPLICATE_CONTENT",
      message:
        "Two or more linked accounts contain substantially similar wording. Rewrite them with genuinely different information, angles or audience value before launch.",
      accountIds: [...duplicateAccounts],
    });
  }

  return issues;
}

export function firstBlockingMessage(issues: ComplianceIssue[]) {
  if (!issues.length) return null;
  return issues.map((i) => i.message).join(" ");
}
