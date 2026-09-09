/**
 * Follow execution for the /campaign/follow module: a chosen subset of persona
 * accounts follows one or more handles, immediately or across a spread window.
 */
import { spreadTimes } from "./spread";

type Row = { id: string; handle: string; auth_token: string | null; proxy: string | null };

export function normalizeHandles(raw: string[]): string[] {
  return [
    ...new Set(
      raw
        .map((h) => h.trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, ""))
        .map((h) => h.replace(/^@/, "").split(/[/?#]/)[0] ?? "")
        .map((h) => h.trim())
        .filter((h) => /^[A-Za-z0-9_]{1,15}$/.test(h)),
    ),
  ];
}

async function loadSelected(
  admin: any,
  userId: string,
  workspaceId: string,
  accountIds: string[],
): Promise<Row[]> {
  // Audit the accounts this run cannot use (suspended, off, or no session).
  const { recordSkippedAccounts } = await import("./skip-audit.server");
  await recordSkippedAccounts(admin, { userId, workspaceId, source: "follow" }, accountIds);

  const { data, error } = await admin
    .from("x_accounts")
    .select("id, handle, auth_token, proxy")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .eq("suspended", false)
    .in("id", accountIds)
    .order("handle");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).filter((a) => Boolean(a.auth_token));
}

/** Immediate run: each selected persona follows each target handle. */
export async function followHandlesWithAccounts(
  userId: string,
  workspaceId: string,
  handles: string[],
  accountIds: string[],
  name = "",
): Promise<{
  jobId: string | null;
  accounts: number;
  targets: number;
  ok: number;
  failed: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const twitter = await import("./twitterapi.server");
  const admin = supabaseAdmin as any;

  const targets = normalizeHandles(handles);
  if (targets.length === 0) throw new Error("Add at least one valid handle.");

  const accounts = await loadSelected(admin, userId, workspaceId, accountIds);
  if (accounts.length === 0) throw new Error("No selected personas have a saved session.");

  const { data: job } = await admin
    .from("publish_jobs")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      mode: "engagement",
      tweet_text: "",
      comment_text: "",
      target_tweet_url: `https://x.com/${targets[0]}`,
      status: "running",
      engagement_actions: { follow: true },
      ...(name.trim() ? { name: name.trim(), name_is_custom: true } : {}),
    })
    .select("id")
    .single();

  let ok = 0;
  let failed = 0;
  for (const acc of accounts) {
    const posting = {
      id: acc.id,
      handle: acc.handle,
      loginCookies: acc.auth_token,
      proxy: acc.proxy,
    };
    for (const target of targets) {
      let res: { ok: boolean; tweetId: string | null; error?: string | null };
      try {
        res = await twitter.followUser(posting as never, target);
      } catch (e) {
        res = { ok: false, tweetId: null, error: (e as Error).message };
      }
      if (res.ok) ok += 1;
      else failed += 1;
      if (job?.id) {
        await admin.from("publish_actions").insert({
          job_id: job.id,
          user_id: userId,
          workspace_id: workspaceId,
          account_id: acc.id,
          action_type: "follow",
          content: `@${target}`,
          status: res.ok ? "success" : "failed",
          error: res.error ?? null,
        });
      }
      await twitter.sleep(500 + Math.floor(Math.random() * 800));
    }
  }

  if (job?.id) {
    await admin
      .from("publish_jobs")
      .update({ status: failed === 0 ? "completed" : ok === 0 ? "failed" : "partial" })
      .eq("id", job.id);
  }

  return { jobId: job?.id ?? null, accounts: accounts.length, targets: targets.length, ok, failed };
}

/** Queue the same follows with human-like timing. */
export async function scheduleFollowActions(
  userId: string,
  workspaceId: string,
  input: {
    handles: string[];
    accountIds: string[];
    spreadHours: number;
    delaySeconds: number;
    smartDelay: boolean;
    name?: string;
  },
): Promise<{ scheduled: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { enqueueScheduledActions } = await import("./scheduler.server");
  const admin = supabaseAdmin as any;

  const targets = normalizeHandles(input.handles);
  if (targets.length === 0) throw new Error("Add at least one valid handle.");

  const accounts = await loadSelected(admin, userId, workspaceId, input.accountIds);
  if (accounts.length === 0) throw new Error("No selected personas have a saved session.");

  const units: { accountId: string; handle: string; target: string }[] = [];
  for (const target of targets) {
    for (const acc of accounts) units.push({ accountId: acc.id, handle: acc.handle, target });
  }

  const now = Date.now();
  const times =
    input.spreadHours > 0
      ? spreadTimes(units.length, input.spreadHours, now)
      : units.map((_, i) => {
          const gap = input.delaySeconds * 1000 * i;
          const jitter = input.smartDelay ? Math.random() * input.delaySeconds * 400 : 0;
          return new Date(now + gap + jitter).toISOString();
        });

  const { data: job } = await admin
    .from("publish_jobs")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      mode: "engagement",
      tweet_text: "",
      comment_text: "",
      target_tweet_url: `https://x.com/${targets[0]}`,
      status: "scheduled",
      engagement_actions: { follow: true },
      ...(input.name?.trim() ? { name: input.name.trim(), name_is_custom: true } : {}),
    })
    .select("id")
    .single();

  const rows = units.map((u, i) => ({
    user_id: userId,
    workspace_id: workspaceId,
    source: "queue" as const,
    ...(job?.id ? { job_id: job.id as string } : {}),
    account_id: u.accountId,
    handle: u.handle,
    action_type: "follow" as const,
    target_handle: u.target,
    content: `@${u.target}`,
    run_at: times[i]!,
  }));
  await enqueueScheduledActions(admin, rows);
  return { scheduled: rows.length };
}
