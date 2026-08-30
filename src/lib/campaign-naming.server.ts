/**
 * Campaign naming.
 *
 * Every campaign gets a short, human title that describes what it is about
 * (subject / objective), not how the platform executes it. The model does the
 * naming from whatever context the campaign carries; a deterministic fallback
 * keeps things sane when the model is unavailable.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

export type CampaignNameContext = {
  /** post / reply / like / follow / engagement / intercept … */
  actionType: string;
  objective?: string | null;
  content?: string | null;
  targetUrl?: string | null;
  targetText?: string | null;
  keywords?: string[];
  hashtags?: string[];
  handles?: string[];
};

export type CampaignName = { name: string; summary: string };

const GENERIC = new Set([
  "",
  "campaign",
  "new campaign",
  "untitled campaign",
  "untitled",
  "reply campaign",
  "post campaign",
  "like campaign",
  "follow campaign",
  "engagement campaign",
  "mixed campaign",
  "listening campaign",
  "social campaign",
]);

/** True when a stored name is a placeholder we are free to replace. */
export function isGenericName(name: string | null | undefined) {
  const n = String(name ?? "")
    .trim()
    .toLowerCase();
  return GENERIC.has(n) || /^campaign\s*\d*$/.test(n);
}

function titleCase(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((w) => (w.length > 3 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Best-effort title without the model: strongest words in the campaign text. */
function fallbackName(ctx: CampaignNameContext): CampaignName {
  const source = [
    ctx.objective,
    ctx.content,
    ctx.targetText,
    (ctx.hashtags ?? []).join(" "),
    (ctx.keywords ?? []).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#@]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!source) {
    const who = (ctx.handles ?? []).slice(0, 2).join(", ");
    return {
      name: who ? titleCase(`${who} outreach`) : "Kenyan Football Activity",
      summary: "",
    };
  }
  const words = source.split(" ").slice(0, 6).join(" ");
  return { name: titleCase(words), summary: source.slice(0, 110) };
}

function contextBlock(ctx: CampaignNameContext) {
  return [
    `action type: ${ctx.actionType}`,
    ctx.objective ? `objective: ${ctx.objective}` : "",
    ctx.content ? `content: ${ctx.content}` : "",
    ctx.targetText ? `target post: ${ctx.targetText}` : "",
    ctx.targetUrl ? `target link: ${ctx.targetUrl}` : "",
    ctx.keywords?.length ? `keywords: ${ctx.keywords.join(", ")}` : "",
    ctx.hashtags?.length ? `hashtags: ${ctx.hashtags.join(", ")}` : "",
    ctx.handles?.length ? `accounts: ${ctx.handles.slice(0, 12).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}

const SYSTEM = [
  "You name social media campaigns for Football Kenya Federation communications staff.",
  "Given campaign context, return a title of 2 to 6 words describing the SUBJECT or OBJECTIVE,",
  "never the mechanism. Never output generic names like Campaign, New Campaign, Reply Campaign,",
  "Engagement Campaign or Social Campaign. Also return a one-line summary of at most 90 characters.",
  'Return strict JSON only: {"name":string,"summary":string}',
].join(" ");

/** Names a single campaign. Never throws. */
export async function generateCampaignName(ctx: CampaignNameContext): Promise<CampaignName> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const fallback = fallbackName(ctx);
  if (!apiKey) return fallback;
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: contextBlock(ctx) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return fallback;
    const json: any = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(
      String(raw)
        .replace(/^```json|```$/g, "")
        .trim(),
    );
    const name = String(parsed?.name ?? "").trim();
    const summary = String(parsed?.summary ?? "").trim();
    if (!name || isGenericName(name)) return fallback;
    return { name: name.slice(0, 70), summary: summary.slice(0, 120) };
  } catch {
    return fallback;
  }
}

/** Names a freshly created publish job and stores the result. Never throws. */
export async function nameCampaignJob(
  admin: any,
  jobId: string | null | undefined,
  ctx: CampaignNameContext,
) {
  if (!jobId) return;
  try {
    const { name, summary } = await generateCampaignName(ctx);
    await admin.from("publish_jobs").update({ name, summary }).eq("id", jobId);
  } catch {
    /* naming is best effort */
  }
}
