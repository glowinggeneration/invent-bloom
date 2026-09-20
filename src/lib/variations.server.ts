import {
  DEFAULT_INTENSITY,
  DEFAULT_TONE,
  voiceDirective,
  type PublishTone,
} from "./voice-controls";
import { type Persona } from "./personas";
import {
  DISTINCTIVENESS_RULES,
  PERSONA_ENGINE_DOCTRINE,
  RESPONSE_STRATEGIES,
  classifyRisk,
  selectPersonasForPost,
} from "./persona-engine";
import { LEGAL_RISK_DOCTRINE } from "./legal-risk";
import { logLegalReview, reviewTexts } from "./legal-risk.server";
import { adaptiveBrief, similarityPenalty } from "./persona-learning";
import { loadPersonaStates, recordPersonaOutcome } from "./persona-learning.server";
import { TWEET_LIMIT, clampTweet } from "./publish";
import { voiceCard, voiceCardBrief } from "./persona-voice";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

/**
 * Records this gateway call to ai_events (with its estimated cost, per
 * §9.8/§9.7) - this call site had no observability at all before. Never
 * blocks the actual variation generation it's describing.
 */
async function recordVariationsEvent(meta: {
  userId: string | null;
  workspaceId: string;
  startedAt: number;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | undefined;
  outcome: "success" | "failure";
  failureReason?: string;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAiEvent } = await import("./platform/ai-observability.server");
    const response: { content: string; provider: string; model: string } & Partial<{
      inputTokens: number;
      outputTokens: number;
    }> = { content: "", provider: "lovable-gateway", model: MODEL };
    if (typeof meta.usage?.prompt_tokens === "number")
      response.inputTokens = meta.usage.prompt_tokens;
    if (typeof meta.usage?.completion_tokens === "number")
      response.outputTokens = meta.usage.completion_tokens;
    await recordAiEvent(supabaseAdmin as any, {
      userId: meta.userId,
      workspaceId: meta.workspaceId,
      feature: "publish.persona_variations",
      startedAt: meta.startedAt,
      outcome:
        meta.outcome === "success"
          ? { ok: true, attempts: 1, fallbackUsed: false, response }
          : { ok: false, attempts: 1, error: meta.failureReason ?? "unknown error" },
    });
  } catch (err) {
    console.error("[variations] observability logging failed", err);
  }
}

export type AccountVariation = {
  accountId: string;
  handle: string;
  personaId: string;
  personaName: string;
  tweetText: string;
  commentText: string;
};

function describe(p: Persona, brief?: string) {
  const base = `${p.name} - ${p.age}, ${p.role} in ${p.location}. Segment: ${p.segment}. Vibe: ${p.vibe}. Decision style: ${p.decisionStyle}. ${p.profile}`;
  return brief ? `${base} Adaptive ${brief}` : base;
}

function trim(text: string) {
  const clean = text
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clampTweet(clean);
}

// Emoji sets keyed by the kind of character a persona has, so a calm health
// worker never sounds like a hype fan account.
const EMOJI_SETS: { match: RegExp; emojis: string[] }[] = [
  { match: /fan|ultra|hype|bold|loud|extra|glam/i, emojis: ["🔥", "⚽️", "🙌", "💯", "😤", "🇰🇪"] },
  { match: /tech|engineer|data|analyst|design/i, emojis: ["📈", "🧠", "⚡️", "👀", "🛠️"] },
  { match: /health|calm|heal|teacher|mentor/i, emojis: ["🙏", "💚", "🌿", "✨", "🤍"] },
  { match: /music|food|chef|dj|creative|stylist/i, emojis: ["🎧", "🍲", "💃", "🎶", "✨"] },
  { match: /athlete|coach|sport|disciplin/i, emojis: ["💪", "🏃🏾‍♂️", "⚽️", "🥇", "⏱️"] },
  { match: /business|trader|hustle|entrepreneur|farmer/i, emojis: ["💼", "📊", "🤝", "🚀", "🇰🇪"] },
];

function emojisFor(persona: Persona, count: number) {
  const key = `${persona.segment} ${persona.vibe} ${persona.role}`;
  const set = EMOJI_SETS.find((s) => s.match.test(key))?.emojis ?? ["⚽️", "🇰🇪", "✨", "👏", "💬"];
  const seed = persona.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: count }, (_, i) => set[(seed + i * 3) % set.length]!);
}

// Deterministic, offline-safe variation used when the AI gateway is
// unavailable or returns duplicate text - every account still posts something
// shaped by its persona instead of an identical copy.
function localVariation(text: string, persona: Persona, slot = 0) {
  if (!text.trim()) return "";
  const seed = persona.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + slot;
  const openers = [
    "",
    "Honestly, ",
    "Real talk: ",
    "Ok but ",
    "Kwanza ",
    "Listen, ",
    "Swali ni hii: ",
    "From where I sit, ",
    "Simple: ",
    "Si tuseme ukweli, ",
    "Not convinced yet - ",
    "Years of watching this and ",
  ];
  const closers = [
    "",
    " Tuko pamoja.",
    " That's the story.",
    " Big up.",
    " Watching this closely.",
    " Ama namna gani?",
    " Let's see the receipts.",
    " Hiyo ndio point.",
    " Next step matters more.",
    " We move.",
  ];
  const opener = openers[seed % openers.length]!;
  const closer = closers[(seed * 3 + slot) % closers.length]!;
  const [e1, e2] = emojisFor(persona, 2);
  const body = opener ? opener + text.charAt(0).toLowerCase() + text.slice(1) : text;
  return trim(`${body}${closer} ${e1}${seed % 3 === 0 ? e2 : ""}`.trim());
}

/**
 * Rewrites the same core message once per account, each in the voice of a
 * randomly chosen persona profile. Falls back to the original text if the
 * AI call fails so publishing never blocks.
 */
export async function buildPersonaVariations(input: {
  accounts: { id: string; handle: string }[];
  tweetText: string;
  commentText: string;
  /**
   * When true the supplied text is a brief/objective, not a post: each persona
   * writes their own original post that serves the objective.
   */
  objectiveMode?: boolean;
  /** Requested tone for every variation ("auto" lets each persona choose). */
  tone?: PublishTone;
  /** How strongly the tone is expressed, 1-5. */
  intensity?: number;
  /** Operator briefing on how personas should frame their replies. */
  briefing?: string;
  workspaceId: string;
  /** Optional - only used for observability/cost attribution, never for
   *  authorization (that's already handled by the caller's own middleware). */
  userId?: string | null;
}): Promise<AccountVariation[]> {
  // Publishing mode (scope 7.5/8.5): only personas with a credible reason to
  // join this conversation, spread across segments.
  const personas = selectPersonasForPost(
    `${input.tweetText} ${input.commentText}`.trim(),
    input.accounts.length,
  );
  const assignments = input.accounts.map((a, i) => ({ account: a, persona: personas[i]! }));

  const fallback = (): AccountVariation[] =>
    assignments.map(({ account, persona }, i) => ({
      accountId: account.id,
      handle: account.handle,
      personaId: persona.id,
      personaName: persona.name,
      tweetText: localVariation(input.tweetText, persona, i),
      commentText: localVariation(input.commentText, persona, i),
    }));

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return fallback();
  if (!input.tweetText && !input.commentText) return fallback();

  // Adaptive Persona Learning Engine: pull each persona's learned behaviour
  // layer so replies reflect how that persona has evolved.
  const states = await loadPersonaStates(assignments.map((a) => a.persona.id));

  const risk = classifyRisk(`${input.tweetText} ${input.commentText}`);

  const objective = input.objectiveMode === true;

  const system = [
    objective
      ? "You are a social-media strategist. You are given a communications OBJECTIVE (a brief), not a post. Write an original post for each persona account that achieves that objective in their own words."
      : "You rewrite one core message into distinct social-media voices for X (Twitter).",
    PERSONA_ENGINE_DOCTRINE,
    `Pick one response strategy per persona from: ${RESPONSE_STRATEGIES.join("; ")}.`,
    `Distinctiveness is mandatory: ${DISTINCTIVENESS_RULES.join(" ")}`,
    risk === "low"
      ? "Content risk: low - routine tone is fine."
      : `Content risk: ${risk} - stay factual, measured and non-inflammatory; no claims that would need legal or governance verification.`,
    objective
      ? "Do not copy, quote or paraphrase the brief. Decide what this persona would actually say to advance the objective: their own angle, example, question or reaction, in their own voice. Never state the objective openly or sound like marketing instructions."
      : "Each variation must keep the same meaning, facts and intent as the original, but sound like it was written by that specific Kenyan persona: their tone, slang level, punctuation habits and priorities.",
    objective
      ? "Vary the angle across accounts: some react, some ask a question, some share a personal take, some add a fact or a call to action. Together they should feel like real, separate people responding to the same moment."
      : "",
    voiceDirective(input.tone ?? DEFAULT_TONE, input.intensity ?? DEFAULT_INTENSITY),
    (input.briefing ?? "").trim()
      ? `Operator briefing - every variation must follow it while staying in persona: ${(input.briefing ?? "").trim()}`
      : "",
    "Every account must get a genuinely different wording: change the opening, the sentence order, the length and the register. Two identical or near-identical variations are a failure.",
    "Each account is given a STYLE CARD. Obey it literally: the opening move, sentence shape, word-count band, register, language mix, punctuation habit and emoji rule are fixed per account. Personas that share a segment must still sound like different people because their style cards differ.",
    "Before writing, silently check the batch: if two replies would start with the same word, repeat a phrase, or land on the same argument, rewrite one of them.",
    "Use emojis naturally: 1-3 per variation, placed where that persona would actually put them, and matched to their character (hype fans lean 🔥⚽️🙌, analysts lean 📈🧠👀, calm/health voices lean 🙏💚✨, creatives lean 🎧✨💃). Never repeat the same emoji combination across two accounts, and never open every variation with an emoji.",
    `Hard limit: ${TWEET_LIMIT} characters per variation, counting hashtags and emojis. Aim for under 300 and never exceed the limit. No hashtags unless the original had them. Never mention the persona by name and never say you are an AI.`,

    LEGAL_RISK_DOCTRINE,
    'Return strict JSON: {"variations":[{"handle":string,"tweet":string,"comment":string}]} with one entry per handle given, in the same order.',
  ]
    .filter(Boolean)
    .join(" ");

  const user = [
    objective
      ? `Objective for the post: ${input.tweetText || "(none)"}`
      : `Original tweet text: ${input.tweetText || "(none)"}`,
    objective
      ? `Objective for the reply/comment: ${input.commentText || "(none)"}`
      : `Original comment text: ${input.commentText || "(none)"}`,
    "",
    "Accounts, their persona voices and the STYLE CARD each one must obey (the style card is binding: it fixes the opening move, sentence shape, length, register, language mix, punctuation and emoji use):",
    ...assignments.map(
      ({ account, persona }, i) =>
        `@${account.handle} => ${describe(persona, adaptiveBrief(states.get(persona.id)))}\n   ${voiceCardBrief(voiceCard(i))}`,
    ),
  ].join("\n");

  const startedAt = Date.now();
  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!response.ok) {
      console.error(`[variations] gateway ${response.status}`);
      void recordVariationsEvent({
        userId: input.userId ?? null,
        workspaceId: input.workspaceId,
        startedAt,
        outcome: "failure",
        failureReason: `http_${response.status}`,
      });
      return fallback();
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    void recordVariationsEvent({
      userId: input.userId ?? null,
      workspaceId: input.workspaceId,
      startedAt,
      usage: payload.usage,
      outcome: "success",
    });
    const raw = (payload.choices?.[0]?.message?.content ?? "")
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(raw) as {
      variations?: { handle?: string; tweet?: string; comment?: string }[];
    };
    const list = parsed.variations ?? [];

    const output = assignments.map(({ account, persona }, i) => {
      const match =
        list.find(
          (v) => (v.handle ?? "").replace(/^@/, "").toLowerCase() === account.handle.toLowerCase(),
        ) ?? list[i];
      return {
        accountId: account.id,
        handle: account.handle,
        personaId: persona.id,
        personaName: persona.name,
        tweetText: input.tweetText
          ? trim(match?.tweet || localVariation(input.tweetText, persona, i))
          : "",
        commentText: input.commentText
          ? trim(match?.comment || localVariation(input.commentText, persona, i))
          : "",
      };
    });

    // No two accounts may post the same words: rewrite collisions (and any
    // variation that came back as the untouched original) in the persona's own
    // shape, and make sure each one carries at least one emoji.
    const seenTweets = new Set<string>();
    const seenComments = new Set<string>();
    for (const [idx, o] of output.entries()) {
      const persona = assignments[idx]!.persona;
      const norm = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      if (o.tweetText) {
        if (seenTweets.has(norm(o.tweetText)) || norm(o.tweetText) === norm(input.tweetText)) {
          o.tweetText = localVariation(input.tweetText, persona, idx);
        }
        seenTweets.add(norm(o.tweetText));
        if (!/\p{Extended_Pictographic}/u.test(o.tweetText)) {
          o.tweetText = trim(`${o.tweetText} ${emojisFor(persona, 1)[0]}`);
        }
      }
      if (o.commentText) {
        if (
          seenComments.has(norm(o.commentText)) ||
          norm(o.commentText) === norm(input.commentText)
        ) {
          o.commentText = localVariation(input.commentText, persona, idx);
        }
        seenComments.add(norm(o.commentText));
        if (!/\p{Extended_Pictographic}/u.test(o.commentText)) {
          o.commentText = trim(`${o.commentText} ${emojisFor(persona, 1)[0]}`);
        }
      }
    }

    // Legal-Risk Language Transformation Engine: rewrite risky wording before
    // anything can be queued for publishing, and audit every change.
    const reviews = await reviewTexts(
      [
        ...output.map((o) => ({
          id: `t:${o.accountId}`,
          text: o.tweetText,
          personaVoice: o.personaName,
        })),
        ...output.map((o) => ({
          id: `c:${o.accountId}`,
          text: o.commentText,
          personaVoice: o.personaName,
        })),
      ].filter((i) => i.text.trim()),
    );

    for (const [idx, o] of output.entries()) {
      for (const [key, field] of [
        ["t", "tweetText"],
        ["c", "commentText"],
      ] as const) {
        const rec = reviews.get(`${key}:${o.accountId}`);
        if (!rec || rec.riskLevel === 0) continue;
        void logLegalReview({
          workspaceId: input.workspaceId,
          record: rec,
          surface: "persona_variation",
          personaId: o.personaId,
          reference: o.handle,
        });
        // Critical risk yields no publishable version; fall back to the
        // reviewed original so the account never posts the unsafe wording.
        o[field] = rec.riskLevel >= 4 ? "" : trim(rec.revisedText || o[field]);
      }
      if (!o.tweetText && input.tweetText) {
        o.tweetText = localVariation(input.tweetText, assignments[idx]!.persona, idx);
      }
    }

    // Learning signals: a distinct, usable variation is a positive outcome; a
    // reply that fell back to the original text counts as a regeneration.
    const penalty = similarityPenalty(output.map((o) => o.tweetText || o.commentText));
    if (penalty > 0.45) {
      console.warn(`[variations] persona convergence detected (similarity ${penalty})`);
    }
    await Promise.all(
      output.map((o) =>
        recordPersonaOutcome({
          personaId: o.personaId,
          outcome: o.tweetText === input.tweetText ? "regenerated" : "approved_unchanged",
          note: "persona variation generated for publishing",
          recentPhrase: (o.tweetText || o.commentText).split(/[.!?]/)[0] ?? "",
          evidenceStrength: Math.max(0.2, 0.6 - penalty),
          confidence: 0.6,
        }),
      ),
    );

    return output;
  } catch (e) {
    console.error("[variations] failed", e);
    void recordVariationsEvent({
      userId: input.userId ?? null,
      workspaceId: input.workspaceId,
      startedAt,
      outcome: "failure",
      failureReason: e instanceof Error ? e.message.slice(0, 200) : "unknown error",
    });
    return fallback();
  }
}
