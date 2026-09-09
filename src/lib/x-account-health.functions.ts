import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INTERNAL_ACCOUNT_BUDGETS, type XCampaignAction } from "./x-compliance";
import { resolveWorkspaceId } from "./workspace.server";

export type XAccountHealthRow = {
  id: string;
  handle: string;
  displayName: string;
  state: "ready" | "watch" | "held" | "suspended";
  score: number;
  isActive: boolean;
  hasToken: boolean;
  suspended: boolean;
  lastActionAt: string | null;
  pending: number;
  failed24h: number;
  actions24h: Record<Exclude<XCampaignAction, "follow">, number>;
  utilisation: Record<"tweet" | "comment" | "retweet", number>;
  reasons: string[];
  lastError: string | null;
};

function pct(count: number, max: number) {
  return Math.min(100, Math.round((count / Math.max(1, max)) * 100));
}

export const getXAccountHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ generatedAt: string; rows: XAccountHealthRow[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const workspaceId = await resolveWorkspaceId(context);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: accounts, error: accountError }, { data: actions, error: actionError }] =
      await Promise.all([
        db
          .from("x_accounts")
          .select("id, handle, display_name, is_active, suspended, auth_token")
          .eq("workspace_id", workspaceId)
          .order("handle"),
        db
          .from("scheduled_actions")
          .select("account_id, action_type, status, run_at, error")
          .eq("workspace_id", workspaceId)
          .gte("run_at", since)
          .order("run_at", { ascending: false })
          .limit(10000),
      ]);
    if (accountError) throw new Error(accountError.message);
    if (actionError) throw new Error(actionError.message);

    const byAccount = new Map<string, any[]>();
    for (const action of actions ?? []) {
      const list = byAccount.get(action.account_id) ?? [];
      list.push(action);
      byAccount.set(action.account_id, list);
    }

    const rows: XAccountHealthRow[] = (accounts ?? []).map((account: any) => {
      const history = byAccount.get(account.id) ?? [];
      const counts = {
        tweet: 0,
        comment: 0,
        like: 0,
        retweet: 0,
        bookmark: 0,
      } satisfies Record<Exclude<XCampaignAction, "follow">, number>;
      let pending = 0;
      let failed24h = 0;
      let lastActionAt: string | null = null;
      let lastError: string | null = null;

      for (const action of history) {
        if (
          action.action_type in counts &&
          ["pending", "running", "success"].includes(action.status)
        ) {
          counts[action.action_type as keyof typeof counts] += 1;
        }
        if (action.status === "pending" || action.status === "running") pending += 1;
        if (action.status === "failed") {
          failed24h += 1;
          if (!lastError && action.error) lastError = String(action.error);
        }
        if (!lastActionAt || String(action.run_at) > lastActionAt)
          lastActionAt = String(action.run_at);
      }

      const utilisation = {
        tweet: pct(counts.tweet, INTERNAL_ACCOUNT_BUDGETS.tweet.rolling24h),
        comment: pct(counts.comment, INTERNAL_ACCOUNT_BUDGETS.comment.rolling24h),
        retweet: pct(counts.retweet, INTERNAL_ACCOUNT_BUDGETS.retweet.rolling24h),
      };
      const peak = Math.max(utilisation.tweet, utilisation.comment, utilisation.retweet);
      const hasToken = Boolean(account.auth_token);
      const reasons: string[] = [];
      let score = 100;

      if (account.suspended) {
        score = 0;
        reasons.push("Suspended on X");
      } else {
        if (!account.is_active) {
          score -= 60;
          reasons.push("Account is switched off or awaiting verification");
        }
        if (!hasToken) {
          score -= 60;
          reasons.push("No valid linked session");
        }
        if (peak >= 90) {
          score -= 35;
          reasons.push("Close to an internal 24-hour activity budget");
        } else if (peak >= 70) {
          score -= 20;
          reasons.push("Recent activity is elevated for this account");
        } else if (peak >= 50) {
          score -= 10;
          reasons.push("Recent activity is moderate");
        }
        if (pending >= 15) {
          score -= 15;
          reasons.push(`${pending} actions already queued`);
        } else if (pending >= 5) {
          score -= 5;
          reasons.push(`${pending} actions already queued`);
        }
        if (failed24h > 0) {
          score -= Math.min(30, failed24h * 8);
          reasons.push(
            `${failed24h} failed action${failed24h === 1 ? "" : "s"} in the last 24 hours`,
          );
        }
      }

      score = Math.max(0, Math.min(100, score));
      const state: XAccountHealthRow["state"] = account.suspended
        ? "suspended"
        : !account.is_active || !hasToken
          ? "held"
          : score < 70 || peak >= 70
            ? "watch"
            : "ready";

      if (!reasons.length)
        reasons.push("Account is within the platform's internal activity guardrails");

      return {
        id: account.id,
        handle: account.handle,
        displayName: account.display_name || account.handle,
        state,
        score,
        isActive: Boolean(account.is_active),
        hasToken,
        suspended: Boolean(account.suspended),
        lastActionAt,
        pending,
        failed24h,
        actions24h: counts,
        utilisation,
        reasons,
        lastError,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      rows: rows.sort((a, b) => b.score - a.score || a.handle.localeCompare(b.handle)),
    };
  });
