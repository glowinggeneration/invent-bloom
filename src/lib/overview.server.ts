/**
 * Overview intelligence, built server-side from what has actually been
 * collected: X mentions stored by the mentions sweep and the multi-platform
 * rows Apify brings in. Nothing here invents a number — a figure that has no
 * collected evidence behind it comes back as zero or null and the page says so.
 *
 * The AI layer never produces counts. It reads the real aggregates and writes
 * the short human sentences around them (why a topic matters, what to do).
 */
import {
  delta,
  split,
  type OverviewData,
  type OverviewIntel,
  type OverviewWindow,
  type PlatformSlice,
  type Recommendation,
  type SentimentSplit,
  type SeriesPoint,
  type Sentiment,
  type TopAccount,
  type TopContentItem,
  type TopicMomentum,
  type TrendingTopic,
  windowHours,
} from "./overview";
import { CORE_QUERIES, classifyEntities } from "./apify-sources";

type Item = {
  at: number | null;
  platform: string;
  /** Value the /mentions source filter understands. */
  filter: string;
  sentiment: Sentiment;
  engagements: number;
  views: number;
  authorHandle: string;
  authorName: string;
  authorUrl: string;
  text: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  topics: string[];
  hashtags: string[];
  federation: boolean;
  president: boolean;
};

const PRESIDENT = /hussein|husseinmoha|\bmohammed\b|president/i;
const FEDERATION = /\bfkf\b|football[_ ]?kenya|federation|harambee|fkfpl/i;

function hashtagsIn(text: string): string[] {
  return [...new Set((text.match(/#[A-Za-z][A-Za-z0-9_]{2,30}/g) ?? []).map((h) => h))];
}

function sentimentOf(value: unknown): Sentiment {
  return value === "positive" || value === "negative" ? value : "neutral";
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Everything collected since `fromISO`, from both stores, in one shape. */
async function loadItems(admin: any, fromISO: string): Promise<Item[]> {
  const [x, social] = await Promise.all([
    admin
      .from("x_mentions")
      .select(
        "tweet_id, text, author_handle, author_name, url, posted_at, like_count, view_count, sentiment, mentions_federation, mentions_president",
      )
      .gte("posted_at", fromISO)
      .order("posted_at", { ascending: false })
      .limit(5000),
    admin
      .from("apify_mentions")
      .select(
        "id, platform, source_label, author_name, author_handle, author_avatar, title, content, url, thumbnail_url, published_at, views, likes, comments, shares, entities, sentiment",
      )
      .gte("published_at", fromISO)
      .order("published_at", { ascending: false })
      .limit(5000),
  ]);

  const items: Item[] = [];

  for (const r of (x.data ?? []) as Record<string, any>[]) {
    const text = String(r["text"] ?? "");
    const at = r["posted_at"] ? new Date(r["posted_at"]).getTime() : null;
    items.push({
      at: at && !Number.isNaN(at) ? at : null,
      platform: "X",
      filter: "mention",
      sentiment: sentimentOf(r["sentiment"]),
      engagements: num(r["like_count"]),
      views: num(r["view_count"]),
      authorHandle: String(r["author_handle"] ?? ""),
      authorName: String(r["author_name"] ?? r["author_handle"] ?? ""),
      authorUrl: `https://x.com/${String(r["author_handle"] ?? "").replace(/^@/, "")}`,
      text,
      title: text.slice(0, 140),
      url: String(r["url"] ?? ""),
      thumbnailUrl: null,
      topics: classifyEntities(text),
      hashtags: hashtagsIn(text),
      federation: Boolean(r["mentions_federation"]) || FEDERATION.test(text),
      president: Boolean(r["mentions_president"]) || PRESIDENT.test(text),
    });
  }

  for (const r of (social.data ?? []) as Record<string, any>[]) {
    const text = `${r["title"] ?? ""} ${r["content"] ?? ""}`.trim();
    const at = r["published_at"] ? new Date(r["published_at"]).getTime() : null;
    items.push({
      at: at && !Number.isNaN(at) ? at : null,
      platform: String(r["source_label"] ?? r["platform"] ?? "Other"),
      filter: String(r["source_label"] ?? r["platform"] ?? "Other"),
      sentiment: sentimentOf(r["sentiment"]),
      engagements: num(r["likes"]) + num(r["comments"]) + num(r["shares"]),
      views: num(r["views"]),
      authorHandle: String(r["author_handle"] ?? ""),
      authorName: String(r["author_name"] ?? r["author_handle"] ?? r["source_label"] ?? ""),
      authorUrl: String(r["url"] ?? ""),
      text,
      title: String(r["title"] ?? text.slice(0, 140)),
      url: String(r["url"] ?? ""),
      thumbnailUrl: r["thumbnail_url"] ?? null,
      topics: (r["entities"] ?? []).length ? (r["entities"] as string[]) : classifyEntities(text),
      hashtags: hashtagsIn(text),
      federation: FEDERATION.test(text),
      president: PRESIDENT.test(text),
    });
  }

  return items.filter((i) => i.at !== null);
}

function countSplit(items: Item[]): SentimentSplit {
  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const i of items) counts[i.sentiment] += 1;
  return split(counts);
}

function buildSeries(items: Item[], from: number, to: number, buckets: number): SeriesPoint[] {
  const size = Math.max(1, Math.floor((to - from) / buckets));
  const points: SeriesPoint[] = Array.from({ length: buckets }, (_, i) => {
    const start = from + i * size;
    const d = new Date(start);
    return {
      at: d.toISOString(),
      label:
        size <= 3 * 3600 * 1000
          ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
          : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      positive: 0,
      neutral: 0,
      negative: 0,
      total: 0,
    };
  });
  for (const item of items) {
    if (item.at === null) continue;
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((item.at - from) / size)));
    const point = points[idx]!;
    point[item.sentiment] += 1;
    point.total += 1;
  }
  return points;
}

/** Topic tags plus real hashtags, ranked by how much conversation carries them. */
function topicCounts(items: Item[]): Map<string, Item[]> {
  const map = new Map<string, Item[]>();
  const add = (key: string, item: Item) => {
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  };
  for (const item of items) {
    for (const t of item.topics) add(t, item);
    for (const h of item.hashtags) add(h, item);
  }
  return map;
}

function topicMomentum(current: Item[], previous: Item[], limit: number): TopicMomentum[] {
  const now = topicCounts(current);
  const before = topicCounts(previous);
  const rows: TopicMomentum[] = [];
  for (const [topic, list] of now) {
    if (list.length < 2) continue;
    const prev = before.get(topic)?.length ?? 0;
    const driver = [...list].sort((a, b) => b.engagements - a.engagements)[0];
    rows.push({
      topic,
      volume: list.length,
      sentiment: countSplit(list),
      changePct: prev > 0 ? Math.round(((list.length - prev) / prev) * 100) : null,
      topDriver: driver?.title?.slice(0, 120) ?? null,
      topDriverUrl: driver?.url ?? null,
    });
  }
  return rows.sort((a, b) => b.volume - a.volume).slice(0, limit);
}

function topAccounts(items: Item[]): TopAccount[] {
  const byHandle = new Map<string, Item[]>();
  for (const item of items) {
    const key = `${item.platform}:${(item.authorHandle || item.authorName).toLowerCase()}`;
    if (!key.trim() || key.endsWith(":")) continue;
    const list = byHandle.get(key);
    if (list) list.push(item);
    else byHandle.set(key, [item]);
  }

  const rows: TopAccount[] = [];
  for (const list of byHandle.values()) {
    const first = list[0]!;
    const sentiment = countSplit(list);
    // One post is never enough evidence to call an account supportive or
    // critical — those accounts stay "unclear".
    const stance: TopAccount["stance"] =
      list.length < 2
        ? "unclear"
        : sentiment.positivePct >= 60
          ? "supportive"
          : sentiment.negativePct >= 60
            ? "critical"
            : "neutral";
    const topics = topicCounts(list);
    const topTopic =
      [...topics.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? null;
    rows.push({
      handle: first.authorHandle || first.authorName,
      name: first.authorName || first.authorHandle,
      platform: first.platform,
      profileUrl: first.authorUrl,
      followers: null,
      posts: list.length,
      engagements: list.reduce((acc, i) => acc + i.engagements, 0),
      sentiment,
      stance,
      topTopic,
    });
  }

  return rows.sort((a, b) => b.engagements - a.engagements || b.posts - a.posts).slice(0, 12);
}

function topContent(items: Item[]): TopContentItem[] {
  const best = new Map<string, Item>();
  for (const item of items) {
    if (!item.url) continue;
    const current = best.get(item.platform);
    if (!current || item.engagements > current.engagements) best.set(item.platform, item);
  }
  return [...best.values()]
    .filter((i) => i.engagements > 0 || i.views > 0)
    .sort((a, b) => b.engagements - a.engagements)
    .slice(0, 6)
    .map((i) => ({
      platform: i.platform,
      title: (i.title || i.text).slice(0, 160),
      author: i.authorName || i.authorHandle,
      url: i.url,
      publishedAt: i.at ? new Date(i.at).toISOString() : null,
      engagements: i.engagements,
      views: i.views || null,
      sentiment: i.sentiment,
      thumbnailUrl: i.thumbnailUrl,
    }));
}

/** Our own published output in the window, for the "Posts" figure. */
async function publishedPosts(
  admin: any,
  fromISO: string,
  prevFromISO: string,
): Promise<{ now: number; prev: number }> {
  const { data } = await admin
    .from("publish_actions")
    .select("created_at, status, action_type")
    .gte("created_at", prevFromISO)
    .eq("status", "success")
    .limit(5000);

  let now = 0;
  let prev = 0;
  for (const row of (data ?? []) as Record<string, any>[]) {
    const type = String(row["action_type"] ?? "");
    if (type !== "post" && type !== "reply" && type !== "comment") continue;
    const at = String(row["created_at"] ?? "");
    if (at >= fromISO) now += 1;
    else prev += 1;
  }
  return { now, prev };
}

/** The full Overview payload for one time window. */
export async function buildOverview(
  window: OverviewWindow,
  customHours?: number | null,
): Promise<OverviewData> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  const hours = windowHours(window, customHours);
  const to = Date.now();
  const from = to - hours * 3600 * 1000;
  const prevFrom = from - hours * 3600 * 1000;

  const all = await loadItems(admin, new Date(prevFrom).toISOString());
  const current = all.filter((i) => i.at! >= from);
  const previous = all.filter((i) => i.at! < from);

  const sentiment = countSplit(current);
  const previousSentiment = countSplit(previous);

  const engagements = current.reduce((a, i) => a + i.engagements, 0);
  const prevEngagements = previous.reduce((a, i) => a + i.engagements, 0);
  const views = current.reduce((a, i) => a + i.views, 0);
  const prevViews = previous.reduce((a, i) => a + i.views, 0);

  const posts = await publishedPosts(
    admin,
    new Date(from).toISOString(),
    new Date(prevFrom).toISOString(),
  );

  const dayAgo = to - 24 * 3600 * 1000;
  const weekAgo = to - 7 * 24 * 3600 * 1000;

  const platformMap = new Map<string, Item[]>();
  for (const i of current) {
    const list = platformMap.get(i.platform);
    if (list) list.push(i);
    else platformMap.set(i.platform, [i]);
  }
  const platforms: PlatformSlice[] = [...platformMap.entries()]
    .map(([platform, list]) => ({
      platform,
      filter: list[0]!.filter,
      count: list.length,
      sharePct: current.length ? Math.round((list.length / current.length) * 100) : 0,
      sentiment: countSplit(list),
    }))
    .sort((a, b) => b.count - a.count);

  // Emerging issues read a shorter, sharper window: what changed in the last
  // six hours against the six before it.
  const sixHours = 6 * 3600 * 1000;
  const recent = all.filter((i) => i.at! >= to - sixHours);
  const priorSix = all.filter((i) => i.at! >= to - 2 * sixHours && i.at! < to - sixHours);
  const recentTopics = topicCounts(recent.filter((i) => i.sentiment === "negative"));
  const priorTopics = topicCounts(priorSix.filter((i) => i.sentiment === "negative"));
  const issues = [...recentTopics.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([topic, list]) => {
      const prev = priorTopics.get(topic)?.length ?? 0;
      const driver = [...list].sort((a, b) => b.engagements - a.engagements)[0];
      return {
        topic,
        volume: list.length,
        negatives: list.length,
        sentiment: countSplit(list),
        changePct: prev > 0 ? Math.round(((list.length - prev) / prev) * 100) : null,
        negativeChangePct: prev > 0 ? Math.round(((list.length - prev) / prev) * 100) : null,
        topDriver: driver?.title?.slice(0, 120) ?? null,
        topDriverUrl: driver?.url ?? null,
      };
    })
    .sort((a, b) => (b.negativeChangePct ?? 0) - (a.negativeChangePct ?? 0) || b.volume - a.volume)
    .slice(0, 4);

  const momentum = topicMomentum(current, previous, 12)
    .filter((t) => t.sentiment.positivePct >= 55)
    .slice(0, 4);

  const score = sentiment.total
    ? Math.round(sentiment.positivePct + sentiment.neutralPct * 0.5)
    : null;

  return {
    window,
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    generatedAt: new Date().toISOString(),
    empty: current.length === 0,
    health: {
      score,
      mentions: delta(current.length, previous.length),
      engagements: delta(engagements, prevEngagements),
      views: delta(views, prevViews),
      posts: delta(posts.now, posts.prev),
      sentiment,
      previousSentiment,
    },
    series: buildSeries(current, from, to, hours <= 24 ? 12 : hours <= 24 * 7 ? 14 : 15),
    volume: {
      today: all.filter((i) => i.at! >= dayAgo).length,
      thisWeek: all.filter((i) => i.at! >= weekAgo).length,
      total: delta(current.length, previous.length),
    },
    entities: {
      federation: countSplit(current.filter((i) => i.federation && !i.president)),
      president: countSplit(current.filter((i) => i.president)),
    },
    platforms,
    momentum,
    issues,
    topContent: topContent(current),
    topAccounts: topAccounts(current),
  };
}

/* ---------------------------------------------------------------------- */
/* Trending topics, conversations to join, insights and recommendations    */
/* ---------------------------------------------------------------------- */

const INTEL_KEY = "overview-intel";
const INTEL_MAX_AGE_MS = 45 * 60 * 1000;

type LiveTopic = {
  topic: string;
  volume: number;
  sentiment: SentimentSplit;
  momentumPct: number | null;
};

/**
 * Live X reading: how much conversation each core federation query is
 * carrying right now. Volumes come back from the search itself, never from a
 * model.
 */
async function liveXTopics(): Promise<{ query: string; posts: number; sample: string[] }[]> {
  const { searchTweets } = await import("./twitterapi.server");
  const queries = CORE_QUERIES.slice(0, 6);
  const out: { query: string; posts: number; sample: string[] }[] = [];
  for (const query of queries) {
    try {
      const { tweets } = await searchTweets(`${query} -filter:retweets`, 40);
      if (tweets.length === 0) continue;
      out.push({
        query,
        posts: tweets.length,
        sample: tweets.slice(0, 5).map((t) => t.text.slice(0, 180)),
      });
    } catch {
      /* one throttled query must not cost the whole read */
    }
  }
  return out;
}

/** Asks the model to write the words around numbers we already computed. */
async function writeIntel(input: {
  topics: LiveTopic[];
  live: { query: string; posts: number; sample: string[] }[];
  facts: string[];
}): Promise<Pick<OverviewIntel, "trending" | "joinable" | "insights" | "recommendations"> | null> {
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
              "You are given real measured topic volumes, sentiment splits and momentum, plus samples of live posts on X.",
              "Never invent or restate numbers, percentages or counts in your text — the interface shows them. Write only the human reading.",
              "Only keep topics with a real strategic connection to FKF, the president, Kenyan football, national teams, grassroots, referees, stadiums, supporters, CAF or FIFA. Drop unrelated viral chatter.",
              "Every sentence must be short, specific and traceable to the data given. No generic marketing statements.",
              "For each trending topic: why (one sentence on what is driving it), relevance (one sentence on why it matters to FKF), opportunity (one sentence suggested angle).",
              "joinable: conversations FKF can enter naturally, each with one sentence on why FKF should join.",
              "insights: 3 to 5 short observations drawn from the measured data.",
              "recommendations: 2 to 5 items, category one of AMPLIFY, RESPOND, JOIN, WATCH, PUBLISH, each with a short headline and a one-sentence recommended action.",
              'Return strict JSON: {"trending":[{"topic":string,"why":string,"relevance":string,"opportunity":string}],"joinable":[{"topic":string,"why":string}],"insights":[string],"recommendations":[{"category":string,"headline":string,"action":string}]}',
            ].join(" "),
          },
          { role: "user", content: JSON.stringify(input) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) {
      console.error(`Overview intel generation failed [${response.status}]`);
      return null;
    }
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as any;

    const byTopic = new Map(input.topics.map((t) => [t.topic.toLowerCase(), t]));
    const trending: TrendingTopic[] = (parsed.trending ?? [])
      .map((t: any): TrendingTopic | null => {
        const measured = byTopic.get(String(t?.topic ?? "").toLowerCase());
        if (!measured) return null;
        return {
          topic: measured.topic,
          volume: measured.volume,
          sentiment: measured.sentiment,
          momentumPct: measured.momentumPct,
          why: String(t?.why ?? "").trim(),
          relevance: String(t?.relevance ?? "").trim(),
          opportunity: String(t?.opportunity ?? "").trim(),
        };
      })
      .filter(Boolean)
      .slice(0, 6);

    const joinable = (parsed.joinable ?? [])
      .map((j: any) => {
        const measured = byTopic.get(String(j?.topic ?? "").toLowerCase());
        return {
          topic: String(j?.topic ?? "").trim(),
          volume: measured?.volume ?? 0,
          sentiment: measured?.sentiment ?? split({ positive: 0, neutral: 0, negative: 0 }),
          why: String(j?.why ?? "").trim(),
        };
      })
      .filter((j: any) => j.topic && j.why)
      .slice(0, 5);

    const insights = (parsed.insights ?? [])
      .map((s: any) => ({ text: String(s ?? "").trim() }))
      .filter((s: any) => s.text)
      .slice(0, 5);

    const allowed = ["AMPLIFY", "RESPOND", "JOIN", "WATCH", "PUBLISH"];
    const recommendations: Recommendation[] = (parsed.recommendations ?? [])
      .map((r: any) => ({
        category: (allowed.includes(String(r?.category).toUpperCase())
          ? String(r.category).toUpperCase()
          : "WATCH") as Recommendation["category"],
        headline: String(r?.headline ?? "").trim(),
        action: String(r?.action ?? "").trim(),
      }))
      .filter((r: Recommendation) => r.headline && r.action)
      .slice(0, 5);

    return { trending, joinable, insights, recommendations };
  } catch (err) {
    console.error("Overview intel generation error", err);
    return null;
  }
}

/**
 * Reads the cached intelligence, regenerating it when it is older than the
 * cache window or when the caller forces a refresh. Regeneration is the only
 * path that spends X or AI calls.
 */
export async function getIntel(force = false): Promise<OverviewIntel> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  const { data: cached } = await admin
    .from("overview_intel")
    .select("payload, generated_at")
    .eq("key", INTEL_KEY)
    .maybeSingle();

  const age = cached?.generated_at
    ? Date.now() - new Date(cached.generated_at).getTime()
    : Infinity;
  if (!force && cached && age < INTEL_MAX_AGE_MS) {
    return { ...(cached.payload as OverviewIntel), generatedAt: cached.generated_at };
  }

  const hours = 48;
  const to = Date.now();
  const from = to - hours * 3600 * 1000;
  const all = await loadItems(admin, new Date(from - hours * 3600 * 1000).toISOString());
  const current = all.filter((i) => i.at! >= from);
  const previous = all.filter((i) => i.at! < from);

  const measured = topicMomentum(current, previous, 10);
  const topics: LiveTopic[] = measured.map((t) => ({
    topic: t.topic,
    volume: t.volume,
    sentiment: t.sentiment,
    momentumPct: t.changePct,
  }));

  const live = await liveXTopics();
  for (const l of live) {
    if (topics.some((t) => t.topic.toLowerCase() === l.query.toLowerCase())) continue;
    topics.push({
      topic: l.query,
      volume: l.posts,
      sentiment: split({ positive: 0, neutral: 0, negative: 0 }),
      momentumPct: null,
    });
  }

  const facts = [
    `collected posts in the last ${hours} hours: ${current.length}`,
    `previous ${hours} hours: ${previous.length}`,
    `platforms: ${[...new Set(current.map((i) => i.platform))].join(", ") || "none"}`,
  ];

  const written = topics.length > 0 ? await writeIntel({ topics, live, facts }) : null;

  const payload: OverviewIntel = {
    generatedAt: new Date().toISOString(),
    trending: written?.trending ?? [],
    joinable: written?.joinable ?? [],
    insights: written?.insights ?? [],
    recommendations: written?.recommendations ?? [],
  };

  // A failed generation must not overwrite a good cache.
  if (written || !cached) {
    await admin
      .from("overview_intel")
      .upsert(
        { key: INTEL_KEY, payload, generated_at: payload.generatedAt },
        { onConflict: "key" },
      );
  } else {
    return { ...(cached.payload as OverviewIntel), generatedAt: cached.generated_at };
  }

  return payload;
}
