/**
 * Listening campaigns: find people talking about the campaign keywords and
 * hashtags, draft a persona-voiced reply grounded in the campaign core
 * message, run it through the legal engine, then reply from a linked account.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildSearchQuery,
  REPLY_LIMIT,
  type CampaignReply,
  type CampaignRunResult,
} from "./campaigns";
import { RISK_LEVEL_LABELS } from "./legal-risk";
import { runTimesFor } from "./spread";
import { logLegalReview, reviewTexts } from "./legal-risk.server";
import { personaForAccount } from "./always-on-planner.server";
import { PERSONA_ENGINE_DOCTRINE } from "./persona-engine";
import type { Persona } from "./personas";
import { searchTweets, type FoundTweet } from "./twitterapi.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

type Admin = SupabaseClient<any, any, any>;

function trim(text: string) {
  const clean = text
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > REPLY_LIMIT ? `${clean.slice(0, REPLY_LIMIT - 1).trimEnd()}…` : clean;
}

/** One AI call per run: a reply per matched conversation, in each persona's voice. */
async function draftReplies(input: {
  coreMessage: string;
  campaignName: string;
  items: { key: string; persona: Persona; tweet: FoundTweet }[];
}): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const key = process.env["LOVABLE_API_KEY"];
  if (!key || !input.items.length) return out;

  const system = [
    PERSONA_ENGINE_DOCTRINE,
    "",
    "You write short public replies on X for a listening campaign.",
    "Rules:",
    "- Reply in the assigned persona's own voice, register and vocabulary.",
    "- Respond to what the person actually said first; then land the campaign core message naturally.",
    "- Never insult, never accuse anyone of a crime, never make legal or financial claims.",
    `- Maximum ${REPLY_LIMIT} characters. No hashtags spam (at most one). No emojis unless the persona would use them.`,
    "- Never mention that this is a campaign, a bot, or AI.",
    'Return strict JSON: {"replies":[{"key":"...","text":"..."}]}',
  ].join("\n");

  const user = [
    `Campaign: ${input.campaignName}`,
    `Core message to land: ${input.coreMessage || "(none supplied - just reply helpfully in persona)"}`,
    "",
    "Conversations:",
    ...input.items.map((i) =>
      [
        `key: ${i.key}`,
        `persona: ${i.persona.name} - ${i.persona.role}, ${i.persona.location}. Vibe: ${i.persona.vibe}. ${i.persona.profile}`,
        `they said (@${i.tweet.authorHandle}): ${i.tweet.text}`,
        "",
      ].join("\n"),
    ),
  ].join("\n");

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return out;
    const json: any = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return out;
    const parsed = JSON.parse(match[0]);
    for (const r of parsed?.replies ?? []) {
      const k = String(r?.key ?? "");
      const text = trim(String(r?.text ?? ""));
      if (k && text) out.set(k, text);
    }
  } catch {
    /* fall back to no drafts */
  }
  return out;
}

/** Runs one campaign end to end and stores every reply attempt. */
export async function runCampaignOnce(input: {
  admin: Admin;
  userId: string;
  workspaceId: string;
  campaignId: string;
}): Promise<CampaignRunResult> {
  const { admin, userId, workspaceId, campaignId } = input;

  const { data: campaign, error } = await admin
    .from("listening_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!campaign) throw new Error("Campaign not found.");

  const empty = (note: string): CampaignRunResult => ({
    campaignId,
    found: 0,
    replied: 0,
    failed: 0,
    skipped: 0,
    note,
    replies: [],
  });

  const query = buildSearchQuery({
    keywords: campaign.keywords ?? [],
    hashtags: campaign.hashtags ?? [],
    language: campaign.language ?? "",
  });
  if (!query) return empty("Add at least one keyword or hashtag first.");

  // Linked accounts that will do the replying.
  let accountsQuery = admin
    .from("x_accounts")
    .select("id, handle, persona_label, auth_token, proxy, is_active")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .eq("suspended", false);
  const chosen: string[] = campaign.account_ids ?? [];
  if (chosen.length) accountsQuery = accountsQuery.in("id", chosen);
  const { data: accountRows, error: accErr } = await accountsQuery.order("handle");
  if (accErr) throw new Error(accErr.message);
  const accounts = accountRows ?? [];
  {
    const { recordSkippedAccounts } = await import("./skip-audit.server");
    await recordSkippedAccounts(
      admin,
      { userId, workspaceId, source: "reply", campaignId },
      chosen.length ? chosen : undefined,
    );
  }
  if (!accounts.length) return empty("No active linked accounts are available for this campaign.");

  const { tweets, error: searchError } = await searchTweets(
    query,
    campaign.max_replies_per_run * 3,
  );
  if (searchError && !tweets.length) return empty(`No conversations found - ${searchError}`);

  // Never reply twice to the same conversation.
  const { data: seenRows } = await admin
    .from("campaign_replies")
    .select("tweet_id")
    .eq("campaign_id", campaignId);
  const seen = new Set((seenRows ?? []).map((r: any) => String(r.tweet_id)));
  const ourHandles = new Set(accounts.map((a: any) => String(a.handle).toLowerCase()));

  const fresh = tweets
    .filter((t) => !seen.has(t.id) && !ourHandles.has(t.authorHandle.toLowerCase()))
    .slice(0, campaign.max_replies_per_run);
  if (!fresh.length) return empty("No new conversations since the last run.");

  const pairs = fresh.map((tweet, index) => {
    const account = accounts[index % accounts.length]!;
    return {
      key: `t${index}`,
      tweet,
      account,
      persona: personaForAccount({
        id: account.id,
        handle: account.handle,
        personaLabel: account.persona_label,
      }),
    };
  });

  const drafts = await draftReplies({
    campaignName: campaign.name,
    coreMessage: campaign.core_message ?? "",
    items: pairs.map((p) => ({ key: p.key, persona: p.persona, tweet: p.tweet })),
  });

  const legal = await reviewTexts(
    pairs
      .map((p) => ({ id: p.key, text: drafts.get(p.key) ?? "", personaVoice: p.persona.name }))
      .filter((i) => i.text.trim()),
  );

  const results: CampaignReply[] = [];
  const replied = 0;
  const failed = 0;
  let skipped = 0;

  // Human timing: when a spread is set, replies are queued across the window
  // instead of every account answering in the same minute.
  const spreadHours: number = campaign.spread_hours ?? 0;
  const runTimes = runTimesFor(pairs.length, spreadHours);
  let scheduled = 0;

  for (const [index, pair] of pairs.entries()) {
    const base = drafts.get(pair.key) ?? "";
    const record = legal.get(pair.key);
    const text = record ? trim(record.revisedText) : base;
    let status: CampaignReply["status"] = "pending";
    let errorText: string | null = null;

    if (record && record.riskLevel > 0) {
      void logLegalReview({
        record,
        surface: "campaign_reply",
        personaId: pair.persona.id,
        userId,
      });
    }

    if (!text) {
      status = "skipped";
      errorText = "No usable reply was drafted for this conversation.";
    } else if (record && (record.riskLevel >= 4 || !record.autoPublishAllowed)) {
      status = "skipped";
      errorText = `Held by legal review - ${RISK_LEVEL_LABELS[record.riskLevel]}.`;
    } else {
      const runAt = runTimes[index]!;
      const row = {
        campaign_id: campaignId,
        user_id: userId,
        workspace_id: workspaceId,
        account_id: pair.account.id,
        handle: pair.account.handle,
        persona_name: pair.persona.name,
        tweet_id: pair.tweet.id,
        tweet_url: pair.tweet.url,
        author_handle: pair.tweet.authorHandle,
        tweet_text: pair.tweet.text.slice(0, 1000),
        reply_text: text,
        status: "pending" as const,
        error: `Scheduled for ${new Date(runAt).toLocaleString()}`,
        result_tweet_id: null,
      };
      const { data: inserted } = await admin
        .from("campaign_replies")
        .insert(row)
        .select("id, created_at")
        .maybeSingle();

      const { enqueueScheduledActions } = await import("./scheduler.server");
      const queued: any[] = [
        {
          user_id: userId,
          workspace_id: workspaceId,
          source: "campaign",
          campaign_id: campaignId,
          campaign_reply_id: inserted?.id ?? null,
          account_id: pair.account.id,
          handle: pair.account.handle,
          persona_name: pair.persona.name,
          action_type: "comment",
          content: text,
          target_tweet_id: pair.tweet.id,
          run_at: runAt,
        },
      ];
      if (campaign.like_target) {
        queued.push({
          user_id: userId,
          workspace_id: workspaceId,
          source: "campaign",
          campaign_id: campaignId,
          account_id: pair.account.id,
          handle: pair.account.handle,
          persona_name: pair.persona.name,
          action_type: "like",
          target_tweet_id: pair.tweet.id,
          run_at: new Date(new Date(runAt).getTime() + 90_000).toISOString(),
        });
      }
      if (campaign.follow_author) {
        queued.push({
          user_id: userId,
          workspace_id: workspaceId,
          source: "campaign",
          campaign_id: campaignId,
          account_id: pair.account.id,
          handle: pair.account.handle,
          persona_name: pair.persona.name,
          action_type: "follow",
          target_handle: pair.tweet.authorHandle,
          run_at: new Date(new Date(runAt).getTime() + 180_000).toISOString(),
        });
      }
      await enqueueScheduledActions(admin, queued);

      scheduled += 1;
      results.push(
        toReplyView({
          ...row,
          id: inserted?.id ?? pair.tweet.id,
          created_at: inserted?.created_at ?? new Date().toISOString(),
        }),
      );
      continue;
    }

    skipped += 1;
    const row = {
      campaign_id: campaignId,
      user_id: userId,
      workspace_id: workspaceId,
      account_id: pair.account.id,
      handle: pair.account.handle,
      persona_name: pair.persona.name,
      tweet_id: pair.tweet.id,
      tweet_url: pair.tweet.url,
      author_handle: pair.tweet.authorHandle,
      tweet_text: pair.tweet.text.slice(0, 1000),
      reply_text: text,
      status,
      error: errorText,
      result_tweet_id: null,
    };
    const { data: inserted } = await admin
      .from("campaign_replies")
      .insert(row)
      .select("id, created_at")
      .maybeSingle();
    results.push(
      toReplyView({
        ...row,
        id: inserted?.id ?? pair.tweet.id,
        created_at: inserted?.created_at ?? new Date().toISOString(),
      }),
    );
  }

  await admin
    .from("listening_campaigns")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", campaignId);

  return {
    campaignId,
    found: fresh.length,
    replied,
    failed,
    skipped,
    // `replied`/`failed` stay 0 for every run: this function only schedules
    // future sends (via enqueueScheduledActions) or skips - it never sends
    // synchronously, so there is no immediate "replied"/"failed" outcome.
    note:
      scheduled > 0
        ? spreadHours > 0
          ? `Queued ${scheduled} repl${scheduled === 1 ? "y" : "ies"} across the next ${spreadHours}h.`
          : `Sending ${scheduled} repl${scheduled === 1 ? "y" : "ies"} now, paced a minute or two apart.`
        : "No replies were posted this run.",
    replies: results,
  };
}

export function toReplyView(row: any): CampaignReply {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    handle: row.handle ?? "",
    personaName: row.persona_name ?? "",
    tweetId: row.tweet_id,
    tweetUrl: row.tweet_url ?? null,
    authorHandle: row.author_handle ?? "",
    tweetText: row.tweet_text ?? "",
    replyText: row.reply_text ?? "",
    status: (row.status ?? "pending") as CampaignReply["status"],
    error: row.error ?? null,
    createdAt: row.created_at,
  };
}
