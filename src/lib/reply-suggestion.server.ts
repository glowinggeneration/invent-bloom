/**
 * Suggested reply drafting.
 *
 * When a user replies to a mention, the platform reads the tweet being replied
 * to and proposes an objective plus a ready-to-edit reply. Everything is best
 * effort: a failure returns a usable fallback rather than blocking the screen.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

export type ReplySuggestion = {
  objective: string;
  reply: string;
  rationale: string;
  target: { text: string; authorHandle: string; authorName: string } | null;
  /** Present when the model could not be used, so the UI can stay honest. */
  notice: string | null;
};

function buildSystemPrompt(subject: string): string {
  return [
    `You advise the ${subject} communications team on X (Twitter).`,
    "You are given a post the team wants to reply to. Propose one reply.",
    "Rules: factual, calm and respectful; never insult, never mock, never make claims that cannot be verified;",
    "no hashtags unless clearly useful; at most 240 characters; plain and human;",
    "acknowledge a valid complaint before correcting it; do not promise anything specific that has not been announced.",
    "Also give a short campaign objective (max 140 characters) describing what this reply should achieve,",
    "and a one-line rationale explaining why this angle works for this audience.",
    'Return strict JSON only: {"objective":string,"reply":string,"rationale":string}',
  ].join(" ");
}

function fallback(target: ReplySuggestion["target"], notice: string | null): ReplySuggestion {
  const who = target?.authorName || target?.authorHandle || "this supporter";
  return {
    objective: `Respond directly to ${who} with a calm, factual clarification and keep the conversation constructive.`,
    reply: target
      ? "Thank you for raising this. We hear the concern and we are looking into it. We will share accurate information as soon as it is confirmed."
      : "",
    rationale:
      "A short, respectful acknowledgement lowers the temperature while the facts are confirmed.",
    target,
    notice,
  };
}

/** Reads the target post and drafts an objective plus a reply. Never throws. */
export async function suggestReply(input: {
  targetUrl: string;
  /** Optional extra steer from the user. */
  guidance?: string | null;
}): Promise<ReplySuggestion> {
  let target: ReplySuggestion["target"] = null;
  try {
    const { extractTweetId, fetchTweetMetrics } = await import("./twitterapi.server");
    const id = extractTweetId(input.targetUrl);
    if (id) {
      const { tweets } = await fetchTweetMetrics([id]);
      const tweet = tweets[0];
      if (tweet) {
        target = {
          text: tweet.text ?? "",
          authorHandle: tweet.authorHandle ?? "",
          authorName: tweet.authorName || tweet.authorHandle || "",
        };
      }
    }
  } catch {
    /* the suggestion still works without live target metadata */
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey)
    return fallback(target, "AI drafting is not configured, so a standard holding reply was used.");
  if (!target?.text) {
    return fallback(
      target,
      "The target post could not be read, so a standard holding reply was used.",
    );
  }

  const userBlock = [
    `post author: ${target.authorName} (@${target.authorHandle})`,
    `post text: ${target.text}`,
    input.guidance ? `extra guidance from the team: ${input.guidance}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);

  try {
    const { describeSubject, getWorkspaceSettings } = await import("./entity-config.server");
    const subject = describeSubject(await getWorkspaceSettings());
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt(subject) },
          { role: "user", content: userBlock },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const notice =
        res.status === 429
          ? "The AI service is busy right now, so a standard holding reply was used."
          : res.status === 402
            ? "AI credits are exhausted, so a standard holding reply was used."
            : "The suggestion could not be generated, so a standard holding reply was used.";
      return fallback(target, notice);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(
      String(raw)
        .replace(/^```json|```$/g, "")
        .trim(),
    ) as {
      objective?: string;
      reply?: string;
      rationale?: string;
    };
    const reply = String(parsed?.reply ?? "").trim();
    if (!reply)
      return fallback(
        target,
        "The suggestion came back empty, so a standard holding reply was used.",
      );
    return {
      objective:
        String(parsed?.objective ?? "")
          .trim()
          .slice(0, 200) || fallback(target, null).objective,
      reply: reply.slice(0, 280),
      rationale: String(parsed?.rationale ?? "")
        .trim()
        .slice(0, 200),
      target,
      notice: null,
    };
  } catch {
    return fallback(
      target,
      "The suggestion could not be generated, so a standard holding reply was used.",
    );
  }
}
