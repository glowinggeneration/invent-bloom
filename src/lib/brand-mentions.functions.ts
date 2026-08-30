import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BRAND_PROFILE_HANDLES } from "./brand-profiles";

export type MentionSentiment = "positive" | "neutral" | "negative";

export type BrandMention = {
  id: string;
  text: string;
  authorHandle: string;
  authorName: string;
  url: string;
  createdAt: string | null;
  likeCount: number;
  viewCount: number;
  mentions: string[];
  sentiment: MentionSentiment;
  sentimentScore: number;
  isVerified: boolean;
  /** The post is a reply inside a conversation, not a standalone post. */
  isReply: boolean;
  /** Handle being replied to, when known. */
  replyToHandle: string;
  /** The reply is aimed at one of the tracked federation accounts. */
  replyToBrand: boolean;
  /** Short plain-language reason for the sentiment label. */
  sentimentReason: string;
  /** Exact spans in `text` that triggered the sentiment, for highlighting. */
  sentimentHighlights: SentimentHighlight[];
  /** The post being replied to, read for context when scoring sentiment. */
  parentText: string;
  parentAuthorHandle: string;
  parentAuthorName: string;
  /** How the post was found: tagged the federation, or matched a watched topic. */
  source: "mention" | "keyword";
  /** The topic term that surfaced a keyword post. */
  matchedKeyword: string;
};

/** A word or phrase in the post that pushed the sentiment score. */
export type SentimentHighlight = {
  start: number;
  end: number;
  polarity: "positive" | "negative";
  reason: string;
};

/** Turns raw API text into the readable post: entities decoded, link clutter removed. */
function cleanTweetText(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/https?:\/\/t\.co\/\w+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * X hides the pile of @handles a reply is addressed to and shows only the
 * body. Strip the leading run of mentions so the card reads like the post.
 */
function stripLeadingMentions(text: string): string {
  const body = text.replace(/^(?:@[A-Za-z0-9_]{1,15}[\s,]+)+/, "").trim();
  return body.length > 0 ? body : text;
}

const POSITIVE = [
  "congrat",
  "congratulations",
  "well done",
  "proud",
  "great",
  "good",
  "excellent",
  "love",
  "thank",
  "asante",
  "hongera",
  "support",
  "win",
  "winning",
  "victory",
  "best",
  "amazing",
  "strong",
  "happy",
  "bravo",
  "kudos",
  "welcome",
  "nice",
  "improve",
  "hope",
  "goal",
];
const NEGATIVE = [
  "corrupt",
  "shame",
  "disgrace",
  "fail",
  "failure",
  "poor",
  "worst",
  "bad",
  "angry",
  "disappoint",
  "useless",
  "resign",
  "scandal",
  "fraud",
  "steal",
  "thief",
  "embarrass",
  "nonsense",
  "incompetent",
  "hate",
  "sad",
  "aibu",
  "mess",
  "chaos",
  "protest",
  "boycott",
  "lie",
  "lies",
  "unfair",
  "wrong",
  "sack",
  "crisis",
];

/**
 * Criticism that never uses an obviously negative word: challenges to act,
 * accusations of empty talk, and demands. These are the posts that read as
 * "neutral" to a plain lexicon but are hostile to the federation/president.
 */
const CRITICISM_PHRASES: { pattern: RegExp; weight: number; reason: string }[] = [
  {
    pattern: /\bwalk the talk\b/i,
    weight: 2,
    reason: "challenges the federation to act on its words",
  },
  {
    pattern:
      /\bcosmetic\b|\blip service\b|\bempty (promises|words|talk)\b|\bpr stunt\b|\bwindow dressing\b/i,
    weight: 2,
    reason: "calls the statements empty or cosmetic",
  },
  {
    pattern: /\bstop (these|the|your)\b|\benough (is enough|of)\b|\bno more\b/i,
    weight: 1,
    reason: "demands the federation stop something",
  },
  {
    pattern: /\bdemoraliz|\bdemoralis|\bfrustrat|\bneglect|\bignor(e|ed|ing)\b|\bsideline/i,
    weight: 2,
    reason: "says people are being harmed, ignored or demoralised",
  },
  {
    pattern:
      /\breduc(ed|ing|tion)\b|\bcut (the|our|slots|budget)\b|\bslots? (has|have)? ?been reduced\b/i,
    weight: 1,
    reason: "flags cuts or reduced opportunities",
  },
  {
    pattern:
      /\bwhere is (the|our)\b|\bwhy (are|is|has|have) (you|the federation|fkf)\b|\bexplain yourself\b|\banswer us\b/i,
    weight: 1,
    reason: "demands answers from the federation",
  },
  {
    pattern: /\bstep down\b|\bmust go\b|\bkick out\b|\bwe are tired\b|\btumechoka\b/i,
    weight: 2,
    reason: "calls for leadership to go",
  },
  {
    pattern: /\bstill waiting\b|\bnothing has changed\b|\bsame old\b|\bnever deliver/i,
    weight: 2,
    reason: "says nothing has changed",
  },
  // Common misspellings and Sheng/Kiswahili criticism a plain word list misses.
  {
    pattern: /\bdis+a+p+oint\w*\b|\bdissapoint\w*\b|\bdisapoint\w*\b/i,
    weight: 2,
    reason: "calls the federation a disappointment",
  },
  {
    pattern: /\bmafisadi\b|\bwezi\b|\bwizi\b|\bfala\b|\bupuzi\b|\bmavi\b|\bhaki yetu\b/i,
    weight: 2,
    reason: "Kiswahili or Sheng insult or accusation",
  },
  {
    pattern:
      /\byou (have been|are|guys are|people are)\b[^.!?]{0,40}\b(total|complete|absolute|joke|shame|failure|disgrace|disappoint\w*|dissapoint\w*)\b/i,
    weight: 2,
    reason: "accuses the account directly",
  },
  {
    pattern: /\bwhat a (joke|shame|mess)\b|\bclown(s)?\b|\bcircus\b|\bshambles\b/i,
    weight: 2,
    reason: "mocks the federation",
  },
];

/** Praise phrasing that a single-word list also misses. */
const PRAISE_PHRASES: { pattern: RegExp; weight: number; reason: string }[] = [
  {
    pattern:
      /\bkeep it up\b|\bgood work\b|\bwell handled\b|\bproud of\b|\bthank you\b|\basante sana\b/i,
    weight: 2,
    reason: "praises the federation directly",
  },
  {
    pattern: /\bbig up\b|\bwell deserved\b|\bfinally\b.{0,20}\b(good|right)\b/i,
    weight: 1,
    reason: "positive acknowledgement",
  },
];

/**
 * Short replies that only read as hostile once you see the post they answer:
 * "you have failed", "hapo umeboa", "never again". Applied only when the
 * parent post is known and comes from the federation or the president.
 */
const CONTEXT_DEPENDENT_NEGATIVE: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\byou (have|guys|people|lot|are)\b|\bnyinyi\b|\bwewe\b/i,
    reason: "answers the federation's own post with an accusation",
  },
  { pattern: /\bnever again\b|\bnot again\b|\bagain\?/i, reason: "rejects the federation's post" },
  {
    pattern: /\bumeboa\b|\bhamna\b|\bhakuna\b|\bwapi\b/i,
    reason: "dismisses what the federation posted",
  },
];

type SentimentResult = {
  sentiment: MentionSentiment;
  score: number;
  reason: string;
  highlights: SentimentHighlight[];
};

/** Collects every match of a pattern as a highlight span. */
function collectMatches(
  text: string,
  pattern: RegExp,
  polarity: "positive" | "negative",
  reason: string,
  out: SentimentHighlight[],
): boolean {
  const re = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );
  let found = false;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match[0].length === 0) {
      re.lastIndex += 1;
      continue;
    }
    found = true;
    out.push({ start: match.index, end: match.index + match[0].length, polarity, reason });
  }
  return found;
}

/** Drops overlapping spans, keeping the longest (most specific) match. */
function dedupeHighlights(spans: SentimentHighlight[]): SentimentHighlight[] {
  const sorted = [...spans].sort((a, b) => b.end - b.start - (a.end - a.start));
  const kept: SentimentHighlight[] = [];
  for (const span of sorted) {
    if (kept.some((k) => span.start < k.end && k.start < span.end)) continue;
    kept.push(span);
  }
  return kept.sort((a, b) => a.start - b.start);
}

/** Quick negative/positive tally used to read the post being replied to. */
function quickPolarity(text: string): number {
  const value = text.toLowerCase();
  let n = 0;
  for (const w of POSITIVE) if (value.includes(w)) n += 1;
  for (const w of NEGATIVE) if (value.includes(w)) n -= 1;
  for (const p of CRITICISM_PHRASES) if (p.pattern.test(text)) n -= p.weight;
  for (const p of PRAISE_PHRASES) if (p.pattern.test(text)) n += p.weight;
  return n;
}

/**
 * Lexicon plus criticism-phrase sentiment. Conversation context matters: a
 * reply aimed straight at the federation or the president carries more weight
 * than a passing mention, and the post being replied to is read too, so short
 * replies that only read as hostile in context are not softened to neutral.
 */
function scoreSentiment(
  text: string,
  ctx: {
    isReply: boolean;
    replyToBrand: boolean;
    parentText?: string;
    parentFromBrand?: boolean;
  } = { isReply: false, replyToBrand: false },
): SentimentResult {
  const value = text.toLowerCase();
  let score = 0;
  const reasons: string[] = [];
  const spans: SentimentHighlight[] = [];

  for (const w of POSITIVE) {
    if (value.includes(w)) {
      score += 1;
      collectMatches(
        text,
        new RegExp(`\\w*${escapeRe(w)}\\w*`, "gi"),
        "positive",
        `positive word "${w}"`,
        spans,
      );
    }
  }
  for (const w of NEGATIVE) {
    if (value.includes(w)) {
      score -= 1;
      collectMatches(
        text,
        new RegExp(`\\w*${escapeRe(w)}\\w*`, "gi"),
        "negative",
        `negative word "${w}"`,
        spans,
      );
    }
  }

  for (const p of CRITICISM_PHRASES) {
    if (collectMatches(text, p.pattern, "negative", p.reason, spans)) {
      score -= p.weight;
      reasons.push(p.reason);
    }
  }
  for (const p of PRAISE_PHRASES) {
    if (collectMatches(text, p.pattern, "positive", p.reason, spans)) {
      score += p.weight;
      reasons.push(p.reason);
    }
  }

  if (/[!]{2,}/.test(value) && score < 0) score -= 1;

  // Read the post being replied to. A reply that answers the federation's own
  // post and pushes back at it is criticism even when the wording is mild.
  const parent = (ctx.parentText ?? "").trim();
  if (parent && score <= 0) {
    const parentScore = quickPolarity(parent);
    if (ctx.parentFromBrand || ctx.replyToBrand) {
      for (const p of CONTEXT_DEPENDENT_NEGATIVE) {
        if (collectMatches(text, p.pattern, "negative", p.reason, spans)) {
          score -= 1;
          reasons.push(p.reason);
          break;
        }
      }
      // Pushback on an upbeat federation announcement reads as criticism.
      if (score === 0 && parentScore > 0 && /\bbut\b|\bhowever\b|\blakini\b|\?/.test(value)) {
        score -= 1;
        reasons.push("pushes back on the federation's own announcement");
      }
    }
    // Piling onto an already critical thread keeps the negative reading.
    if (score === 0 && parentScore < 0) {
      score -= 1;
      reasons.push("agrees with a critical post in the thread");
    }
  }

  // A critical reply pointed at the federation or president is a direct hit.
  if (score < 0 && ctx.replyToBrand) {
    score -= 1;
    reasons.push("posted as a direct reply to the federation");
  } else if (score < 0 && ctx.isReply) {
    reasons.push("posted inside a reply thread");
  }

  const sentiment: MentionSentiment = score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
  const reason = reasons.length
    ? reasons.slice(0, 2).join("; ")
    : sentiment === "neutral"
      ? "no clear praise or criticism"
      : sentiment === "negative"
        ? "critical wording"
        : "supportive wording";
  // Neutral posts have nothing decisive to point at.
  const highlights = sentiment === "neutral" ? [] : dedupeHighlights(spans);
  return { sentiment, score, reason, highlights };
}

function escapeRe(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type AiSentiment = {
  sentiment: MentionSentiment;
  score: number;
  reason: string;
  /** False when a topic-search post turns out not to be about the federation. */
  relevant: boolean;
};

/**
 * Reads each mention with AI, in context of the post it replies to. Keyword
 * lists miss sarcasm, insults and code-switched Kiswahili/Sheng, so the model
 * decides and the lexicon only stands in when the call fails. It also screens
 * topic-search finds so unrelated chatter never reaches the list.
 */
async function classifyWithAi(
  items: {
    id: string;
    text: string;
    parentText: string;
    replyToBrand: boolean;
    fromKeyword?: boolean;
  }[],
): Promise<Map<string, AiSentiment>> {
  const out = new Map<string, AiSentiment>();
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey || items.length === 0) return out;

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
              "You judge how each public post feels ABOUT Football Kenya Federation (FKF) and its president.",
              "Posts mix English, Kiswahili and Sheng. Read sarcasm, insults, rhetorical questions and complaints as negative even when single words look upbeat.",
              "Insults aimed at the federation ('you people are fools'), complaints about broadcasting, governance, pay or opportunities are negative.",
              "Praise, excitement or enjoyment is positive: compliments about matches, players, schools, coverage or the federation's work, congratulations, celebration emojis (🔥 ⚽ 👏 ❤️), phrases like 'beauty to watch', 'proud of you', 'well done'.",
              "Enthusiasm counts as positive even when the federation is only tagged and not praised by name — a happy post about the football it runs is good news for the brand.",
              "Reserve neutral for posts with no feeling at all: plain facts, fixtures, links, or straight questions.",

              "score: -5 (very damaging) to +5 (very supportive). reason: one short plain-English sentence explaining the post, in the user's words, no jargon or quoted keyword lists.",
              "relevant: true only when the post is really about Kenyan football, the federation, its teams, league or leadership. Posts found by topic search that turn out to be about something else (other countries, betting spam, unrelated news) are relevant: false.",
              'Return strict JSON: {"results":[{"id":string,"sentiment":"positive"|"negative"|"neutral","score":number,"reason":string,"relevant":boolean}]}',
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify(
              items.map((i) => ({
                id: i.id,
                replying_to_federation: i.replyToBrand,
                found_by_topic_search: Boolean(i.fromKeyword),
                post_being_replied_to: i.parentText.slice(0, 400),
                post: i.text.slice(0, 600),
              })),
            ),
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) return out;
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as {
      results?: {
        id?: string;
        sentiment?: string;
        score?: number;
        reason?: string;
        relevant?: boolean;
      }[];
    };
    for (const r of parsed.results ?? []) {
      const id = String(r.id ?? "");
      const sentiment =
        r.sentiment === "positive" || r.sentiment === "negative" ? r.sentiment : "neutral";
      if (!id) continue;
      out.set(id, {
        sentiment,
        score: Number.isFinite(r.score)
          ? Number(r.score)
          : sentiment === "negative"
            ? -2
            : sentiment === "positive"
              ? 2
              : 0,
        reason: String(r.reason ?? "").trim(),
        relevant: r.relevant !== false,
      });
    }
  } catch {
    return out;
  }
  return out;
}

/**
 * Recent public posts mentioning the tracked federation accounts, so Brand
 * Health can show who is talking about them and hand the post straight to
 * Publish for a persona response.
 */
export const listBrandMentions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { cursor?: string } | undefined) => ({ cursor: data?.cursor ?? "" }))
  .handler(
    async ({
      context,
      data,
    }): Promise<{ mentions: BrandMention[]; error: string | null; nextCursor: string | null }> => {
      const { searchTweets, fetchTweetMetrics } = await import("./twitterapi.server");
      const { activeKeywords, keywordQuery } = await import("./mention-keywords.server");

      const { data: accounts } = await context.supabase.from("x_accounts").select("handle");
      const ours = new Set(
        [...(accounts ?? []).map((a: any) => String(a.handle ?? "")), ...BRAND_PROFILE_HANDLES].map(
          (h) => h.replace(/^@/, "").toLowerCase(),
        ),
      );
      const brandHandles = new Set(
        BRAND_PROFILE_HANDLES.map((h) => h.replace(/^@/, "").toLowerCase()),
      );

      const query = `(${BRAND_PROFILE_HANDLES.map((h) => `@${h}`).join(" OR ")}) -filter:retweets`;
      const { tweets, error, nextCursor } = await searchTweets(
        query,
        100,
        data.cursor || undefined,
      );

      // Topic listening: personas also watch conversations that never tag the
      // federation. Only on the first page, so paging stays on the handle feed.
      const keywordIds = new Set<string>();
      let keywordTweets: typeof tweets = [];
      let activeTerms: string[] = [];
      if (!data.cursor) {
        activeTerms = await activeKeywords();
        const q = keywordQuery(activeTerms);
        if (q) {
          try {
            const found = await searchTweets(q, 40);
            keywordTweets = found.tweets;
            for (const t of keywordTweets) keywordIds.add(t.id);
          } catch {
            keywordTweets = [];
          }
        }
      }

      const seen = new Set<string>();
      const candidates = [...tweets, ...keywordTweets].filter((t) => {
        if (ours.has(t.authorHandle.toLowerCase())) return false;
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      // Read the post each reply answers, so context decides the sentiment.
      const parentIds = [...new Set(candidates.map((t) => t.replyToTweetId).filter(Boolean))].slice(
        0,
        100,
      );
      const parents = new Map<string, { text: string; handle: string; name: string }>();
      if (parentIds.length) {
        const { tweets: parentTweets } = await fetchTweetMetrics(parentIds);
        for (const p of parentTweets) {
          parents.set(p.tweetId, {
            text: stripLeadingMentions(cleanTweetText(p.text)),
            handle: p.authorHandle.replace(/^@/, ""),
            name: p.authorName || p.authorHandle,
          });
        }
      }

      const mentions: BrandMention[] = candidates
        .map((t) => {
          const full = cleanTweetText(t.text);
          const text = stripLeadingMentions(full);
          // The API flag is not always present; a leading @handle run is X's
          // own marker that the post is addressed into a conversation.
          const leadingMentions = /^(?:@[A-Za-z0-9_]{1,15}[\s,]+)+/.exec(full)?.[0] ?? "";
          const addressed = (leadingMentions.match(/@[A-Za-z0-9_]{1,15}/g) ?? []).map((h) =>
            h.slice(1).toLowerCase(),
          );
          const isReply = t.isReply || addressed.length > 0;
          const parent = t.replyToTweetId ? parents.get(t.replyToTweetId) : undefined;
          const replyToHandle = t.replyToHandle || parent?.handle || addressed[0] || "";
          const replyToBrand =
            isReply &&
            (brandHandles.has(replyToHandle.toLowerCase()) ||
              addressed.some((h) => brandHandles.has(h)));
          const parentFromBrand = parent ? brandHandles.has(parent.handle.toLowerCase()) : false;
          const { sentiment, score, reason, highlights } = scoreSentiment(text, {
            isReply,
            replyToBrand,
            parentText: parent?.text ?? "",
            parentFromBrand,
          });

          return {
            id: t.id,
            text,
            authorHandle: t.authorHandle,
            authorName: t.authorName,
            url: t.url,
            createdAt: t.createdAt,
            likeCount: t.likeCount,
            viewCount: t.viewCount,
            mentions: BRAND_PROFILE_HANDLES.filter((h) =>
              full.toLowerCase().includes(`@${h.toLowerCase()}`),
            ) as string[],
            sentiment,
            sentimentScore: score,
            isVerified: t.isVerified,
            isReply,
            replyToHandle,
            replyToBrand,
            sentimentReason: reason,
            sentimentHighlights: highlights,
            parentText: parent?.text ?? "",
            parentAuthorHandle: parent?.handle ?? "",
            parentAuthorName: parent?.name ?? "",
            source: keywordIds.has(t.id) ? ("keyword" as const) : ("mention" as const),
            matchedKeyword: keywordIds.has(t.id)
              ? (activeTerms.find((k) => full.toLowerCase().includes(k.toLowerCase())) ?? "")
              : "",
          };
        })
        .filter((m) => m.text.length > 0)
        .slice(0, 100);

      // AI has the final say on sentiment, and screens keyword finds so only
      // posts genuinely about the federation reach the list.
      const ai = await classifyWithAi(
        mentions.map((m) => ({
          id: m.id,
          text: m.text,
          parentText: m.parentText ?? "",
          replyToBrand: Boolean(m.replyToBrand),
          fromKeyword: m.source === "keyword",
        })),
      );
      for (const m of mentions) {
        const verdict = ai.get(m.id);
        if (!verdict) continue;
        m.sentiment = verdict.sentiment;
        m.sentimentScore = verdict.score;
        if (verdict.reason) m.sentimentReason = verdict.reason;
        if (verdict.sentiment === "neutral") m.sentimentHighlights = [];
      }

      const relevant = mentions
        .filter((m) => m.source === "mention" || ai.get(m.id)?.relevant !== false)
        .slice(0, 100);

      // Keep a history of what we saw, so Overview can compare periods.
      try {
        const { storeXMentions } = await import("./x-mentions-store.server");
        await storeXMentions(relevant);
      } catch (err) {
        console.error("Storing X mentions failed", err);
      }

      return { mentions: relevant, error: relevant.length ? null : error, nextCursor };
    },
  );

export type MentionOutcome = {
  tweetId: string;
  published: number;
  failed: number;
  scheduled: number;
  lastPublishedAt: string | null;
};

/** Pulls a tweet id out of any x.com/twitter.com status URL. */
function tweetIdFromUrl(url: string | null): string {
  const m = /status\/(\d+)/.exec(url ?? "");
  return m?.[1] ?? "";
}

/**
 * Reply outcomes per mention: how many persona replies actually published,
 * how many failed, how many are still queued, and when the last one landed.
 */
export const listMentionOutcomes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ outcomes: MentionOutcome[] }> => {
    const byTweet = new Map<string, MentionOutcome>();
    const bump = (tweetId: string): MentionOutcome => {
      let row = byTweet.get(tweetId);
      if (!row) {
        row = { tweetId, published: 0, failed: 0, scheduled: 0, lastPublishedAt: null };
        byTweet.set(tweetId, row);
      }
      return row;
    };

    const { data: jobs } = await context.supabase
      .from("publish_jobs")
      .select("target_tweet_url, publish_actions(status, action_type, updated_at)")

      .not("target_tweet_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    for (const job of (jobs ?? []) as any[]) {
      const tweetId = tweetIdFromUrl(job.target_tweet_url);
      if (!tweetId) continue;
      const row = bump(tweetId);
      for (const a of (job.publish_actions ?? []) as any[]) {
        if (a.action_type && a.action_type !== "comment" && a.action_type !== "reply") continue;
        if (a.status === "success") {
          row.published += 1;
          if (!row.lastPublishedAt || a.updated_at > row.lastPublishedAt) {
            row.lastPublishedAt = a.updated_at;
          }
        } else if (a.status === "failed") {
          row.failed += 1;
        } else {
          row.scheduled += 1;
        }
      }
    }

    const { data: queued } = await context.supabase
      .from("scheduled_actions")
      .select("target_tweet_id, status, updated_at, action_type")

      .not("target_tweet_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);

    for (const a of (queued ?? []) as any[]) {
      if (a.action_type && a.action_type !== "comment" && a.action_type !== "reply") continue;
      const row = bump(String(a.target_tweet_id));
      if (a.status === "done" || a.status === "success") {
        row.published += 1;
        if (!row.lastPublishedAt || a.updated_at > row.lastPublishedAt) {
          row.lastPublishedAt = a.updated_at;
        }
      } else if (a.status === "failed") {
        row.failed += 1;
      } else {
        row.scheduled += 1;
      }
    }

    return { outcomes: [...byTweet.values()] };
  });
