/**
 * Collection layer. Every non-X platform reaches the mentions feed through an
 * Apify actor called from here — server-only, so the Apify token never leaves
 * the backend.
 *
 * Each lane is one actor call with its own input shape and its own output
 * shape; no two actors agree on either, so every lane has an explicit mapper
 * into the one `RawMention` structure the rest of the pipeline understands.
 *
 * Lanes that cannot legitimately read public data (Snapchat search, Instagram
 * Stories without a session) return `unavailable` rather than fabricating
 * rows.
 */
import { getApifyToken } from "./apify.server";
import {
  CORE_QUERIES,
  FACEBOOK_GROUPS,
  FACEBOOK_PAGES,
  HASHTAGS,
  INSTAGRAM_ACCOUNTS,
  INSTAGRAM_STORY_ACCOUNTS,
  SEARCH_QUERIES,
  SNAPCHAT_PROFILES,
  sourceLabel,
  type ApifyContentType,
  type ApifyPlatform,
  type ApifySourceKey,
} from "./apify-sources";

/** One collected item, before relevance, sentiment and storage. */
export type RawMention = {
  platform: ApifyPlatform;
  contentType: ApifyContentType;
  sourceLabel: string;
  externalId: string;
  authorName: string | null;
  authorHandle: string | null;
  authorAvatar: string | null;
  title: string | null;
  content: string | null;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  raw: Record<string, unknown>;
};

const APIFY_BASE = "https://api.apify.com/v2/acts";

/** Actor ids, in `username~name` form. Swap an id here to change a lane. */
export const ACTORS = {
  tiktok: "clockworks~tiktok-scraper",
  facebookSearch: "scraper_one~facebook-posts-search",
  facebookPages: "apify~facebook-posts-scraper",
  facebookPage: "apify~facebook-pages-scraper",
  facebookGroups: "apify~facebook-groups-scraper",
  instagram: "apify~instagram-scraper",
  instagramStories: "apify~instagram-scraper",
  threads: "futurizerush~meta-threads-scraper",
  linkedin: "unseenuser~LinkedIn-Post-Seach-Scraper",
  youtube: "streamers~youtube-scraper",
  googleNews: "data_xplorer~google-news-scraper-fast",
  snapchat: "tri_angle~snapchat-scraper",
} as const;

/**
 * Runs one actor and returns its dataset. Synchronous form: the caller waits
 * for the run, which keeps the sweep a single pass with no polling state.
 */
export async function runActor(
  actorId: string,
  input: Record<string, unknown>,
  { limit = 60, timeoutSeconds = 240 }: { limit?: number; timeoutSeconds?: number } = {},
): Promise<Record<string, unknown>[]> {
  const token = getApifyToken();
  const url = `${APIFY_BASE}/${actorId}/run-sync-get-dataset-items?timeout=${timeoutSeconds}&limit=${limit}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout((timeoutSeconds + 30) * 1000),
  });

  if (!res.ok) {
    // Upstream detail is logged, never surfaced: it can carry actor internals.
    console.error(`Apify actor ${actorId} responded ${res.status}`);
    throw new Error(`Collector unavailable (${res.status})`);
  }

  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) throw new Error("Collector returned no items");
  // Some actors report their own failure as a single object in the dataset.
  const items = body.filter(
    (i): i is Record<string, unknown> =>
      Boolean(i) && typeof i === "object" && !("error" in (i as object)),
  );
  return items;
}

/* ------------------------------------------------------------------ */
/* Shared field helpers                                                 */
/* ------------------------------------------------------------------ */

const str = (v: unknown): string | null => {
  const s =
    typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim();
  return s ? s : null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
};

const iso = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  const raw = typeof v === "number" ? v : String(v);
  const ms = typeof raw === "number" ? (raw < 1e12 ? raw * 1000 : raw) : Date.parse(raw);
  const asNumber = typeof raw === "string" && /^\d{10,13}$/.test(raw) ? Number(raw) : null;
  const time = asNumber !== null ? (asNumber < 1e12 ? asNumber * 1000 : asNumber) : ms;
  const d = new Date(time);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function base(
  platform: ApifyPlatform,
  contentType: ApifyContentType,
  externalId: string,
  url: string,
  raw: Record<string, unknown>,
): RawMention {
  return {
    platform,
    contentType,
    sourceLabel: sourceLabel(platform, contentType),
    externalId,
    authorName: null,
    authorHandle: null,
    authorAvatar: null,
    title: null,
    content: null,
    url,
    thumbnailUrl: null,
    publishedAt: null,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    raw,
  };
}

/* ------------------------------------------------------------------ */
/* Per-platform collectors                                              */
/* ------------------------------------------------------------------ */

export async function collectTikTok(): Promise<RawMention[]> {
  const items = await runActor(
    ACTORS.tiktok,
    {
      searchQueries: CORE_QUERIES,
      resultsPerPage: 12,
      searchSection: "/video",
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
      proxyCountryCode: "None",
    },
    { limit: 60, timeoutSeconds: 300 },
  );

  return items.flatMap((i) => {
    const url = str(i["webVideoUrl"]);
    const id = str(i["id"]);
    if (!url || !id) return [];
    const author = (i["authorMeta"] ?? {}) as Record<string, unknown>;
    const video = (i["videoMeta"] ?? {}) as Record<string, unknown>;
    const hashtags = Array.isArray(i["hashtags"])
      ? (i["hashtags"] as Record<string, unknown>[]).map((h) => str(h["name"])).filter(Boolean)
      : [];
    return [
      {
        ...base("tiktok", "video", id, url, { hashtags, searchQuery: i["searchQuery"] ?? null }),
        authorName: str(author["nickName"]),
        authorHandle: str(author["name"]),
        authorAvatar: str(author["avatar"]),
        content: str(i["text"]),
        thumbnailUrl: str(video["coverUrl"]),
        publishedAt: iso(i["createTimeISO"] ?? i["createTime"]),
        views: num(i["playCount"]),
        likes: num(i["diggCount"]),
        comments: num(i["commentCount"]),
        shares: num(i["shareCount"]),
      },
    ];
  });
}

/** Facebook posts discovered by keyword search across public content. */
export async function collectFacebookSearch(): Promise<RawMention[]> {
  const out: RawMention[] = [];
  for (const query of CORE_QUERIES) {
    const items = await runActor(
      ACTORS.facebookSearch,
      { query, resultsCount: 12, searchType: "top" },
      { limit: 20, timeoutSeconds: 240 },
    );
    out.push(...items.flatMap((i) => mapFacebookPost(i, "post")));
  }
  return out;
}

/** Posts from the pages we watch by name. */
export async function collectFacebookPages(): Promise<RawMention[]> {
  if (!FACEBOOK_PAGES.length) return [];
  const items = await runActor(
    ACTORS.facebookPages,
    { startUrls: FACEBOOK_PAGES.map((url) => ({ url })), resultsLimit: 15 },
    { limit: 40, timeoutSeconds: 300 },
  );
  return items.flatMap((i) => mapFacebookPost(i, "post"));
}

/**
 * Public group posts. Private groups are never attempted. The dedicated group
 * actor is a paid rental and can answer 403 on this account, so the general
 * post scraper is used as a fallback on the same group URLs.
 */
export async function collectFacebookGroups(): Promise<RawMention[]> {
  if (!FACEBOOK_GROUPS.length) return [];
  const startUrls = FACEBOOK_GROUPS.map((url) => ({ url }));
  let items: Record<string, unknown>[] = [];
  try {
    items = await runActor(
      ACTORS.facebookGroups,
      { startUrls, resultsLimit: 15 },
      { limit: 60, timeoutSeconds: 300 },
    );
  } catch {
    items = await runActor(
      ACTORS.facebookPages,
      { startUrls, resultsLimit: 15 },
      { limit: 60, timeoutSeconds: 300 },
    );
  }
  return items.flatMap((i) => mapFacebookPost(i, "group_post"));
}

function mapFacebookPost(i: Record<string, unknown>, kind: ApifyContentType): RawMention[] {
  const url = str(i["url"] ?? i["postUrl"] ?? i["facebookUrl"]);
  const id = str(i["postId"] ?? i["id"]) ?? url;
  if (!url || !id) return [];

  const author = (i["author"] ?? i["user"] ?? {}) as Record<string, unknown>;
  const group = (i["group"] ?? {}) as Record<string, unknown>;
  const attachments = Array.isArray(i["attachments"])
    ? (i["attachments"] as Record<string, unknown>[])
    : [];
  const thumb =
    str(i["thumbnailUrl"]) ??
    str(attachments[0]?.["thumbnail"]) ??
    str(attachments[0]?.["image"]) ??
    str(attachments[0]?.["photo_image"]);

  return [
    {
      ...base("facebook", kind, String(id), url, {
        groupName: str(group["name"]) ?? str(i["groupTitle"]),
        groupUrl: str(group["url"]) ?? str(i["groupUrl"]),
        reactions: i["reactions"] ?? null,
      }),
      authorName: str(author["name"]) ?? str(i["pageName"]) ?? str(i["user_name"]),
      authorHandle: str(author["profileUrl"]) ? null : str(i["pageId"]),
      authorAvatar: str(author["profilePicture"]) ?? str(author["profilePic"]),
      title: str(group["name"]) ?? str(i["groupTitle"]),
      content: str(i["postText"] ?? i["text"] ?? i["message"]),
      thumbnailUrl: thumb,
      publishedAt: iso(i["timestamp"] ?? i["time"] ?? i["date"] ?? i["publishedAt"]),
      views: num(i["viewsCount"] ?? i["videoViewCount"]),
      likes: num(i["reactionsCount"] ?? i["likesCount"]),
      comments: num(i["commentsCount"]),
      shares: num(i["sharesCount"]),
    },
  ];
}

/** Instagram posts and reels from watched hashtags and accounts. */
export async function collectInstagram(): Promise<RawMention[]> {
  const directUrls = [
    ...HASHTAGS.map((tag) => `https://www.instagram.com/explore/tags/${tag}/`),
    ...INSTAGRAM_ACCOUNTS.map((user) => `https://www.instagram.com/${user}/`),
  ];
  if (!directUrls.length) return [];

  const items = await runActor(
    ACTORS.instagram,
    { resultsType: "posts", directUrls, resultsLimit: 10 },
    { limit: 80, timeoutSeconds: 300 },
  );

  return items.flatMap((i) => {
    const url = str(i["url"]);
    const id = str(i["id"] ?? i["shortCode"]);
    if (!url || !id) return [];
    const isReel = str(i["productType"]) === "clips" || str(i["type"]) === "Video";
    return [
      {
        ...base("instagram", isReel ? "reel" : "post", id, url, {
          hashtags: i["hashtags"] ?? [],
          inputUrl: i["inputUrl"] ?? null,
        }),
        authorName: str(i["ownerFullName"]),
        authorHandle: str(i["ownerUsername"]),
        content: str(i["caption"]),
        thumbnailUrl: str(i["displayUrl"]),
        publishedAt: iso(i["timestamp"]),
        views: num(i["videoPlayCount"] ?? i["videoViewCount"]),
        likes: num(i["likesCount"]),
        comments: num(i["commentsCount"]),
        shares: null,
      },
    ];
  });
}

/**
 * Stories are only readable for accounts that are public *and* currently
 * posting, and the available actors need a logged-in session to be reliable.
 * The lane stays dormant until an account is configured.
 */
export async function collectInstagramStories(): Promise<RawMention[]> {
  if (!INSTAGRAM_STORY_ACCOUNTS.length) {
    throw new UnavailableSource(
      "No public account configured — Instagram Stories need a public, actively posting account.",
    );
  }
  const items = await runActor(
    ACTORS.instagramStories,
    {
      resultsType: "stories",
      directUrls: INSTAGRAM_STORY_ACCOUNTS.map((u) => `https://www.instagram.com/${u}/`),
      resultsLimit: 10,
    },
    { limit: 40, timeoutSeconds: 240 },
  );

  return items.flatMap((i) => {
    const url = str(i["url"]) ?? str(i["storyUrl"]);
    const id = str(i["id"]);
    if (!url || !id) return [];
    return [
      {
        ...base("instagram", "story", id, url, { expiresAt: i["expiringAt"] ?? null }),
        authorName: str(i["ownerFullName"]),
        authorHandle: str(i["ownerUsername"]),
        content: str(i["caption"] ?? i["text"]),
        thumbnailUrl: str(i["displayUrl"]),
        publishedAt: iso(i["timestamp"]),
      },
    ];
  });
}

export async function collectThreads(): Promise<RawMention[]> {
  const items = await runActor(
    ACTORS.threads,
    {
      mode: "keyword",
      keywords: CORE_QUERIES,
      max_posts: 15,
      search_filter: "recent",
    },
    { limit: 60, timeoutSeconds: 300 },
  );

  return items.flatMap((i) => {
    const url = str(i["post_url"]);
    const id = str(i["post_code"]) ?? url;
    if (!url || !id) return [];
    return [
      {
        ...base("threads", "post", String(id), url, {
          quoteCount: num(i["quote_count"]),
          mediaUrl: str(i["media_url"]),
        }),
        authorName: str(i["display_name"]),
        authorHandle: str(i["username"]),
        authorAvatar: str(i["profile_pic_url"]),
        content: str(i["text_content"]),
        thumbnailUrl: str(i["media_type"]) === "image" ? str(i["media_url"]) : null,
        publishedAt: iso(i["created_at"]),
        views: num(i["view_count"]),
        likes: num(i["like_count"]),
        comments: num(i["reply_count"]),
        shares: num(i["repost_count"]),
      },
    ];
  });
}

export async function collectLinkedIn(): Promise<RawMention[]> {
  const out: RawMention[] = [];
  for (const keyword of CORE_QUERIES) {
    const items = await runActor(
      ACTORS.linkedin,
      {
        mode: "search",
        searchKeywords: keyword,
        maxResults: 10,
        datePosted: "past-month",
        sortBy: "date_posted",
      },
      { limit: 20, timeoutSeconds: 240 },
    );

    out.push(
      ...items.flatMap((i) => {
        const url = str(i["linkedinUrl"]) ?? str(i["shareLinkedinUrl"]);
        const id = str(i["id"] ?? i["entityId"]) ?? url;
        if (!url || !id) return [];
        const author = (i["author"] ?? {}) as Record<string, unknown>;
        const posted = (i["postedAt"] ?? {}) as Record<string, unknown>;
        const engagement = (i["engagement"] ?? {}) as Record<string, unknown>;
        const video = (i["postVideo"] ?? {}) as Record<string, unknown>;
        const images = Array.isArray(i["postImages"])
          ? (i["postImages"] as Record<string, unknown>[])
          : [];
        return [
          {
            ...base("linkedin", "post", String(id), url, { keyword }),
            authorName: str(author["name"]),
            authorHandle: str(author["publicIdentifier"] ?? author["universalName"]),
            authorAvatar: str(author["avatar"]),
            title: str(author["info"]),
            content: str(i["content"]),
            thumbnailUrl: str(video["thumbnailUrl"]) ?? str(images[0]?.["url"]),
            publishedAt: iso(posted["timestamp"] ?? posted["date"]),
            likes: num(engagement["likes"] ?? engagement["reactions"]),
            comments: num(engagement["comments"]),
            shares: num(engagement["shares"]),
          },
        ];
      }),
    );
  }
  return out;
}

/** Long-form videos and Shorts come from the same run, tagged apart. */
export async function collectYouTube(): Promise<RawMention[]> {
  const items = await runActor(
    ACTORS.youtube,
    {
      searchQueries: SEARCH_QUERIES,
      maxResults: 8,
      maxResultsShorts: 5,
      maxResultStreams: 0,
      downloadSubtitles: false,
      dateFilter: "month",
    },
    { limit: 80, timeoutSeconds: 300 },
  );

  return items.flatMap((i) => {
    const url = str(i["url"]);
    const id = str(i["id"]) ?? url;
    if (!url || !id) return [];
    const short = str(i["type"]) === "shorts" || url.includes("/shorts/");
    return [
      {
        ...base("youtube", short ? "short" : "video", String(id), url, {
          duration: str(i["duration"]),
          channelUrl: str(i["channelUrl"]),
        }),
        authorName: str(i["channelName"]),
        authorHandle: str(i["channelUsername"]),
        title: str(i["title"]),
        content: str(i["text"]),
        thumbnailUrl: str(i["thumbnailUrl"]),
        publishedAt: iso(i["date"]),
        views: num(i["viewCount"]),
        likes: num(i["likes"]),
        comments: num(i["commentsCount"]),
        shares: null,
      },
    ];
  });
}

/** Google News results, with the publisher URL decoded where possible. */
export async function collectGoogleNews(): Promise<RawMention[]> {
  const items = await runActor(
    ACTORS.googleNews,
    {
      keywords: SEARCH_QUERIES,
      maxArticles: 60,
      timeframe: "7d",
      region_language: "KE:en",
      decodeUrls: true,
      extractImages: true,
      extractDescriptions: true,
    },
    { limit: 80, timeoutSeconds: 300 },
  );

  return items.flatMap((i) => {
    const url = str(i["url"]);
    if (!url) return [];
    return [
      {
        ...base("news", "article", url, url, { keyword: (i["metadata"] as never) ?? null }),
        authorName: str(i["source"]),
        title: str(i["title"]),
        content: str(i["description"]),
        thumbnailUrl: str(i["image"]),
        publishedAt: iso(i["publishedAt"] ?? i["publishedTimestamp"]),
      },
    ];
  });
}

/**
 * Snapchat exposes no public keyword search; only named public profiles can be
 * read, so the lane stays dormant until one is confirmed.
 */
export async function collectSnapchat(): Promise<RawMention[]> {
  if (!SNAPCHAT_PROFILES.length) {
    throw new UnavailableSource(
      "Snapchat has no public keyword search — a public profile has to be named first.",
    );
  }
  const items = await runActor(
    ACTORS.snapchat,
    { profilesInput: SNAPCHAT_PROFILES },
    { limit: 40, timeoutSeconds: 240 },
  );

  return items.flatMap((i) => {
    const url = str(i["url"]) ?? str(i["profileUrl"]);
    const id = str(i["id"]) ?? url;
    if (!url || !id) return [];
    return [
      {
        ...base("snapchat", "story", String(id), url, {}),
        authorName: str(i["displayName"] ?? i["title"]),
        authorHandle: str(i["username"]),
        authorAvatar: str(i["profilePictureUrl"]),
        content: str(i["description"] ?? i["snapDescription"]),
        thumbnailUrl: str(i["thumbnailUrl"] ?? i["imageUrl"]),
        publishedAt: iso(i["timestamp"] ?? i["publishedAt"]),
        views: num(i["viewCount"]),
      },
    ];
  });
}

/** A lane that cannot legitimately read public data right now. */
export class UnavailableSource extends Error {}

/** Every lane, in the order they are swept. */
export const SOURCES: {
  key: ApifySourceKey;
  label: string;
  run: () => Promise<RawMention[]>;
}[] = [
  { key: "tiktok", label: "TikTok", run: collectTikTok },
  { key: "facebook_search", label: "Facebook", run: collectFacebookSearch },
  { key: "facebook_pages", label: "Facebook Pages", run: collectFacebookPages },
  { key: "instagram", label: "Instagram", run: collectInstagram },
  { key: "threads", label: "Threads", run: collectThreads },
  { key: "linkedin", label: "LinkedIn", run: collectLinkedIn },
  { key: "youtube", label: "YouTube & Shorts", run: collectYouTube },
  { key: "google_news", label: "Google News", run: collectGoogleNews },
  { key: "facebook_groups", label: "Facebook Groups", run: collectFacebookGroups },
  { key: "instagram_stories", label: "Instagram Stories", run: collectInstagramStories },
  { key: "snapchat", label: "Snapchat", run: collectSnapchat },
];
