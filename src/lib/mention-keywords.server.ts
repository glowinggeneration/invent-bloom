/**
 * The topic list the X listening connection searches for. Handle mentions only
 * catch people who tag the federation; keywords catch the conversation that
 * happens around it. The list refreshes daily so new topics get picked up.
 *
 * The managed Monitoring Watchlist feeds relevant priority terms into this
 * existing X listening path. It never schedules engagement or creates another
 * collector, and platform-specific entries for other networks stay out of X.
 */

export const FALLBACK_KEYWORDS = [
  "Football Kenya Federation",
  "FKF",
  "Harambee Stars",
  "FKF Premier League",
  "Kenyan football",
  "FKF president",
];

type WatchKeyword = {
  kind: string;
  label: string | null;
  value: string | null;
  platform: string | null;
  priority: string | null;
};

function canUseInXSearch(row: WatchKeyword): boolean {
  if (row.kind === "keyword") return true;
  const platform = String(row.platform ?? "")
    .trim()
    .toLowerCase();
  return !platform || platform === "x" || platform === "twitter";
}

function watchTerm(row: WatchKeyword): string {
  const value = String(row.value ?? "")
    .trim()
    .replace(/^@/, "");
  if (!value) return "";
  const xIdentity = new Set(["account", "journalist", "official", "influencer", "competitor"]);
  const platform = String(row.platform ?? "").toLowerCase();
  const looksLikeHandle = /^[A-Za-z0-9_]{1,15}$/.test(value);
  if (
    (platform === "x" || platform === "twitter" || !platform) &&
    xIdentity.has(row.kind) &&
    looksLikeHandle
  ) {
    return `@${value}`;
  }
  return value;
}

function uniqueTerms(terms: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    const term = raw.trim();
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Active X listening terms, ordered by operator priority first and learned
 * keywords second. If the Watchlist migration has not been applied yet, the
 * existing keyword table continues to work unchanged.
 */
export async function activeKeywords(limit = 12): Promise<string[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: keywordRows, error: keywordError } = await db
      .from("mention_keywords")
      .select("term")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(Math.max(limit, 60));
    if (keywordError) throw new Error(keywordError.message);

    const learned = ((keywordRows ?? []) as { term: string }[])
      .map((row) => String(row.term ?? "").trim())
      .filter(Boolean);

    let watched: WatchKeyword[] = [];
    try {
      const { data: watchRows, error: watchError } = await db
        .from("monitoring_watchlist")
        .select("kind, label, value, platform, priority")
        .eq("is_active", true)
        .limit(100);
      if (!watchError) watched = (watchRows ?? []) as WatchKeyword[];
    } catch {
      // The platform-control migration may not be applied yet. Monitoring must
      // continue from the existing keyword table rather than fail closed.
      watched = [];
    }

    const priorityRank: Record<string, number> = { critical: 0, high: 1, standard: 2 };
    const priorityTerms = watched
      .filter(canUseInXSearch)
      .sort(
        (a, b) =>
          (priorityRank[String(a.priority ?? "standard")] ?? 9) -
          (priorityRank[String(b.priority ?? "standard")] ?? 9),
      )
      .map(watchTerm)
      .filter(Boolean);

    return uniqueTerms([...priorityTerms, ...learned, ...FALLBACK_KEYWORDS], limit);
  } catch {
    return FALLBACK_KEYWORDS.slice(0, limit);
  }
}

/** Builds an X advanced-search query from the keyword list. */
export function keywordQuery(terms: string[]): string {
  const parts = terms.slice(0, 12).map((t) => (t.includes(" ") ? `"${t.replace(/"/g, "")}"` : t));
  if (!parts.length) return "";
  return `(${parts.join(" OR ")}) -filter:retweets`;
}

/**
 * Asks the model which new topic terms are worth listening to, based on the
 * conversation already being pulled, then stores the ones we do not have.
 * Runs daily from the scheduled hook.
 */
export async function refreshKeywords(): Promise<{ added: string[]; checked: number }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const existing = await activeKeywords(60);
  if (!apiKey) return { added: [], checked: existing.length };

  const { searchTweets } = await import("./twitterapi.server");
  const { tweets } = await searchTweets(keywordQuery(existing.slice(0, 8)), 40);
  const sample = tweets.slice(0, 40).map((t) => t.text.slice(0, 220));

  let suggested: string[] = [];
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
              "You maintain a social listening keyword list for Football Kenya Federation (FKF) and its president.",
              "From the sample posts, propose up to 5 NEW short search terms (2-4 words) that would surface more conversation about the federation, the national teams, the league, its leadership or current controversies.",
              "Skip terms already on the list. Skip generic words like 'football' or 'Kenya' on their own. No hashtags-only terms, no handles.",
              'Return strict JSON: {"terms":[string]}',
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({ existing_terms: existing, sample_posts: sample }),
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (response.ok) {
      const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as {
        terms?: string[];
      };
      suggested = (parsed.terms ?? [])
        .map((t) => String(t ?? "").trim())
        .filter((t) => t.length > 2 && t.length < 60);
    }
  } catch {
    suggested = [];
  }

  const have = new Set(existing.map((t) => t.toLowerCase()));
  const fresh = [...new Set(suggested.filter((t) => !have.has(t.toLowerCase())))].slice(0, 5);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (fresh.length) {
    await (supabaseAdmin as any)
      .from("mention_keywords")
      .insert(
        fresh.map((term) => ({ term, source: "ai", last_refreshed_at: new Date().toISOString() })),
      );
  }
  return { added: fresh, checked: existing.length };
}
