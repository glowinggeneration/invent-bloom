/**
 * The reporting engine.
 *
 * One entry point — `generateReport` — builds a period record from what the
 * platform actually stored: collected mentions (X + Apify) for organic
 * conversation, and campaign execution rows for platform activity. The two are
 * kept separately measurable and never merged.
 *
 * If a single source fails the report is still written and marked `partial`.
 */
import {
  dayBounds,
  emptySentiment,
  formatReportDate,
  reportDateKey,
  sentimentOf,
  type CampaignRun,
  type PersonaActivityRow,
  type ReportCampaigns,
  type ReportConversation,
  type ReportInsight,
  type ReportKind,
  type ReportMetrics,
  type ReportPersonas,
  type ReportPost,
  type ReportRecommendation,
  type ReportRecord,
  type ReportStatus,
  type ReportTopic,
} from "./reports";
import { classifyEntities } from "./apify-sources";

type MentionItem = {
  at: number | null;
  platform: string;
  sentiment: "positive" | "neutral" | "negative";
  authorName: string;
  authorHandle: string;
  title: string;
  content: string;
  url: string;
  entity: string;
  topics: string[];
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagements: number;
  matchedKeyword: string;
  collectedAt: string | null;
  federation: boolean;
  president: boolean;
};

const PRESIDENT = /hussein|husseinmoha|president/i;
const FEDERATION = /\bfkf\b|football[_ ]?kenya|federation|harambee|fkfpl/i;

/** Drops NULs and orphaned surrogate halves left behind by truncation. */
function sanitizeText(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/\u0000/g, "")
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
      .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "$1")
  );
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function sent(value: unknown): "positive" | "neutral" | "negative" {
  return value === "positive" || value === "negative" ? value : "neutral";
}

/** Every mention stored for the window, from both collectors, in one shape. */
export async function loadMentions(
  admin: any,
  fromISO: string,
  toISO: string,
  errors: string[],
): Promise<MentionItem[]> {
  const items: MentionItem[] = [];

  try {
    const { data, error } = await admin
      .from("x_mentions")
      .select(
        "tweet_id, text, author_handle, author_name, url, posted_at, like_count, view_count, sentiment, matched_keyword, collected_at, mentions_federation, mentions_president",
      )
      .gte("posted_at", fromISO)
      .lt("posted_at", toISO)
      .order("posted_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Record<string, any>[]) {
      const text = String(r["text"] ?? "");
      const at = r["posted_at"] ? new Date(r["posted_at"]).getTime() : null;
      const federation = Boolean(r["mentions_federation"]) || FEDERATION.test(text);
      const president = Boolean(r["mentions_president"]) || PRESIDENT.test(text);
      items.push({
        at: at && !Number.isNaN(at) ? at : null,
        platform: "X",
        sentiment: sent(r["sentiment"]),
        authorName: String(r["author_name"] ?? r["author_handle"] ?? ""),
        authorHandle: String(r["author_handle"] ?? ""),
        title: text.slice(0, 140),
        content: text,
        url: String(r["url"] ?? ""),
        entity: president ? "President" : federation ? "Federation" : "Kenyan football",
        topics: classifyEntities(text),
        views: num(r["view_count"]),
        likes: num(r["like_count"]),
        comments: 0,
        shares: 0,
        engagements: num(r["like_count"]),
        matchedKeyword: String(r["matched_keyword"] ?? ""),
        collectedAt: r["collected_at"] ?? null,
        federation,
        president,
      });
    }
  } catch (err) {
    errors.push(`X mentions: ${(err as Error).message}`);
  }

  try {
    const { data, error } = await admin
      .from("apify_mentions")
      .select(
        "platform, source_label, author_name, author_handle, title, content, url, published_at, views, likes, comments, shares, entities, matched_keywords, sentiment, collected_at",
      )
      .gte("published_at", fromISO)
      .lt("published_at", toISO)
      .order("published_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Record<string, any>[]) {
      const text = `${r["title"] ?? ""} ${r["content"] ?? ""}`.trim();
      const at = r["published_at"] ? new Date(r["published_at"]).getTime() : null;
      const entities: string[] = Array.isArray(r["entities"]) ? r["entities"].map(String) : [];
      const federation = FEDERATION.test(text);
      const president = PRESIDENT.test(text);
      const likes = num(r["likes"]);
      const comments = num(r["comments"]);
      const shares = num(r["shares"]);
      items.push({
        at: at && !Number.isNaN(at) ? at : null,
        platform: String(r["source_label"] ?? r["platform"] ?? "Social"),
        sentiment: sent(r["sentiment"]),
        authorName: String(r["author_name"] ?? r["author_handle"] ?? ""),
        authorHandle: String(r["author_handle"] ?? ""),
        title: String(r["title"] ?? text.slice(0, 140)),
        content: String(r["content"] ?? ""),
        url: String(r["url"] ?? ""),
        entity: president
          ? "President"
          : federation
            ? "Federation"
            : (entities[0] ?? "Kenyan football"),
        topics: entities.length ? entities : classifyEntities(text),
        views: num(r["views"]),
        likes,
        comments,
        shares,
        engagements: likes + comments + shares,
        matchedKeyword: Array.isArray(r["matched_keywords"])
          ? r["matched_keywords"].join(" | ")
          : "",
        collectedAt: r["collected_at"] ?? null,
        federation,
        president,
      });
    }
  } catch (err) {
    errors.push(`Social mentions: ${(err as Error).message}`);
  }

  return items.filter((i) => i.at !== null);
}

function countSentiment(items: MentionItem[]) {
  return sentimentOf({
    positive: items.filter((i) => i.sentiment === "positive").length,
    neutral: items.filter((i) => i.sentiment === "neutral").length,
    negative: items.filter((i) => i.sentiment === "negative").length,
  });
}

function topicRows(current: MentionItem[], previous: MentionItem[]): ReportTopic[] {
  const group = (list: MentionItem[]) => {
    const map = new Map<string, MentionItem[]>();
    for (const item of list) {
      for (const topic of item.topics) {
        const bucket = map.get(topic) ?? [];
        bucket.push(item);
        map.set(topic, bucket);
      }
    }
    return map;
  };
  const now = group(current);
  const before = group(previous);

  return [...now.entries()]
    .map(([topic, list]) => {
      const prev = before.get(topic)?.length ?? 0;
      const s = countSentiment(list);
      return {
        topic,
        volume: list.length,
        changePct: prev > 0 ? Math.round(((list.length - prev) / prev) * 100) : null,
        positivePct: s.positivePct,
        negativePct: s.negativePct,
      };
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 10);
}

function buildConversation(current: MentionItem[], previous: MentionItem[]): ReportConversation {
  const platformMap = new Map<string, MentionItem[]>();
  for (const item of current) {
    const list = platformMap.get(item.platform) ?? [];
    list.push(item);
    platformMap.set(item.platform, list);
  }
  const platforms = [...platformMap.entries()]
    .map(([platform, list]) => ({
      platform,
      count: list.length,
      sharePct: current.length ? Math.round((list.length / current.length) * 100) : 0,
      engagements: list.reduce((a, i) => a + i.engagements, 0),
      views: list.reduce((a, i) => a + i.views, 0),
    }))
    .sort((a, b) => b.count - a.count);

  const topics = topicRows(current, previous);
  const issues = topicRows(
    current.filter((i) => i.sentiment === "negative"),
    previous.filter((i) => i.sentiment === "negative"),
  )
    .filter((t) => t.volume >= 2)
    .slice(0, 4);

  const topPosts: ReportPost[] = [...current]
    .filter((i) => i.url)
    .sort((a, b) => b.engagements - a.engagements || b.views - a.views)
    .slice(0, 8)
    .map((i) => ({
      platform: i.platform,
      author: i.authorName || i.authorHandle,
      handle: i.authorHandle,
      title: (i.title || i.content).slice(0, 180),
      url: i.url,
      publishedAt: i.at ? new Date(i.at).toISOString() : null,
      engagements: i.engagements,
      views: i.views,
      sentiment: i.sentiment,
    }));

  const growing = [...topics]
    .filter((t) => t.changePct !== null && t.changePct > 0)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0];
  const engaged = [...platforms].sort((a, b) => b.engagements - a.engagements)[0];

  return {
    platforms,
    topics,
    topPosts,
    issues,
    mostDiscussed: topics[0]?.topic ?? null,
    fastestGrowing: growing?.topic ?? null,
    mostEngagedPlatform: engaged?.platform ?? null,
    federation: countSentiment(current.filter((i) => i.federation && !i.president)),
    president: countSentiment(current.filter((i) => i.president)),
  };
}

/* ------------------------------------------------------------------ */
/* Campaign execution                                                  */
/* ------------------------------------------------------------------ */

type ExecRow = {
  campaignKey: string;
  source: "publish" | "listen";
  campaignId: string;
  kind: string;
  status: string;
  accountId: string | null;
  handle: string;
  persona: string;
  target: string;
  at: string | null;
  result: string;
};

const KIND_LABEL: Record<string, string> = {
  tweet: "Post",
  comment: "Reply",
  like: "Like",
  retweet: "Repost",
  bookmark: "Bookmark",
  follow: "Follow",
};

/** Every persona action the platform executed inside the period. */
export async function loadExecutions(
  admin: any,
  fromISO: string,
  toISO: string,
  errors: string[],
): Promise<ExecRow[]> {
  const rows: ExecRow[] = [];

  try {
    const { data, error } = await admin
      .from("scheduled_actions")
      .select(
        "source, job_id, campaign_id, publish_action_id, campaign_reply_id, account_id, handle, persona_name, action_type, status, target_tweet_id, target_handle, updated_at, run_at, result_tweet_id",
      )
      .gte("updated_at", fromISO)
      .lt("updated_at", toISO)
      .limit(20000);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Record<string, any>[]) {
      if (r["publish_action_id"] || r["campaign_reply_id"]) continue;
      const isListen = Boolean(r["campaign_id"]);
      const id = String(r["campaign_id"] ?? r["job_id"] ?? "");
      if (!id) continue;
      rows.push({
        campaignKey: `${isListen ? "listen" : "publish"}:${id}`,
        source: isListen ? "listen" : "publish",
        campaignId: id,
        kind: String(r["action_type"] ?? ""),
        status: String(r["status"] ?? ""),
        accountId: r["account_id"] ? String(r["account_id"]) : null,
        handle: String(r["handle"] ?? ""),
        persona: String(r["persona_name"] ?? ""),
        target: r["target_tweet_id"]
          ? `https://x.com/i/status/${r["target_tweet_id"]}`
          : r["target_handle"]
            ? `@${String(r["target_handle"]).replace(/^@/, "")}`
            : "",
        at: r["updated_at"] ?? r["run_at"] ?? null,
        result: r["result_tweet_id"] ? `https://x.com/i/status/${r["result_tweet_id"]}` : "",
      });
    }
  } catch (err) {
    errors.push(`Scheduled actions: ${(err as Error).message}`);
  }

  try {
    const { data, error } = await admin
      .from("publish_actions")
      .select("job_id, account_id, action_type, status, result_tweet_id, created_at, updated_at")
      .gte("updated_at", fromISO)
      .lt("updated_at", toISO)
      .limit(20000);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Record<string, any>[]) {
      rows.push({
        campaignKey: `publish:${String(r["job_id"])}`,
        source: "publish",
        campaignId: String(r["job_id"]),
        kind: String(r["action_type"] ?? ""),
        status: String(r["status"] ?? ""),
        accountId: r["account_id"] ? String(r["account_id"]) : null,
        handle: "",
        persona: "",
        target: "",
        at: r["updated_at"] ?? r["created_at"] ?? null,
        result: r["result_tweet_id"] ? `https://x.com/i/status/${r["result_tweet_id"]}` : "",
      });
    }
  } catch (err) {
    errors.push(`Publish actions: ${(err as Error).message}`);
  }

  try {
    const { data, error } = await admin
      .from("campaign_replies")
      .select(
        "campaign_id, account_id, handle, persona_name, status, tweet_url, tweet_id, result_tweet_id, created_at",
      )
      .gte("created_at", fromISO)
      .lt("created_at", toISO)
      .limit(20000);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Record<string, any>[]) {
      rows.push({
        campaignKey: `listen:${String(r["campaign_id"])}`,
        source: "listen",
        campaignId: String(r["campaign_id"]),
        kind: "comment",
        status: String(r["status"] ?? ""),
        accountId: r["account_id"] ? String(r["account_id"]) : null,
        handle: String(r["handle"] ?? ""),
        persona: String(r["persona_name"] ?? ""),
        target: String(
          r["tweet_url"] ?? (r["tweet_id"] ? `https://x.com/i/status/${r["tweet_id"]}` : ""),
        ),
        at: r["created_at"] ?? null,
        result: r["result_tweet_id"] ? `https://x.com/i/status/${r["result_tweet_id"]}` : "",
      });
    }
  } catch (err) {
    errors.push(`Campaign replies: ${(err as Error).message}`);
  }

  return rows;
}

const SUCCESS = new Set(["success", "posted", "completed", "sent"]);
const FAILED = new Set(["failed", "error"]);

function typeFromKinds(kinds: string[]): string {
  const unique = [...new Set(kinds.filter(Boolean))];
  if (unique.length === 0) return "Campaign";
  if (unique.length > 1) {
    const engagementOnly = unique.every((k) => k === "like" || k === "retweet" || k === "bookmark");
    return engagementOnly ? "Engagement campaign" : "Mixed campaign";
  }
  return `${KIND_LABEL[unique[0]!] ?? "Action"} campaign`;
}

async function buildCampaigns(
  admin: any,
  rows: ExecRow[],
  accounts: Map<string, { handle: string; persona: string }>,
  errors: string[],
): Promise<{
  campaigns: ReportCampaigns;
  personas: ReportPersonas;
  activity: PersonaActivityRow[];
}> {
  const keys = [...new Set(rows.map((r) => r.campaignKey))];
  const jobIds = keys.filter((k) => k.startsWith("publish:")).map((k) => k.slice(8));
  const listenIds = keys.filter((k) => k.startsWith("listen:")).map((k) => k.slice(7));

  const meta = new Map<string, any>();
  if (jobIds.length) {
    try {
      const { data } = await admin
        .from("publish_jobs")
        .select(
          "id, name, summary, mode, status, tweet_text, comment_text, objective_text, target_tweet_url, engagement_actions, created_at",
        )
        .in("id", jobIds);
      for (const j of (data ?? []) as any[]) meta.set(`publish:${j.id}`, j);
    } catch (err) {
      errors.push(`Campaigns: ${(err as Error).message}`);
    }
  }
  if (listenIds.length) {
    try {
      const { data } = await admin
        .from("listening_campaigns")
        .select("id, name, summary, core_message, account_ids, is_active, created_at, last_run_at")
        .in("id", listenIds);
      for (const c of (data ?? []) as any[]) meta.set(`listen:${c.id}`, c);
    } catch (err) {
      errors.push(`Listening campaigns: ${(err as Error).message}`);
    }
  }

  const runs: CampaignRun[] = [];
  const totals = {
    requested: 0,
    completed: 0,
    failed: 0,
    likes: 0,
    replies: 0,
    reposts: 0,
    follows: 0,
    posts: 0,
  };
  const activity: PersonaActivityRow[] = [];
  const personaStats = new Map<
    string,
    { persona: string; handle: string; actions: number; successful: number; failed: number }
  >();

  for (const key of keys) {
    const list = rows.filter((r) => r.campaignKey === key);
    const info = meta.get(key) ?? {};
    const source = key.startsWith("listen:") ? ("listen" as const) : ("publish" as const);
    const name =
      String(info.name ?? "").trim() ||
      String(info.objective_text ?? info.core_message ?? info.tweet_text ?? info.comment_text ?? "")
        .trim()
        .slice(0, 70) ||
      "Untitled campaign";

    const count = (pred: (r: ExecRow) => boolean) => list.filter(pred).length;
    const done = list.filter((r) => SUCCESS.has(r.status));
    const failed = list.filter((r) => FAILED.has(r.status));
    const usedAccounts = new Set(done.map((r) => r.accountId ?? r.handle).filter(Boolean));
    const requestedAccounts = new Set(list.map((r) => r.accountId ?? r.handle).filter(Boolean));

    const times = list
      .map((r) => r.at)
      .filter(Boolean)
      .sort() as string[];
    const campaignName = name;

    for (const r of list) {
      const acc = r.accountId ? accounts.get(r.accountId) : undefined;
      const handle = r.handle || acc?.handle || "";
      const persona = r.persona || acc?.persona || handle || "Persona";
      activity.push({
        persona,
        account: handle ? `@${handle.replace(/^@/, "")}` : "",
        platform: "X",
        campaign: campaignName,
        action: KIND_LABEL[r.kind] ?? r.kind,
        target: r.target,
        time: r.at,
        status: SUCCESS.has(r.status) ? "Success" : FAILED.has(r.status) ? "Failed" : r.status,
        result: r.result,
      });
      const statKey = handle || persona;
      const stat = personaStats.get(statKey) ?? {
        persona,
        handle,
        actions: 0,
        successful: 0,
        failed: 0,
      };
      stat.actions += 1;
      if (SUCCESS.has(r.status)) stat.successful += 1;
      if (FAILED.has(r.status)) stat.failed += 1;
      personaStats.set(statKey, stat);
    }

    const likes = count((r) => SUCCESS.has(r.status) && r.kind === "like");
    const replies = count((r) => SUCCESS.has(r.status) && r.kind === "comment");
    const reposts = count((r) => SUCCESS.has(r.status) && r.kind === "retweet");
    const follows = count((r) => SUCCESS.has(r.status) && r.kind === "follow");
    const posts = count((r) => SUCCESS.has(r.status) && r.kind === "tweet");

    totals.requested += list.length;
    totals.completed += done.length;
    totals.failed += failed.length;
    totals.likes += likes;
    totals.replies += replies;
    totals.reposts += reposts;
    totals.follows += follows;
    totals.posts += posts;

    const pending = list.length - done.length - failed.length;

    runs.push({
      campaignId: key.split(":")[1] ?? "",
      campaignName,
      campaignType: typeFromKinds(list.map((r) => r.kind)),
      source,
      createdAt: info.created_at ?? null,
      startedAt: times[0] ?? null,
      completedAt: pending === 0 ? (times[times.length - 1] ?? null) : null,
      status: pending > 0 ? "Running" : failed.length && !done.length ? "Failed" : "Completed",
      targetPost: String(info.tweet_text ?? info.comment_text ?? info.core_message ?? "").slice(
        0,
        180,
      ),
      targetUrl: String(info.target_tweet_url ?? list.find((r) => r.target)?.target ?? ""),
      personasRequested: requestedAccounts.size,
      personasEligible: requestedAccounts.size,
      personasUsed: usedAccounts.size,
      requestedActions: list.length,
      completedActions: done.length,
      failedActions: failed.length,
      likes,
      replies,
      reposts,
      follows,
      posts,
      engagementGenerated: likes + replies + reposts + follows,
    });
  }

  runs.sort((a, b) => String(b.startedAt ?? "").localeCompare(String(a.startedAt ?? "")));

  const leaderboard = [...personaStats.values()].sort((a, b) => b.actions - a.actions).slice(0, 25);

  return {
    campaigns: {
      total: runs.length,
      runs,
      requestedActions: totals.requested,
      completedActions: totals.completed,
      failedActions: totals.failed,
      likes: totals.likes,
      replies: totals.replies,
      reposts: totals.reposts,
      follows: totals.follows,
      posts: totals.posts,
    },
    personas: {
      active: personaStats.size,
      totalActions: totals.requested,
      successful: totals.completed,
      failed: totals.failed,
      leaderboard,
    },
    activity: activity.sort((a, b) => String(b.time ?? "").localeCompare(String(a.time ?? ""))),
  };
}

/* ------------------------------------------------------------------ */
/* Insights                                                            */
/* ------------------------------------------------------------------ */

/** Deterministic fallback so a report always carries a readable summary. */
function fallbackInsights(
  metrics: ReportMetrics,
  conversation: ReportConversation,
  campaigns: ReportCampaigns,
): { insights: ReportInsight[]; recommendations: ReportRecommendation[] } {
  const insights: ReportInsight[] = [];
  if (conversation.mostDiscussed) {
    insights.push({
      text: `${conversation.mostDiscussed} carried the most conversation in this period.`,
    });
  }
  if (conversation.mostEngagedPlatform) {
    insights.push({
      text: `${conversation.mostEngagedPlatform} produced the highest engagement of any platform we monitor.`,
    });
  }
  if (metrics.sentiment.total > 0) {
    insights.push({
      text: `Sentiment ran ${metrics.sentiment.positivePct}% positive against ${metrics.sentiment.negativePct}% negative.`,
    });
  }
  if (campaigns.total > 0) {
    insights.push({
      text: `${campaigns.total} campaign${campaigns.total === 1 ? "" : "s"} executed ${campaigns.completedActions} completed actions, with ${campaigns.failedActions} failures.`,
    });
  }

  const recommendations: ReportRecommendation[] = [];
  if (conversation.issues[0]) {
    recommendations.push({
      category: "RESPOND",
      headline: `Negative pressure on ${conversation.issues[0].topic}`,
      action: "Prepare a short factual response before the conversation sets.",
    });
  }
  if (conversation.mostDiscussed) {
    recommendations.push({
      category: "AMPLIFY",
      headline: `${conversation.mostDiscussed} is where attention sits`,
      action: "Keep publishing on this theme while the conversation is live.",
    });
  }
  if (campaigns.failedActions > 0) {
    recommendations.push({
      category: "WATCH",
      headline: "Some persona actions failed",
      action: "Review the failed actions and re-queue them from Campaign Manager.",
    });
  }
  return { insights: insights.slice(0, 4), recommendations: recommendations.slice(0, 3) };
}

async function writeInsights(input: {
  metrics: ReportMetrics;
  conversation: ReportConversation;
  campaigns: Omit<ReportCampaigns, "runs">;
}): Promise<{ insights: ReportInsight[]; recommendations: ReportRecommendation[] } | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content: [
              "You are the communications analyst for Football Kenya Federation (FKF) and its president Hussein Mohammed.",
              "You are given the measured figures for one reporting period: mentions, sentiment, platforms, topics and campaign execution.",
              "Write exactly 3 short insights, each a single sentence, each supported by the data given. Do not invent facts.",
              "Then write 1 to 3 recommendations. category must be one of AMPLIFY, RESPOND, WATCH, JOIN, PUBLISH.",
              "Keep organic conversation and campaign activity separate — never describe persona actions as public reaction.",
              'Return strict JSON: {"insights":[string],"recommendations":[{"category":string,"headline":string,"action":string}]}',
            ].join(" "),
          },
          { role: "user", content: JSON.stringify(input) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) {
      console.error(
        `Report insight generation failed [${response.status}]: ${await response.text()}`,
      );
      return null;
    }
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as any;
    const insights: ReportInsight[] = Array.isArray(parsed.insights)
      ? parsed.insights
          .filter((t: unknown) => typeof t === "string" && t.trim())
          .slice(0, 4)
          .map((text: string) => ({ text }))
      : [];
    const allowed = ["AMPLIFY", "RESPOND", "WATCH", "JOIN", "PUBLISH"];
    const recommendations: ReportRecommendation[] = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
          .filter((r: any) => r && typeof r.headline === "string")
          .slice(0, 3)
          .map((r: any) => ({
            category: allowed.includes(String(r.category).toUpperCase())
              ? (String(r.category).toUpperCase() as ReportRecommendation["category"])
              : "WATCH",
            headline: String(r.headline),
            action: String(r.action ?? ""),
          }))
      : [];
    if (!insights.length) return null;
    return { insights, recommendations };
  } catch (err) {
    console.error("Report insight generation failed", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

export type BuiltReport = Omit<ReportRecord, "id">;

/** Builds a report for an explicit instant range. Never throws on one source. */
export async function buildReport(options: {
  kind: ReportKind;
  reportDate: string;
  label: string;
  periodStart: string;
  periodEnd: string;
}): Promise<BuiltReport> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const errors: string[] = [];

  const from = new Date(options.periodStart).getTime();
  const to = new Date(options.periodEnd).getTime();
  const prevFrom = new Date(from - (to - from)).toISOString();

  const [current, previous, execs, accountRows] = await Promise.all([
    loadMentions(admin, options.periodStart, options.periodEnd, errors),
    loadMentions(admin, prevFrom, options.periodStart, []),
    loadExecutions(admin, options.periodStart, options.periodEnd, errors),
    admin
      .from("x_accounts")
      .select("id, handle, persona_label, display_name")
      .then((r: any) => r.data ?? [])
      .catch(() => []),
  ]);

  const accounts = new Map<string, { handle: string; persona: string }>();
  for (const a of accountRows as any[]) {
    accounts.set(String(a.id), {
      handle: String(a.handle ?? ""),
      persona: String(a.persona_label ?? a.display_name ?? a.handle ?? ""),
    });
  }

  const sentiment = countSentiment(current);
  const ownPosts = execs.filter(
    (r) => SUCCESS.has(r.status) && (r.kind === "tweet" || r.kind === "comment"),
  ).length;

  const metrics: ReportMetrics = {
    mentions: current.length,
    previousMentions: previous.length,
    mentionsChangePct: previous.length
      ? Math.round(((current.length - previous.length) / previous.length) * 100)
      : null,
    sentiment,
    views: current.reduce((a, i) => a + i.views, 0),
    engagements: current.reduce((a, i) => a + i.engagements, 0),
    ownPosts,
  };

  const conversation = buildConversation(current, previous);
  const { campaigns, personas } = await buildCampaigns(admin, execs, accounts, errors);

  const { runs, ...campaignTotals } = campaigns;
  const written =
    current.length || campaigns.total
      ? await writeInsights({ metrics, conversation, campaigns: campaignTotals })
      : null;
  const summary = written ?? fallbackInsights(metrics, conversation, campaigns);

  const status: ReportStatus = errors.length ? "partial" : "ready";

  return {
    kind: options.kind,
    reportDate: options.reportDate,
    label: options.label,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    status,
    generatedAt: new Date().toISOString(),
    metrics,
    conversation,
    campaigns: { ...campaignTotals, runs },
    personas,
    insights: summary.insights,
    recommendations: summary.recommendations,
    sourceErrors: errors,
  };
}

/** Builds and stores a report, replacing any existing one for the period. */
export async function generateReport(options: {
  kind: ReportKind;
  reportDate: string;
  label: string;
  periodStart: string;
  periodEnd: string;
}): Promise<ReportRecord> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  let built: BuiltReport;
  try {
    built = await buildReport(options);
  } catch (err) {
    built = {
      ...options,
      status: "failed",
      generatedAt: new Date().toISOString(),
      metrics: {
        mentions: 0,
        previousMentions: 0,
        mentionsChangePct: null,
        sentiment: emptySentiment(),
        views: 0,
        engagements: 0,
        ownPosts: 0,
      },
      conversation: {
        platforms: [],
        topics: [],
        topPosts: [],
        issues: [],
        mostDiscussed: null,
        fastestGrowing: null,
        mostEngagedPlatform: null,
        federation: emptySentiment(),
        president: emptySentiment(),
      },
      campaigns: {
        total: 0,
        runs: [],
        requestedActions: 0,
        completedActions: 0,
        failedActions: 0,
        likes: 0,
        replies: 0,
        reposts: 0,
        follows: 0,
        posts: 0,
      },
      personas: { active: 0, totalActions: 0, successful: 0, failed: 0, leaderboard: [] },
      insights: [],
      recommendations: [],
      sourceErrors: [(err as Error).message],
    };
  }

  const row = {
    kind: built.kind,
    report_date: built.reportDate,
    label: built.label,
    period_start: built.periodStart,
    period_end: built.periodEnd,
    status: built.status,
    metrics: built.metrics,
    conversation: built.conversation,
    campaigns: built.campaigns,
    personas: built.personas,
    insights: built.insights,
    recommendations: built.recommendations,
    source_errors: built.sourceErrors,
    generated_at: built.generatedAt,
  };

  // Collected text carries emoji, and trimming it to a headline length can cut
  // an emoji in half. A half emoji is not valid text to store, so scrub any
  // stray halves and NULs before writing — a report must never be lost to one
  // broken character.
  const clean = JSON.parse(JSON.stringify(row), (_k, value) =>
    typeof value === "string" ? sanitizeText(value) : value,
  );

  const { data, error } = await admin
    .from("reports")
    .upsert(clean, { onConflict: "kind,report_date,period_start,period_end" })
    .select("id")
    .single();
  if (error) {
    console.error("Storing report failed", JSON.stringify(error));
    throw new Error(`Storing report failed: ${error.message}`);
  }
  if (!data?.id) throw new Error("Storing report failed: no report ID was returned");

  return { id: String(data.id), ...built };
}

/** Generates the daily report for a reporting day (defaults to today, Nairobi). */
export async function generateDailyReport(dateKey?: string): Promise<ReportRecord> {
  const key = dateKey ?? reportDateKey();
  const { start, end } = dayBounds(key);
  return generateReport({
    kind: "daily",
    reportDate: key,
    label: `Daily Report — ${formatReportDate(key)}`,
    periodStart: start,
    periodEnd: end,
  });
}
