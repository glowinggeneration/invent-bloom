/**
 * The pipeline between the collectors and the mentions feed:
 *
 *   raw actor results -> relevance -> normalise -> deduplicate ->
 *   classify -> sentiment -> /mentions
 *
 * Nothing an actor returns is trusted straight into the feed. A broad search
 * result that never names the federation or its president is discarded, and
 * every surviving item is stored once, keyed on platform + external id.
 */
import {
  SOURCES,
  UnavailableSource,
  runActor,
  ACTORS,
  type RawMention,
} from "./apify-collect.server";
import {
  WATCHED_PROFILES,
  classifyEntities,
  matchKeywords,
  type ApifyPlatform,
} from "./apify-sources";

export type SweepSourceResult = {
  key: string;
  label: string;
  status: "ok" | "unavailable" | "error";
  collected: number;
  relevant: number;
  stored: number;
  message: string | null;
};

type Verdict = { sentiment: "positive" | "neutral" | "negative"; score: number; reason: string };

/**
 * Reads how each item lands for the federation, in one batched call. A model
 * failure is never fatal: the item is stored neutral and still reaches the
 * feed.
 */
async function scoreSentiment(items: RawMention[]): Promise<Map<string, Verdict>> {
  const out = new Map<string, Verdict>();
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey || !items.length) return out;

  const batches: RawMention[][] = [];
  for (let i = 0; i < items.length; i += 40) batches.push(items.slice(i, i + 40));

  for (const batch of batches) {
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
                "You judge how each public post or article reads FOR Football Kenya Federation (FKF) and its president Hussein Mohammed.",
                "Kenyan English, Sheng and Kiswahili are common; read sarcasm and slang in context.",
                "negative: scandal, corruption, court cases, bans, criticism, fan or player grievances, mockery.",
                "positive: wins, investment, sponsorship, facilities, praise, milestones, grassroots progress.",
                "neutral: fixtures, plain announcements, coverage with no clear upside or damage.",
                "score: -5 (very damaging) to +5 (very good). reason: one short plain-English sentence.",
                'Return strict JSON: {"results":[{"id":string,"sentiment":"positive"|"negative"|"neutral","score":number,"reason":string}]}',
              ].join(" "),
            },
            {
              role: "user",
              content: JSON.stringify(
                batch.map((m) => ({
                  id: `${m.platform}:${m.externalId}`,
                  platform: m.platform,
                  author: m.authorName ?? m.authorHandle,
                  text: `${m.title ?? ""} ${m.content ?? ""}`.trim().slice(0, 400),
                })),
              ),
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!response.ok) continue;
      const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as {
        results?: { id?: string; sentiment?: string; score?: number; reason?: string }[];
      };
      for (const r of parsed.results ?? []) {
        const id = String(r.id ?? "");
        if (!id) continue;
        const sentiment =
          r.sentiment === "positive" || r.sentiment === "negative" ? r.sentiment : "neutral";
        out.set(id, {
          sentiment,
          score: Number.isFinite(r.score) ? Number(r.score) : 0,
          reason: String(r.reason ?? "").trim(),
        });
      }
    } catch {
      // Leave this batch unscored; the rows still store as neutral.
    }
  }
  return out;
}

async function recordStatus(result: SweepSourceResult): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("apify_source_status").upsert(
    {
      source_key: result.key,
      label: result.label,
      status: result.status,
      message: result.message,
      items_last_run: result.collected,
      stored_last_run: result.stored,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source_key" },
  );
}

/** Relevance, classification, deduplication and storage for one lane's haul. */
async function storeMentions(items: RawMention[]): Promise<{ relevant: number; stored: number }> {
  const relevant = items.filter(
    (m) =>
      matchKeywords(m.title, m.content, m.authorName, m.authorHandle, JSON.stringify(m.raw))
        .length > 0,
  );
  if (!relevant.length) return { relevant: 0, stored: 0 };

  // One row per item within the batch: actors happily return the same post
  // under two different search queries.
  const seen = new Set<string>();
  const unique = relevant.filter((m) => {
    const key = `${m.platform}:${m.externalId}`;
    if (seen.has(key) || seen.has(m.url)) return false;
    seen.add(key);
    seen.add(m.url);
    return true;
  });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  // Already-stored items are dropped before writing, so a re-run never adds a
  // second copy of the same post — by id or by canonical URL.
  const { data: existing } = await admin
    .from("apify_mentions")
    .select("platform, external_id, url")
    .in("url", unique.map((m) => m.url).slice(0, 500));
  const known = new Set<string>();
  for (const row of (existing ?? []) as { platform: string; external_id: string; url: string }[]) {
    known.add(`${row.platform}:${row.external_id}`);
    known.add(row.url);
  }
  const fresh = unique.filter(
    (m) => !known.has(`${m.platform}:${m.externalId}`) && !known.has(m.url),
  );
  if (!fresh.length) return { relevant: unique.length, stored: 0 };

  const verdicts = await scoreSentiment(fresh);

  const rows = fresh.map((m) => {
    const v = verdicts.get(`${m.platform}:${m.externalId}`);
    return {
      platform: m.platform,
      content_type: m.contentType,
      source_label: m.sourceLabel,
      external_id: m.externalId,
      author_name: m.authorName,
      author_handle: m.authorHandle,
      author_avatar: m.authorAvatar,
      title: m.title,
      content: m.content,
      url: m.url,
      thumbnail_url: m.thumbnailUrl,
      published_at: m.publishedAt,
      views: m.views,
      likes: m.likes,
      comments: m.comments,
      shares: m.shares,
      entities: classifyEntities(m.title, m.content, JSON.stringify(m.raw)),
      matched_keywords: matchKeywords(m.title, m.content, m.authorHandle, JSON.stringify(m.raw)),
      sentiment: v?.sentiment ?? "neutral",
      sentiment_score: v?.score ?? 0,
      sentiment_reason: v?.reason ?? null,
      raw_data: m.raw,
    };
  });

  const { error } = await admin
    .from("apify_mentions")
    .upsert(rows, { onConflict: "platform,external_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  return { relevant: unique.length, stored: rows.length };
}

/**
 * Runs every configured lane. One failing platform never costs the sweep: its
 * status is recorded and the rest continue.
 */
export async function runApifySweep(
  only?: string[],
): Promise<{ sources: SweepSourceResult[]; stored: number }> {
  const lanes = only?.length ? SOURCES.filter((s) => only.includes(s.key)) : SOURCES;
  const results: SweepSourceResult[] = [];

  for (const lane of lanes) {
    const result: SweepSourceResult = {
      key: lane.key,
      label: lane.label,
      status: "ok",
      collected: 0,
      relevant: 0,
      stored: 0,
      message: null,
    };
    try {
      const items = await lane.run();
      result.collected = items.length;
      const { relevant, stored } = await storeMentions(items);
      result.relevant = relevant;
      result.stored = stored;
      if (!items.length) {
        result.message = "No public results for this cycle.";
      }
    } catch (err) {
      if (err instanceof UnavailableSource) {
        result.status = "unavailable";
        result.message = err.message;
      } else {
        result.status = "error";
        result.message = "Collection failed for this source.";
        console.error(`Apify lane ${lane.key} failed`, err);
      }
    }
    results.push(result);
    await recordStatus(result);
  }

  return { sources: results, stored: results.reduce((acc, r) => acc + r.stored, 0) };
}

/* ------------------------------------------------------------------ */
/* Official page profiles, shown at the top of Mentions                 */
/* ------------------------------------------------------------------ */

type ProfileRow = {
  platform: ApifyPlatform;
  handle: string;
  display_name: string | null;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  profile_url: string;
  followers: number | null;
  following: number | null;
  posts_count: number | null;
  likes_count: number | null;
  is_verified: boolean;
  fetched_at: string;
};

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const parsed = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};
const s = (v: unknown): string | null => {
  const value = v === null || v === undefined ? "" : String(v).trim();
  return value ? value : null;
};

/**
 * Pulls the federation's own public page on each platform. Platforms that
 * cannot be read are skipped silently — the card simply does not appear.
 */
export async function refreshApifyProfiles(): Promise<{ stored: number; failed: string[] }> {
  const rows: ProfileRow[] = [];
  const failed: string[] = [];
  const now = new Date().toISOString();

  for (const target of WATCHED_PROFILES) {
    try {
      if (target.platform === "instagram") {
        const [item] = await runActor(
          ACTORS.instagram,
          { resultsType: "details", directUrls: [target.url], resultsLimit: 1 },
          { limit: 1, timeoutSeconds: 180 },
        );
        if (!item) throw new Error("no profile");
        rows.push({
          platform: "instagram",
          handle: s(item["username"]) ?? target.handle,
          display_name: s(item["fullName"]),
          description: s(item["biography"]),
          avatar_url: s(item["profilePicUrlHD"] ?? item["profilePicUrl"]),
          banner_url: null,
          profile_url: target.url,
          followers: n(item["followersCount"]),
          following: n(item["followsCount"]),
          posts_count: n(item["postsCount"]),
          likes_count: null,
          is_verified: item["verified"] === true,
          fetched_at: now,
        });
      } else if (target.platform === "tiktok") {
        const [item] = await runActor(
          ACTORS.tiktok,
          {
            profiles: [target.handle],
            resultsPerPage: 5,
            shouldDownloadVideos: false,
            shouldDownloadCovers: false,
            shouldDownloadSubtitles: false,
            shouldDownloadSlideshowImages: false,
            proxyCountryCode: "None",
          },
          { limit: 1, timeoutSeconds: 240 },
        );
        const author = (item?.["authorMeta"] ?? {}) as Record<string, unknown>;
        if (!s(author["name"])) throw new Error("no profile");
        rows.push({
          platform: "tiktok",
          handle: s(author["name"]) ?? target.handle,
          display_name: s(author["nickName"]),
          description: s(author["signature"]),
          avatar_url: s(author["avatar"]),
          banner_url: null,
          profile_url: s(author["profileUrl"]) ?? target.url,
          followers: n(author["fans"]),
          following: n(author["following"]),
          posts_count: n(author["video"]),
          likes_count: n(author["heart"]),
          is_verified: author["verified"] === true,
          fetched_at: now,
        });
      } else if (target.platform === "youtube") {
        const [item] = await runActor(
          ACTORS.youtube,
          {
            startUrls: [{ url: target.url }],
            maxResults: 1,
            maxResultsShorts: 0,
            maxResultStreams: 0,
            downloadSubtitles: false,
          },
          { limit: 1, timeoutSeconds: 240 },
        );
        if (!item) throw new Error("no profile");
        const about = (item["aboutChannelInfo"] ?? {}) as Record<string, unknown>;
        rows.push({
          platform: "youtube",
          handle: (s(item["channelUsername"]) ?? target.handle).replace(/^@/, ""),
          display_name: s(item["channelName"]),
          description: s(item["channelDescription"] ?? about["channelDescription"]),
          avatar_url: s(item["channelAvatarUrl"] ?? about["channelAvatarUrl"]),
          banner_url: s(item["channelBannerUrl"]),
          profile_url: s(item["channelUrl"]) ?? target.url,
          followers: n(item["numberOfSubscribers"] ?? about["numberOfSubscribers"]),
          following: null,
          posts_count: n(item["channelTotalVideos"] ?? about["channelTotalVideos"]),
          likes_count: null,
          is_verified: item["isChannelVerified"] === true,
          fetched_at: now,
        });
      } else if (target.platform === "threads") {
        const [item] = await runActor(
          ACTORS.threads,
          { mode: "user", usernames: [target.handle], max_posts: 10 },
          { limit: 1, timeoutSeconds: 240 },
        );
        if (!item) throw new Error("no profile");
        rows.push({
          platform: "threads",
          handle: s(item["username"]) ?? target.handle,
          display_name: s(item["display_name"]),
          description: null,
          avatar_url: s(item["profile_pic_hd_url"] ?? item["profile_pic_url"]),
          banner_url: null,
          profile_url: s(item["profile_url"]) ?? target.url,
          followers: n(item["follower_count"]),
          following: null,
          posts_count: null,
          likes_count: null,
          is_verified: item["is_verified"] === true,
          fetched_at: now,
        });
      } else if (target.platform === "facebook") {
        // The page scraper returns the page itself: name, intro, picture and
        // the real follower / following / like counts.
        const [item] = await runActor(
          ACTORS.facebookPage,
          { startUrls: [{ url: target.url }] },
          { limit: 1, timeoutSeconds: 240 },
        );
        if (!item) throw new Error("no profile");
        rows.push({
          platform: "facebook",
          handle: s(item["pageName"]) ?? target.handle,
          display_name: (s(item["title"]) ?? "Football Kenya Federation").split("|")[0]!.trim(),
          description: s(item["intro"]),
          avatar_url: s(item["profilePictureUrl"]),
          banner_url: s(item["coverPhotoUrl"]),
          profile_url: s(item["pageUrl"]) ?? target.url,
          followers: n(item["followers"]),
          following: n(item["followings"]),
          posts_count: null,
          likes_count: n(item["likes"]),
          is_verified: item["isBusinessPage"] === true || item["pageVerified"] === true,
          fetched_at: now,
        });
      }
    } catch (err) {
      failed.push(target.platform);
      console.error(`Apify profile ${target.platform} failed`, err);
    }
  }

  // A page with no real audience is a look-alike, not the federation: store
  // nothing rather than a card with fake numbers.
  const real = rows.filter((r) => (r.followers ?? 0) >= 100 || (r.likes_count ?? 0) >= 100);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  // Drop pages we no longer watch, so retired cards disappear.
  const watched = WATCHED_PROFILES.map((p) => p.platform);
  await admin
    .from("apify_profiles")
    .delete()
    .not("platform", "in", `(${watched.join(",")})`);

  if (!real.length) return { stored: 0, failed };

  // A scrape that comes back thin should never blank a card that already had
  // real numbers: keep whatever we already know for the missing fields.
  const { data: existing } = await admin
    .from("apify_profiles")
    .select(
      "platform, handle, display_name, description, avatar_url, banner_url, followers, following, posts_count, likes_count",
    );
  const known = new Map<string, Record<string, any>>(
    ((existing ?? []) as Record<string, any>[]).map((r) => [`${r["platform"]}:${r["handle"]}`, r]),
  );

  const merged = real.map((r) => {
    const prev = known.get(`${r.platform}:${r.handle}`);
    const keep = <T>(next: T, before: T): T =>
      next === null || next === undefined ? before : next;
    const base = prev
      ? {
          ...r,
          display_name: keep(r.display_name, prev["display_name"]),
          description: keep(r.description, prev["description"]),
          avatar_url: keep(r.avatar_url, prev["avatar_url"]),
          banner_url: keep(r.banner_url, prev["banner_url"]),
          followers: keep(r.followers, prev["followers"]),
          following: keep(r.following, prev["following"]),
          posts_count: keep(r.posts_count, prev["posts_count"]),
          likes_count: keep(r.likes_count, prev["likes_count"]),
        }
      : r;
    // The federation's own pages fall back to the FKF crest when a platform
    // hides the picture from the scraper.
    return { ...base, avatar_url: base.avatar_url ?? "/smait-logo.svg" };
  });

  const { error } = await admin
    .from("apify_profiles")
    .upsert(merged, { onConflict: "platform,handle" });
  if (error) throw new Error(error.message);

  return { stored: merged.length, failed };
}
