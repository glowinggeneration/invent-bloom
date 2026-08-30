/**
 * AI translation through Lovable AI Gateway. This is the fastest engine we
 * have (one server round-trip, no third-party auth popup), so it runs first
 * and Puter.js / LibreTranslate stay as fallbacks.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Fast, cheap model — translation needs speed, not deep reasoning. */
export const AI_TRANSLATION_MODEL = "google/gemini-3.6-flash";

const SYSTEM = [
  "You are a translation engine for a Kenyan football communications platform.",
  "Input may mix English, Kiswahili, Sheng and slang.",
  "Keep @handles, #hashtags, links, emojis and numbers unchanged, and keep the original tone.",
  'Return ONLY JSON in the shape {"translations":["..."]} with one entry per input item, in the same order.',
  "No explanations, no notes, no markdown fences.",
].join(" ");

/** Translates a batch of strings in one gateway call. Throws on failure. */
export async function aiTranslate(texts: string[], targetLanguage: string): Promise<string[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project.");

  const items = texts.map((t) => String(t ?? ""));
  const payload = items.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: AI_TRANSLATION_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Translate each numbered item into ${targetLanguage}.\n\n${payload}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI translation failed (${res.status}) ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI translation returned malformed output");
  }

  const list = (parsed as { translations?: unknown })?.translations;
  if (!Array.isArray(list)) throw new Error("AI translation returned no translations");

  return items.map((original, i) => {
    const value = String(list[i] ?? "").trim();
    return value || original;
  });
}
