import {
  LEGAL_RISK_DOCTRINE,
  approvalFor,
  assessLegalRisk,
  transformText,
  type LegalReviewRecord,
  type RiskLevel,
} from "./legal-risk";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

export type ReviewItem = { id: string; text: string; personaVoice?: string };

/**
 * Runs the deterministic transformation first, then asks the model to repair
 * anything still risky while keeping the persona voice. Falls back to the
 * deterministic result whenever the model is unavailable or unhelpful.
 */
export async function reviewTexts(items: ReviewItem[]): Promise<Map<string, LegalReviewRecord>> {
  const out = new Map<string, LegalReviewRecord>();
  for (const item of items) out.set(item.id, transformText(item.text));

  const needsModel = items.filter((i) => {
    const rec = out.get(i.id)!;
    // Level 4 is never auto-repaired; level 0/1 deterministic swaps suffice.
    return rec.riskLevel >= 2 && rec.riskLevel < 4;
  });
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!needsModel.length || !apiKey) return out;

  const system = [
    "You are the Legal-Risk Language Transformation Engine.",
    LEGAL_RISK_DOCTRINE,
    "Rewrite ONLY the risky wording. Keep length, language mix (English/Kiswahili/Sheng), tone and persona voice.",
    "Do not add new facts, do not soften a lawful demand for accountability, do not turn the message into legal boilerplate.",
    'Return strict JSON: {"items":[{"id":string,"revised":string,"persona_preserved":boolean,"facts_changed":boolean,"confidence":number}]}',
  ].join(" ");

  const user = needsModel
    .map((i) => {
      const rec = out.get(i.id)!;
      const flags = rec.findings
        .map((f) => `${f.category} (level ${f.level}): "${f.segment}" - ${f.reason}`)
        .join("; ");
      return [
        `id: ${i.id}`,
        i.personaVoice ? `persona voice: ${i.personaVoice}` : "",
        `text: ${i.text}`,
        `flagged: ${flags || "none"}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n---\n");

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
      console.error(`[legal-risk] gateway ${response.status}`);
      return out;
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = (payload.choices?.[0]?.message?.content ?? "")
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(raw) as {
      items?: {
        id?: string;
        revised?: string;
        persona_preserved?: boolean;
        facts_changed?: boolean;
        confidence?: number;
      }[];
    };

    for (const entry of parsed.items ?? []) {
      const id = String(entry.id ?? "");
      const base = out.get(id);
      const revised = (entry.revised ?? "").trim();
      if (!base || !revised) continue;
      const residual = assessLegalRisk(revised);
      // Only accept the model rewrite when it is genuinely safer.
      if (residual.level > base.riskLevel) continue;
      out.set(id, {
        ...base,
        revisedText: revised,
        personaPreserved: entry.persona_preserved !== false,
        factsChanged: entry.facts_changed === true,
        confidence: Math.min(1, Math.max(0, Number(entry.confidence ?? base.confidence))),
        approvalRequired: approvalFor(Math.max(residual.level, base.riskLevel) as RiskLevel),
        escalationNote:
          residual.level >= 3
            ? "Residual high risk after rewrite - senior or legal approval required."
            : base.escalationNote,
        autoPublishAllowed: residual.level <= 2 && !entry.facts_changed,
      });
    }
  } catch (e) {
    console.error("[legal-risk] review threw", e);
  }
  return out;
}

/** Persists the audit record required by the engine (§13). Never throws. */
export async function logLegalReview(input: {
  record: LegalReviewRecord;
  surface: string;
  userId?: string | null;
  personaId?: string | null;
  reference?: string | null;
}): Promise<void> {
  if (input.record.riskLevel === 0) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("legal_reviews").insert({
      surface: input.surface,
      user_id: input.userId ?? null,
      persona_id: input.personaId ?? null,
      reference: input.reference ?? null,
      original_text: input.record.originalText,
      revised_text: input.record.revisedText,
      risk_level: input.record.riskLevel,
      risk_categories: input.record.riskCategories,
      findings: JSON.parse(JSON.stringify(input.record.findings)),
      function_preserved: input.record.functionPreserved,
      persona_preserved: input.record.personaPreserved,
      facts_changed: input.record.factsChanged,
      approval_required: input.record.approvalRequired,
      confidence: input.record.confidence,
      escalation_note: input.record.escalationNote || null,
      auto_publish_allowed: input.record.autoPublishAllowed,
    });
    if (error) console.error("[legal-risk] audit insert failed", error.message);
  } catch (e) {
    console.error("[legal-risk] audit threw", e);
  }
}
