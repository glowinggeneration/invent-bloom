/**
 * Engagement execution for the /campaign/engage module.
 * Like / repost / bookmark a set of tweet links with a chosen subset of
 * persona accounts - immediately, or queued across a spread window.
 */
import { spreadTimes } from "./spread";

export type EngageActions = { like: boolean; retweet: boolean; bookmark: boolean };

type Row = { id: string; handle: string; auth_token: string | null; proxy: string | null };

async function loadSelected(
  admin: any,
  userId: string,
  workspaceId: string,
  accountIds: string[],
): Promise<Row[]> {
  // Audit the accounts this run cannot use (suspended, off, or no session).
  const { recordSkippedAccounts } = await import("./skip-audit.server");
  await recordSkippedAccounts(admin, { userId, workspaceId, source: "engage" }, accountIds);

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

function enabledKinds(actions: EngageActions) {
  return (["like", "retweet", "bookmark"] as const).filter((k) => actions[k]);
}

/** Immediate run: every selected persona performs the chosen actions on each link. */
export async function engageLinksWithAccounts(
  userId: string,
  workspaceId: string,
  tweetUrls: string[],
  accountIds: string[],
  actions: EngageActions,
  name = "",
): Promise<{ jobId: string | null; accounts: number; links: number; ok: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const twitter = await import("./twitterapi.server");
  const admin = supabaseAdmin as any;

  const kinds = enabledKinds(actions);
  if (kinds.length === 0) throw new Error("Choose at least one action.");

  const links = tweetUrls
    .map((url) => ({ url, tweetId: twitter.extractTweetId(url) }))
    .filter((l): l is { url: string; tweetId: string } => Boolean(l.tweetId));
  if (links.length === 0) throw new Error("Could not read a tweet ID from those links.");

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
      target_tweet_url: links[0]!.url,
      status: "running",
      engagement_actions: actions,
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
    for (const link of links) {
      for (const kind of kinds) {
        const attempt = async () => {
          try {
            return kind === "like"
              ? await twitter.likeTweet(posting as never, link.tweetId)
              : kind === "retweet"
                ? await twitter.retweetTweet(posting as never, link.tweetId)
                : await twitter.bookmarkTweet(posting as never, link.tweetId);
          } catch (e) {
            return { ok: false, tweetId: null, error: (e as Error).message };
          }
        };
        let res = await attempt();
        if (!res.ok) {
          await twitter.sleep(700 + Math.floor(Math.random() * 600));
          res = await attempt();
        }
        if (res.ok) ok += 1;
        else failed += 1;
        if (job?.id) {
          await admin.from("publish_actions").insert({
            job_id: job.id,
            user_id: userId,
            workspace_id: workspaceId,
            account_id: acc.id,
            action_type: kind,
            content: link.url,
            status: res.ok ? "success" : "failed",
            result_tweet_id: res.tweetId,
            error: res.error,
          });
        }
      }
      await twitter.sleep(400 + Math.floor(Math.random() * 700));
    }
  }

  if (job?.id) {
    await admin
      .from("publish_jobs")
      .update({ status: failed === 0 ? "completed" : ok === 0 ? "failed" : "partial" })
      .eq("id", job.id);
  }

  return { jobId: job?.id ?? null, accounts: accounts.length, links: links.length, ok, failed };
}

/** Queue the same work with human-like timing instead of running it now. */
export async function scheduleEngageActions(
  userId: string,
  workspaceId: string,
  input: {
    tweetUrls: string[];
    accountIds: string[];
    actions: EngageActions;
    spreadHours: number;
    delaySeconds: number;
    smartDelay: boolean;
    name?: string;
  },
): Promise<{ scheduled: number; jobId: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const twitter = await import("./twitterapi.server");
  const { enqueueScheduledActions } = await import("./scheduler.server");
  const admin = supabaseAdmin as any;

  const kinds = enabledKinds(input.actions);
  if (kinds.length === 0) throw new Error("Choose at least one action.");

  const tweetIds = input.tweetUrls
    .map((url) => twitter.extractTweetId(url))
    .filter((id): id is string => Boolean(id));
  if (tweetIds.length === 0) throw new Error("Could not read a tweet ID from those links.");

  const accounts = await loadSelected(admin, userId, workspaceId, input.accountIds);
  if (accounts.length === 0) throw new Error("No selected personas have a saved session.");

  const units: { accountId: string; handle: string; kind: string; tweetId: string }[] = [];
  for (const tweetId of tweetIds) {
    for (const acc of accounts) {
      for (const kind of kinds)
        units.push({ accountId: acc.id, handle: acc.handle, kind, tweetId });
    }
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

  // A job row keeps the queued work visible (and named) in Campaign manager.
  const { data: job } = await admin
    .from("publish_jobs")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      mode: "engagement",
      tweet_text: "",
      comment_text: "",
      target_tweet_url: input.tweetUrls[0] ?? null,
      status: "scheduled",
      engagement_actions: input.actions,
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
    action_type: u.kind as "like" | "retweet" | "bookmark",
    target_tweet_id: u.tweetId,
    run_at: times[i]!,
  }));
  // Boost campaigns are explicitly configured to perform Likes, Reposts and
  // Bookmarks, and to amplify one post from several linked accounts, so the
  // queued path applies the same allowances as the immediate path.
  await enqueueScheduledActions(admin, rows, {
    allowAutomatedEngagement: true,
    allowMultiAccountTarget: true,
  });
  return { scheduled: rows.length, jobId: (job?.id as string) ?? null };
}
