/** Unsplash search helper - abstract artwork picked from a persona description. */

export type UnsplashPhoto = {
  id: string;
  avatarUrl: string;
  backgroundUrl: string;
  color: string | null;
  photographerName: string;
  photographerUrl: string;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "her",
  "his",
  "she",
  "they",
  "them",
  "with",
  "that",
  "this",
  "for",
  "are",
  "from",
  "into",
  "very",
  "who",
  "him",
  "has",
  "have",
  "off",
  "instantly",
  "completely",
  "heavily",
  "highly",
  "moderately",
  "values",
  "responds",
  "loves",
  "relies",
  "frequents",
  "turn",
  "turns",
  "him",
]);

/**
 * Distil a persona into a short abstract-art search query.
 * We deliberately avoid people/portrait words - the user asked for abstract
 * textures only.
 */
export function personaQuery(input: { vibe: string; segment: string; profile: string }): string {
  const words = `${input.vibe} ${input.segment}`
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
    .slice(0, 3);
  const seed = words.length > 0 ? words.join(" ") : "gradient";
  return `abstract ${seed} texture`;
}

/**
 * Distil a persona into a people/portrait search query - used for the avatars
 * of connected X accounts, which should look like real profile photos.
 */
export function portraitQuery(input: { vibe: string; segment: string }): string {
  const words = `${input.vibe} ${input.segment}`
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
    .slice(0, 2);
  const seed = words.length > 0 ? words.join(" ") : "african";
  return `portrait african person ${seed} face`;
}

/** Search Unsplash and return one photo, or null when nothing matches. */
export async function searchUnsplash(
  query: string,
  seed: number,
  orientation: "landscape" | "portrait" | "squarish" = "landscape",
): Promise<UnsplashPhoto | null> {
  const key = process.env["UNSPLASH_ACCESS_KEY"];
  if (!key) throw new Error("UNSPLASH_ACCESS_KEY is not configured.");

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "12");
  url.searchParams.set("content_filter", "high");
  url.searchParams.set("orientation", orientation);

  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${key}`,
      "Accept-Version": "v1",
    },
  });
  if (!res.ok) {
    throw new Error(`Unsplash returned ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as {
    results?: {
      id: string;
      color: string | null;
      urls: { raw: string; regular: string; small: string };
      user: { name: string; links: { html: string } };
    }[];
  };
  const results = body.results ?? [];
  if (results.length === 0) return null;

  const pick = results[seed % results.length]!;
  const raw = pick.urls.raw;
  return {
    id: pick.id,
    avatarUrl: `${raw}&w=200&h=200&fit=crop&crop=entropy&q=80`,
    backgroundUrl: `${raw}&w=1200&h=420&fit=crop&crop=entropy&q=80`,
    color: pick.color,
    photographerName: pick.user.name,
    photographerUrl: pick.user.links.html,
  };
}
