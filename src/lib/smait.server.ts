import type { Analysis, PersonaReaction } from "./analysis";
import { PERSONAS, type Persona } from "./personas";
import { PERSONA_ENGINE_DOCTRINE, classifyRisk } from "./persona-engine";
import { LEGAL_RISK_DOCTRINE, RISK_LEVEL_LABELS, transformText } from "./legal-risk";
import { logLegalReview, reviewTexts } from "./legal-risk.server";
import { adaptiveBrief, type PersonaStateRow } from "./persona-learning";
import { loadPersonaStates } from "./persona-learning.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";
const CHUNK_SIZE = 20;

type GatewayMessageContent =
  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

function describe(p: Persona, state?: PersonaStateRow): string {
  const traits = Object.entries(p.traits)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
  return `- ${p.id} | ${p.name}, ${p.age}, ${p.role}, ${p.location}. Segment: ${p.segment}. Vibe: ${p.vibe}. Decision style: ${p.decisionStyle}. Platforms: ${p.platforms.join(", ")}.${traits ? ` Traits: ${traits}.` : ""} ${p.profile}${state ? ` Adaptive ${adaptiveBrief(state)}.` : ""}`;
}

async function callGateway(
  apiKey: string,
  system: string,
  content: GatewayMessageContent[],
): Promise<Record<string, unknown>> {
  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
    }),
  });

  if (response.status === 429) {
    throw new Error("Too many requests right now - please try again in a moment.");
  }
  if (response.status === 402) {
    throw new Error("AI credits are exhausted. Please top up to keep testing messages.");
  }
  if (!response.ok) {
    const body = await response.text();
    console.error(`[AI] gateway error ${response.status}: ${body}`);
    throw new Error("The analysis service failed. Please try again.");
  }

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    console.error("[AI] unparseable response", raw.slice(0, 500));
    throw new Error("The analysis came back malformed. Please try again.");
  }
}

const PANEL_SYSTEM = `You are the persona-panel engine for FKF CommsIQ, a Kenyan message-testing platform.

You are given a slice of a 100-persona synthetic panel, research-calibrated on Big Five traits,
Hofstede cultural dimensions for Kenya, and Nairobi digital-behaviour research.

For EVERY persona in the slice, judge how they personally react to the supplied message
(and attached creative or document extract, if any). Be honest and use the full 0-100 range -
weak, generic or tone-deaf messages must score low. Ground reactions in Kenyan reality
(M-Pesa, Sheng, matatu culture, church, upcountry obligation, football fandom, price sensitivity, trust).

Before judging, silently pick the response strategy that persona would take, then let it shape the reaction.

${PERSONA_ENGINE_DOCTRINE}

Return STRICT JSON only:
{ "reactions": [ { "personaId": "<exact id given>", "score": 0-100, "sentiment": "positive"|"neutral"|"negative",
"reaction": "one sentence in that persona's own voice", "likelyAction": "3-5 words e.g. Shares it, Scrolls past, Asks price",
"strategy": "the response strategy that persona would take" } ] }`;

const SYNTHESIS_SYSTEM = `You are the head strategist for FKF CommsIQ.

You receive a message under test and a statistical digest of how a 100-persona Kenyan panel reacted.
Write the verdict and rewrites. Be specific, commercial and Kenyan-literate.
First classify the message (topic, intent, tone, language, risk band), then let that classification drive the rewrites.
Each rewrite must use a DIFFERENT response strategy and a different voice angle.

${PERSONA_ENGINE_DOCTRINE}

${LEGAL_RISK_DOCTRINE}

Return STRICT JSON only:
{
  "summary": "2-3 sentence verdict on how the 100-persona panel reacts",
  "confidence": 0-100 integer,
  "metrics": { "clarity": int, "culturalFit": int, "trust": int, "relevance": int, "callToAction": int, "shareability": int },
  "classification": { "topic": "short label", "intent": "one intent label", "tone": "short label", "language": "English | Kiswahili | Sheng | code-switching", "risk": "low"|"medium"|"high" },
  "risks": ["short risk or objection", ...],
  "suggestions": [ { "title": "short label", "message": "the full rewritten message, ready to send", "rationale": "why it works better for this panel", "strategy": "the response strategy used" } ]
}
risks: 3-5 items. suggestions: exactly 3.`;

export async function runAnalysis(input: {
  text: string;
  imageDataUrl?: string | null;
  attachments?: { name: string; excerpt: string }[];
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<Analysis> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project.");

  const attachmentBlock = input.attachments?.length
    ? `\n\nAttached documents:\n${input.attachments
        .map((a) => `--- ${a.name} ---\n${a.excerpt.slice(0, 6000)}`)
        .join("\n\n")}`
    : "";
  const historyBlock = input.history?.length
    ? `Earlier in this test session:\n${input.history
        .slice(-6)
        .map((h) => `${h.role}: ${h.content}`)
        .join("\n")}\n\n`
    : "";
  const messageBlock = `${historyBlock}Message under test:\n${input.text}${attachmentBlock}`;

  // Personas react through their current learned state, not only their baseline.
  const states = await loadPersonaStates(PERSONAS.map((p) => p.id));

  const chunks: Persona[][] = [];
  for (let i = 0; i < PERSONAS.length; i += CHUNK_SIZE) {
    chunks.push(PERSONAS.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const content: GatewayMessageContent[] = [
        {
          type: "text",
          text: `Panel slice:\n${chunk.map((p) => describe(p, states.get(p.id))).join("\n")}\n\n${messageBlock}`,
        },
      ];
      if (input.imageDataUrl) {
        content.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
      }
      const parsed = await callGateway(apiKey, PANEL_SYSTEM, content);
      const list = Array.isArray(parsed["reactions"]) ? parsed["reactions"] : [];
      return list as Partial<PersonaReaction>[];
    }),
  );

  const byId = new Map<string, Partial<PersonaReaction>>();
  for (const r of results.flat()) {
    if (r && typeof r.personaId === "string") byId.set(r.personaId, r);
  }

  const personaReactions: PersonaReaction[] = PERSONAS.map((p) => {
    const r = byId.get(p.id) ?? {};
    return {
      personaId: p.id,
      name: p.name,
      segment: p.segment,
      location: p.location,
      score: clamp(r.score, 50),
      sentiment: r.sentiment === "positive" || r.sentiment === "negative" ? r.sentiment : "neutral",
      reaction: String(r.reaction ?? "No strong reaction either way."),
      likelyAction: String(r.likelyAction ?? "Scrolls past"),
    };
  });

  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const r of personaReactions) counts[r.sentiment] += 1;
  const total = personaReactions.length || 1;
  const sentiment = {
    positive: Math.round((counts.positive / total) * 100),
    neutral: Math.round((counts.neutral / total) * 100),
    negative: Math.round((counts.negative / total) * 100),
  };

  const sorted = [...personaReactions].sort((a, b) => b.score - a.score);
  const digest = [
    `Panel size: ${total}. Average score: ${Math.round(personaReactions.reduce((s, r) => s + r.score, 0) / total)}.`,
    `Sentiment split: ${sentiment.positive}% positive / ${sentiment.neutral}% neutral / ${sentiment.negative}% negative.`,
    `Strongest advocates:\n${sorted
      .slice(0, 8)
      .map((r) => `- ${r.name} (${r.segment}, ${r.score}): "${r.reaction}"`)
      .join("\n")}`,
    `Hardest rejections:\n${sorted
      .slice(-8)
      .map((r) => `- ${r.name} (${r.segment}, ${r.score}): "${r.reaction}"`)
      .join("\n")}`,
  ].join("\n\n");

  const synthesis = await callGateway(apiKey, SYNTHESIS_SYSTEM, [
    { type: "text", text: `${messageBlock}\n\nPanel digest:\n${digest}` },
  ]);

  const metrics = (synthesis["metrics"] ?? {}) as Record<string, unknown>;
  const rawClass = (synthesis["classification"] ?? {}) as Record<string, unknown>;
  const riskBand = ["low", "medium", "high"].includes(String(rawClass["risk"]))
    ? (String(rawClass["risk"]) as "low" | "medium" | "high")
    : classifyRisk(input.text);
  const suggestions = Array.isArray(synthesis["suggestions"]) ? synthesis["suggestions"] : [];
  const risks = Array.isArray(synthesis["risks"]) ? synthesis["risks"] : [];

  return {
    summary: String(synthesis["summary"] ?? ""),
    // Anchor confidence to the actual panel average so the headline number can
    // never contradict the sentiment split.
    confidence: Math.round(
      0.65 * (personaReactions.reduce((s, r) => s + r.score, 0) / total) +
        0.35 * clamp(synthesis["confidence"], 50),
    ),
    sentiment,
    metrics: {
      clarity: clamp(metrics["clarity"], 50),
      culturalFit: clamp(metrics["culturalFit"], 50),
      trust: clamp(metrics["trust"], 50),
      relevance: clamp(metrics["relevance"], 50),
      callToAction: clamp(metrics["callToAction"], 50),
      shareability: clamp(metrics["shareability"], 50),
    },
    personaReactions,
    classification: {
      topic: String(rawClass["topic"] ?? "General communication"),
      intent: String(rawClass["intent"] ?? "news sharing"),
      tone: String(rawClass["tone"] ?? "neutral"),
      language: String(rawClass["language"] ?? "English"),
      risk: riskBand,
    },
    risks: risks.map(String).slice(0, 5),
    suggestions: suggestions.slice(0, 3).map((s) => {
      const obj = (s ?? {}) as Record<string, unknown>;
      return {
        title: String(obj["title"] ?? "Option"),
        message: String(obj["message"] ?? ""),
        rationale: String(obj["rationale"] ?? ""),
        ...(obj["strategy"] ? { strategy: String(obj["strategy"]) } : {}),
      };
    }),
  };
}

/**
 * Legal-Risk Language Transformation Engine pass over the tested message and
 * the three recommendations: risky wording is rewritten in place, and every
 * transformation is written to the audit trail.
 */
export async function applyLegalReview(
  analysis: Analysis,
  submittedText: string,
): Promise<Analysis> {
  const items = [
    { id: "input", text: submittedText },
    ...analysis.suggestions.map((s, i) => ({ id: `s${i}`, text: s.message })),
  ].filter((i) => i.text.trim());

  const reviews = await reviewTexts(items);

  const toSafety = (id: string) => {
    const rec = reviews.get(id);
    if (!rec || rec.riskLevel === 0) return undefined;
    return {
      level: rec.riskLevel,
      label: RISK_LEVEL_LABELS[rec.riskLevel],
      categories: rec.riskCategories.map((c) => c.replace(/_/g, " ")),
      approvalRequired: rec.approvalRequired.replace(/_/g, " "),
      rewritten: Boolean(rec.revisedText) && rec.revisedText !== rec.originalText,
      note:
        rec.escalationNote ||
        rec.findings[0]?.reason ||
        "Wording adjusted to reduce avoidable legal exposure.",
    };
  };

  const suggestions = analysis.suggestions.map((s, i) => {
    const rec = reviews.get(`s${i}`);
    const safety = toSafety(`s${i}`);
    return {
      ...s,
      ...(rec && rec.revisedText && rec.riskLevel >= 2 ? { message: rec.revisedText } : {}),
      ...(safety ? { legal: safety } : {}),
    };
  });

  // Audit trail (§13) - fire and forget, never blocks the user.
  void Promise.all(
    [...reviews.entries()].map(([id, record]) =>
      logLegalReview({ record, surface: id === "input" ? "tested_message" : "recommendation" }),
    ),
  );

  const inputSafety = toSafety("input");
  return {
    ...analysis,
    suggestions,
    ...(inputSafety ? { legal: inputSafety } : {}),
  };
}

function clamp(n: unknown, fallback = 0): number {
  const value = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}
