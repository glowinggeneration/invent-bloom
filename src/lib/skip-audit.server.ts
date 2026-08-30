/**
 * Server-only: campaign skip audit.
 *
 * Every campaign execution filters out accounts that cannot act (suspended by
 * X, switched off in the workspace, or missing a session). This records which
 * ones were dropped and why, so a run can always be explained afterwards.
 */

export type SkipSource =
  | "reply"
  | "engage"
  | "intercept"
  | "like"
  | "follow"
  | "post"
  | "auto"
  | "publish"
  | "scheduler"
  | "always-on";

export type SkipReason = "suspended" | "inactive" | "no_session";

type Ctx = {
  userId: string;
  source: SkipSource;
  campaignId?: string | null;
  jobId?: string | null;
  runRef?: string;
};

type Candidate = {
  id: string;
  handle: string | null;
  persona_label: string | null;
  display_name: string | null;
  is_active: boolean | null;
  suspended: boolean | null;
  auth_token: string | null;
};

const REASON_DETAIL: Record<SkipReason, string> = {
  suspended: "Account is flagged as suspended on X - it cannot post or engage.",
  inactive: "Account is switched off in the workspace.",
  no_session: "Account has no stored X session, so it cannot act.",
};

function reasonFor(row: Candidate): SkipReason | null {
  if (row.suspended) return "suspended";
  if (row.is_active === false) return "inactive";
  if (!row.auth_token) return "no_session";
  return null;
}

/**
 * Inspect the accounts a run asked for and log the ones that were skipped.
 * Never throws - auditing must not break a campaign run.
 *
 * @param accountIds the ids the run selected; omit to audit every account.
 * @returns the eligible / skipped counts for the run summary.
 */
export async function recordSkippedAccounts(
  admin: any,
  ctx: Ctx,
  accountIds?: string[],
): Promise<{ eligible: number; skipped: number; bySuspension: number }> {
  try {
    let query = admin
      .from("x_accounts")
      .select("id, handle, persona_label, display_name, is_active, suspended, auth_token");
    if (accountIds && accountIds.length) query = query.in("id", accountIds);
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Candidate[];
    const skipped = rows
      .map((row) => ({ row, reason: reasonFor(row) }))
      .filter((entry): entry is { row: Candidate; reason: SkipReason } => entry.reason !== null);

    if (skipped.length) {
      await admin.from("campaign_skip_audit").insert(
        skipped.map(({ row, reason }) => ({
          user_id: ctx.userId,
          source: ctx.source,
          campaign_id: ctx.campaignId ?? null,
          job_id: ctx.jobId ?? null,
          run_ref: ctx.runRef ?? "",
          account_id: row.id,
          handle: row.handle ?? "",
          persona_name: row.display_name || row.persona_label || "",
          reason,
          detail: REASON_DETAIL[reason],
        })),
      );
    }

    return {
      eligible: rows.length - skipped.length,
      skipped: skipped.length,
      bySuspension: skipped.filter((s) => s.reason === "suspended").length,
    };
  } catch {
    return { eligible: 0, skipped: 0, bySuspension: 0 };
  }
}
