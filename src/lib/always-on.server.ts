/**
 * Always-On content generation.
 *
 * Turns a persona's daily plan (src/lib/always-on.ts) into concrete, reviewed
 * drafts: one AI pass per account per day, optional Unsplash support where an
 * image adds value, then the legal review and the quality/cooldown gate before
 * anything is allowed to be scheduled.
 */

import {
  ALWAYS_ON_DOCTRINE,
  CATEGORY_LABELS,
  type ContentCategory,
  type DailyPlan,
  type PostCandidate,
  type QualityScores,
  type RecentPost,
  reviewCandidate,
} from "./always-on";
import { LEGAL_RISK_DOCTRINE, RISK_LEVEL_LABELS } from "./legal-risk";
import { logLegalReview, reviewTexts } from "./legal-risk.server";
import type { Persona } from "./personas";
import { PERSONA_ENGINE_DOCTRINE } from "./persona-engine";
import { TWEET_LIMIT, clampTweet } from "./publish";
import { searchUnsplash } from "./unsplash.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

export type GeneratedPost = {
  slotIndex: number;
  category: ContentCategory;
  topic: string;
  content: string;
  imageUrl: string | null;
  imageId: string | null;
  imageCreditName: string | null;
  imageCreditUrl: string | null;
  scheduledAt: string;
  status: "scheduled" | "held";
  quality: QualityScores;
  legal: {
    level: number;
    label: string;
    rewritten: boolean;
    note: string;
  } | null;
  reviewNotes: string;
};

function trim(text: string) {
  const clean = text
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clampTweet(clean);
}

function slotDate(planDate: string, minute: number): string {
  // Plans are built in East Africa Time (UTC+3), the personas' local day.
  const utcMinutes = minute - 180;
  const base = new Date(`${planDate}T00:00:00.000Z`);
  base.setUTCMinutes(base.getUTCMinutes() + utcMinutes);
  return base.toISOString();
}

function describe(persona: Persona) {
  return `${persona.name} - ${persona.age}, ${persona.role} in ${persona.location}. Segment: ${persona.segment}. Vibe: ${persona.vibe}. Decision style: ${persona.decisionStyle}. Platforms: ${persona.platforms.join(", ")}. ${persona.profile}`;
}

type Draft = {
  slot: number;
  topic: string;
  text: string;
  image_query?: string;
  uses_facts?: boolean;
  scores?: Partial<QualityScores>;
};

async function generateDrafts(input: {
  persona: Persona;
  plan: DailyPlan;
  campaignBrief: string;
  avoidTopics: string[];
  avoidOpenings: string[];
}): Promise<Draft[]> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const slotLines = input.plan.slots
    .map(
      (s) =>
        `slot ${s.index}: ${CATEGORY_LABELS[s.category]} at ${s.time} local${s.wantsImage ? " (image welcome)" : ""}`,
    )
    .join("\n");

  const body = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content: [
          ALWAYS_ON_DOCTRINE,
          PERSONA_ENGINE_DOCTRINE,
          LEGAL_RISK_DOCTRINE,
          'Return strict JSON: {"posts":[{"slot":0,"topic":"short topic slug","text":"the post","image_query":"unsplash search or empty","uses_facts":false,"scores":{"personaConsistency":0.0,"relevance":0.0,"originality":0.0,"factualIntegrity":1,"platformSuitability":0.0}}]}. Score honestly - low scores are discarded rather than published.',
        ].join("\n\n"),
      },
      {
        role: "user",
        content: [
          `Persona: ${describe(input.persona)}`,
          `Local day: ${input.plan.date} (${input.plan.activityType} poster, ${input.plan.target} posts).`,
          `Write one post per slot, each in this persona's own voice:\n${slotLines}`,
          input.plan.campaignCount > 0 && input.campaignBrief
            ? `Campaign slots must express this approved point through the persona's own perspective, never as a slogan: ${input.campaignBrief}`
            : "No campaign is running today - every post is ordinary persona content.",
          input.avoidTopics.length
            ? `Do not repeat these recent topics: ${input.avoidTopics.join(", ")}.`
            : "",
          input.avoidOpenings.length
            ? `Do not open with these phrasings: ${input.avoidOpenings.join(" / ")}.`
            : "",
          "Only suggest image_query for slots marked image welcome, and only when a photo genuinely adds value. Never describe the photo as the persona's own.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    response_format: { type: "json_object" },
  };

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`AI gateway request failed [${res.status}]: ${await res.text()}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { posts?: Draft[] };
  return parsed.posts ?? [];
}

/**
 * Builds the reviewed, schedulable posts for one account's daily plan.
 * Posts that fail quality, cooldown, diversity or legal review are returned
 * with status "held" and the reasons, never silently published.
 */
export async function generatePlanContent(input: {
  persona: Persona;
  plan: DailyPlan;
  campaignBrief?: string;
  recent: RecentPost[];
  peerPosts?: { content: string; personaId: string }[];
  userId?: string;
  workspaceId: string;
}): Promise<GeneratedPost[]> {
  const drafts = await generateDrafts({
    persona: input.persona,
    plan: input.plan,
    campaignBrief: input.campaignBrief ?? "",
    avoidTopics: [...new Set(input.recent.map((r) => r.topic).filter(Boolean))].slice(0, 12),
    avoidOpenings: input.recent.slice(0, 6).map((r) => r.content.split(" ").slice(0, 4).join(" ")),
  });

  const byslot = new Map(drafts.map((d) => [Number(d.slot), d]));

  // Legal-Risk Language Transformation Engine over the whole day at once.
  const legalRecords = await reviewTexts(
    input.plan.slots
      .map((s) => ({
        id: `slot:${s.index}`,
        text: byslot.get(s.index)?.text ?? "",
        personaVoice: input.persona.name,
      }))
      .filter((i) => i.text.trim()),
  );

  const out: GeneratedPost[] = [];
  const acceptedToday: { content: string; personaId: string }[] = [...(input.peerPosts ?? [])];

  for (const slot of input.plan.slots) {
    const draft = byslot.get(slot.index);
    const scheduledAt = slotDate(input.plan.date, slot.minute);

    if (!draft?.text?.trim()) {
      out.push({
        slotIndex: slot.index,
        category: slot.category,
        topic: "",
        content: "",
        imageUrl: null,
        imageId: null,
        imageCreditName: null,
        imageCreditUrl: null,
        scheduledAt,
        status: "held",
        quality: {
          personaConsistency: 0,
          relevance: 0,
          originality: 0,
          factualIntegrity: 1,
          platformSuitability: 0,
        },
        legal: null,
        reviewNotes: "No usable draft was produced for this slot.",
      });
      continue;
    }

    let text = trim(draft.text);
    const legalRecord = legalRecords.get(`slot:${slot.index}`);
    let legal: GeneratedPost["legal"] = null;
    if (legalRecord) {
      legal = {
        level: legalRecord.riskLevel,
        label: RISK_LEVEL_LABELS[legalRecord.riskLevel],
        rewritten: legalRecord.revisedText !== legalRecord.originalText,
        note: legalRecord.escalationNote || legalRecord.findings[0]?.reason || "",
      };
      if (legalRecord.riskLevel > 0) {
        void logLegalReview({
          workspaceId: input.workspaceId,
          record: legalRecord,
          surface: "always_on_post",
          personaId: input.persona.id,
          ...(input.userId ? { userId: input.userId } : {}),
        });
      }
      if (legalRecord.riskLevel >= 4 || !legalRecord.autoPublishAllowed) {
        out.push({
          slotIndex: slot.index,
          category: slot.category,
          topic: draft.topic ?? "",
          content: trim(legalRecord.revisedText || text),
          imageUrl: null,
          imageId: null,
          imageCreditName: null,
          imageCreditUrl: null,
          scheduledAt,
          status: "held",
          quality: {
            personaConsistency: 0,
            relevance: 0,
            originality: 0,
            factualIntegrity: 1,
            platformSuitability: 0,
          },
          legal,
          reviewNotes: `Held by legal review (${RISK_LEVEL_LABELS[legalRecord.riskLevel].toLowerCase()}).`,
        });
        continue;
      }
      if (legalRecord.revisedText) text = trim(legalRecord.revisedText);
    }

    // Unsplash support only where the plan allows it and the model asked.
    let photo: Awaited<ReturnType<typeof searchUnsplash>> = null;
    if (slot.wantsImage && draft.image_query?.trim()) {
      try {
        photo = await searchUnsplash(draft.image_query.trim(), slot.index);
      } catch {
        photo = null;
      }
    }

    const scores: QualityScores = {
      personaConsistency: draft.scores?.personaConsistency ?? 0.85,
      relevance: draft.scores?.relevance ?? 0.8,
      originality: draft.scores?.originality ?? 0.8,
      factualIntegrity: draft.scores?.factualIntegrity ?? 1,
      platformSuitability: draft.scores?.platformSuitability ?? 0.95,
      ...(photo ? { imageRelevance: 0.85 } : {}),
    };

    const candidate: PostCandidate = {
      content: text,
      topic: draft.topic ?? "",
      category: slot.category,
      imageId: photo?.id ?? null,
      quality: scores,
      usesFacts: draft.uses_facts === true,
    };

    const verdict = reviewCandidate({
      candidate,
      recent: input.recent,
      peerPosts: acceptedToday,
    });

    if (verdict.ok) acceptedToday.push({ content: text, personaId: input.persona.id });

    out.push({
      slotIndex: slot.index,
      category: slot.category,
      topic: draft.topic ?? "",
      content: text,
      imageUrl: photo?.backgroundUrl ?? null,
      imageId: photo?.id ?? null,
      imageCreditName: photo?.photographerName ?? null,
      imageCreditUrl: photo?.photographerUrl ?? null,
      scheduledAt,
      status: verdict.ok ? "scheduled" : "held",
      quality: scores,
      legal,
      reviewNotes: verdict.ok ? "" : verdict.reasons.join(" · "),
    });
  }

  return out;
}
