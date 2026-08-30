// Server-only client for twitterapi.io (third-party X/Twitter API).
// The API key lives in the TWITTERAPI_IO_KEY secret and NEVER reaches the browser.
// Account session state (`login_cookies` + `proxy`) is read from x_accounts and is
// also never exposed to the client.

import { generateTotp, isValidBase32Secret } from "./totp.server";

const BASE_URL = "https://api.twitterapi.io";

const ENDPOINTS = {
  createTweet: "/twitter/create_tweet_v2",
  likeTweet: "/twitter/like_tweet_v2",
  retweetTweet: "/twitter/retweet_tweet_v2",
  bookmarkTweet: "/twitter/bookmark_tweet_v2",
  followUser: "/twitter/follow_user_v2",
  uploadMedia: "/twitter/upload_media_v2",
  userLogin: "/twitter/user_login_v2",
};

export type PostingAccount = {
  id: string;
  handle: string;
  loginCookies: string | null;
  proxy: string | null;
};

export type ApiResult = {
  ok: boolean;
  tweetId: string | null;
  error: string | null;
  raw?: unknown;
};

function apiKey(): string {
  const key = process.env["TWITTERAPI_IO_KEY"];
  if (!key) {
    throw new Error("TWITTERAPI_IO_KEY is not configured. Add the secret before publishing.");
  }
  return key;
}

/** Account proxy, falling back to the server-wide default proxy secret. */
function resolveProxy(account: PostingAccount): string {
  const own = (account.proxy ?? "").trim();
  if (own) return own;
  return (process.env["DEFAULT_TWITTER_PROXY"] ?? "").trim();
}

/**
 * twitterapi.io expects `login_cookies` to be a base64-encoded JSON cookie jar.
 * Accounts imported with a raw X `auth_token` are normalised here: we wrap the
 * token with a freshly generated `ct0` (CSRF) value, which X accepts as long as
 * cookie and header match - twitterapi.io sends both.
 */
function sessionCookies(account: PostingAccount): string {
  const raw = (account.loginCookies ?? "").trim();
  if (!raw) return raw;
  if (/^[a-f0-9]{32,60}$/i.test(raw)) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const ct0 = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return btoa(JSON.stringify({ auth_token: raw, ct0 }));
  }
  return raw;
}

function missingAccountAuth(account: PostingAccount): ApiResult | null {
  if (!account.loginCookies) {
    return {
      ok: false,
      tweetId: null,
      error: `@${account.handle} has no saved login cookies. Add the account session in the workspace settings.`,
    };
  }
  if (!resolveProxy(account)) {
    return {
      ok: false,
      tweetId: null,
      error: `@${account.handle} has no proxy configured, and no server default proxy is set. Add a proxy on the account in Admin → Accounts.`,
    };
  }
  return null;
}

async function callJson(
  path: string,
  body: Record<string, unknown>,
  method: "POST" | "PATCH" = "POST",
): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey(),
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, tweetId: null, error: (e as Error).message };
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    return {
      ok: false,
      tweetId: null,
      error:
        json?.detail ?? json?.msg ?? json?.message ?? text.slice(0, 400) ?? `HTTP ${res.status}`,
      raw: json ?? text,
    };
  }

  // twitterapi.io answers HTTP 200 even when the action failed (expired
  // session, rate limit, duplicate content). Without this check every account
  // is recorded as "success" while only a handful of posts actually went out.
  const statusField = String(json?.status ?? "").toLowerCase();
  if (statusField === "error" || statusField === "fail" || json?.success === false) {
    return {
      ok: false,
      tweetId: null,
      error: json?.msg ?? json?.message ?? json?.detail ?? "The action was rejected by X.",
      raw: json,
    };
  }

  // Defensive extraction: the API response shape varies by endpoint and has
  // changed over time (the id has appeared as `tweet_id`, `rest_id`, and
  // nested under `data.create_tweet.tweet_results.result`). Anything missed
  // here is a published post that Performance can never measure, so fall back
  // to a bounded deep scan for the first snowflake-shaped id in the payload.
  const tweetId =
    json?.tweet_id ??
    json?.data?.id ??
    json?.data?.tweet_id ??
    json?.data?.rest_id ??
    json?.id ??
    json?.rest_id ??
    findTweetId(json);

  return { ok: true, tweetId: tweetId ? String(tweetId) : null, error: null, raw: json };
}

/** Snowflake ids are 15-25 digit numbers; anything shorter is not a tweet id. */
function looksLikeTweetId(value: unknown): boolean {
  const s = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  return /^\d{15,25}$/.test(s);
}

/** Breadth-first hunt for an id-shaped field anywhere in an unknown payload. */
function findTweetId(root: unknown): string | null {
  const keys = ["tweet_id", "tweetId", "rest_id", "id_str", "id"];
  const queue: unknown[] = [root];
  let visited = 0;
  while (queue.length && visited < 500) {
    const node = queue.shift();
    visited += 1;
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    const obj = node as Record<string, unknown>;
    for (const key of keys) {
      if (key in obj && looksLikeTweetId(obj[key])) return String(obj[key]);
    }
    queue.push(...Object.values(obj));
  }
  return null;
}

/** Media upload responses have used several nested id field names over time. */
function findMediaId(root: unknown): string | null {
  const keys = ["media_id", "media_id_string", "mediaId", "id_str", "id"];
  const queue: unknown[] = [root];
  let visited = 0;
  while (queue.length && visited < 300) {
    const node = queue.shift();
    visited += 1;
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    const obj = node as Record<string, unknown>;
    for (const key of keys) {
      const value = obj[key];
      if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
        return String(value);
      }
    }
    queue.push(...Object.values(obj));
  }
  return null;
}

/** Small delay between automated actions to stay within X's safety budget. */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Latest tweet IDs for a public handle (read endpoint, no account session needed). */
export async function fetchLatestTweetIds(
  handle: string,
  limit = 2,
  includeReplies = false,
): Promise<{ ids: string[]; error: string | null }> {
  const userName = handle.replace(/^@/, "").trim();
  if (!userName) return { ids: [], error: "empty handle" };

  let res: Response;
  try {
    res = await fetch(
      `${BASE_URL}/twitter/user/last_tweets?userName=${encodeURIComponent(userName)}`,
      { headers: { "x-api-key": apiKey() } },
    );
  } catch (e) {
    return { ids: [], error: (e as Error).message };
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    return {
      ids: [],
      error: json?.msg ?? json?.message ?? text.slice(0, 200) ?? `HTTP ${res.status}`,
    };
  }

  const tweets: any[] = json?.data?.tweets ?? json?.tweets ?? json?.data?.data?.tweets ?? [];
  const ids = tweets
    .filter((t) => (includeReplies ? true : !t?.isReply) && !t?.retweeted_tweet)
    .map((t) => String(t?.id ?? t?.tweet_id ?? ""))
    .filter(Boolean)
    .slice(0, limit);

  return { ids, error: ids.length ? null : (json?.msg ?? "no recent posts found") };
}

export async function postTweet(
  account: PostingAccount,
  text: string,
  mediaIds: string[] = [],
  replyToTweetId?: string,
): Promise<ApiResult> {
  const missing = missingAccountAuth(account);
  if (missing) return missing;

  const body: Record<string, unknown> = {
    login_cookies: sessionCookies(account),
    proxy: resolveProxy(account),
    tweet_text: text,
  };
  if (mediaIds.length) body["media_ids"] = mediaIds;
  if (replyToTweetId) body["reply_to_tweet_id"] = replyToTweetId;

  const result = await callJson(ENDPOINTS.createTweet, body);

  // A post that succeeds without returning an id is invisible to Performance
  // for good: nothing later can work out which tweet it was. When that
  // happens, read the account's timeline back and take the newest item.
  if (result.ok && !result.tweetId && account.handle) {
    const { ids } = await fetchLatestTweetIds(account.handle, 1, Boolean(replyToTweetId));
    if (ids[0]) return { ...result, tweetId: ids[0] };
    // No id anywhere means X never confirmed the post - report it honestly so
    // the run summary and retry logic see a failure rather than a phantom win.
    return {
      ok: false,
      tweetId: null,
      error: `@${account.handle}: X did not confirm the post (session may be expired or rate limited).`,
      raw: result.raw,
    };
  }

  return result;
}

export async function replyToTweet(
  account: PostingAccount,
  targetTweetId: string,
  text: string,
  mediaIds: string[] = [],
): Promise<ApiResult> {
  // twitterapi.io uses the same create_tweet_v2 endpoint for replies;
  // reply is indicated by the reply_to_tweet_id field.
  return postTweet(account, text, mediaIds, targetTweetId);
}

export async function likeTweet(
  account: PostingAccount,
  targetTweetId: string,
): Promise<ApiResult> {
  const missing = missingAccountAuth(account);
  if (missing) return missing;

  return callJson(ENDPOINTS.likeTweet, {
    login_cookies: sessionCookies(account),
    proxy: resolveProxy(account),
    tweet_id: targetTweetId,
  });
}
export async function retweetTweet(
  account: PostingAccount,
  targetTweetId: string,
): Promise<ApiResult> {
  const missing = missingAccountAuth(account);
  if (missing) return missing;

  return callJson(ENDPOINTS.retweetTweet, {
    login_cookies: sessionCookies(account),
    proxy: resolveProxy(account),
    tweet_id: targetTweetId,
  });
}

export async function bookmarkTweet(
  account: PostingAccount,
  targetTweetId: string,
): Promise<ApiResult> {
  const missing = missingAccountAuth(account);
  if (missing) return missing;

  return callJson(ENDPOINTS.bookmarkTweet, {
    login_cookies: sessionCookies(account),
    proxy: resolveProxy(account),
    tweet_id: targetTweetId,
  });
}

/** Follow another account by @handle on behalf of an account. */
const userIdCache = new Map<string, string>();

/** Numeric X user id for a handle (follow_user_v2 requires the id, not the handle). */
export async function fetchUserId(handle: string): Promise<string | null> {
  const userName = handle.replace(/^@/, "").trim();
  if (!userName) return null;
  const cached = userIdCache.get(userName.toLowerCase());
  if (cached) return cached;

  try {
    const res = await fetch(
      `${BASE_URL}/twitter/user/info?userName=${encodeURIComponent(userName)}`,
      { headers: { "x-api-key": apiKey() } },
    );
    const json: any = await res.json().catch(() => null);
    const id = json?.data?.id ?? json?.data?.userId ?? json?.data?.id_str ?? json?.id ?? null;
    if (id) {
      userIdCache.set(userName.toLowerCase(), String(id));
      return String(id);
    }
  } catch {
    /* unreachable handle */
  }
  return null;
}

export async function followUser(
  account: PostingAccount,
  targetHandle: string,
): Promise<ApiResult> {
  const missing = missingAccountAuth(account);
  if (missing) return missing;

  const screenName = targetHandle.replace(/^@/, "");
  const userId = await fetchUserId(screenName);
  if (!userId) {
    return { ok: false, tweetId: null, error: `Could not resolve @${screenName}` };
  }

  return callJson(ENDPOINTS.followUser, {
    login_cookies: sessionCookies(account),
    proxy: resolveProxy(account),
    user_id: userId,
    screen_name: screenName,
    user_name: screenName,
  });
}

/** Upload media to X on behalf of an account. Returns the media_id string. */
export async function uploadMedia(
  account: PostingAccount,
  file: { bytes: Uint8Array; name: string; contentType: string },
): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
  const missing = missingAccountAuth(account);
  if (missing) return { ok: false, error: missing.error! };

  const form = new FormData();
  // Copy to a plain Uint8Array backed by an ArrayBuffer to satisfy Blob typing.
  const buffer = new Uint8Array(file.bytes.length);
  buffer.set(file.bytes);
  form.append("file", new Blob([buffer], { type: file.contentType }), file.name);
  form.append("login_cookies", sessionCookies(account));
  form.append("proxy", resolveProxy(account));

  if (file.contentType.startsWith("video/")) {
    form.append("media_category", "tweet_video");
    form.append("is_long_video", "true");
  } else if (file.contentType === "image/gif") {
    form.append("media_category", "tweet_gif");
  } else if (file.contentType.startsWith("image/")) {
    form.append("media_category", "tweet_image");
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${ENDPOINTS.uploadMedia}`, {
      method: "POST",
      headers: { "x-api-key": apiKey() },
      body: form,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    return {
      ok: false,
      error:
        json?.detail ?? json?.msg ?? json?.message ?? text.slice(0, 400) ?? `HTTP ${res.status}`,
    };
  }

  const mediaId =
    json?.media_id ??
    json?.media_id_string ??
    json?.data?.media_id ??
    json?.data?.media_id_string ??
    json?.data?.id ??
    json?.id ??
    findMediaId(json);
  if (!mediaId) {
    return { ok: false, error: "Media upload succeeded but no media_id was returned." };
  }
  return { ok: true, mediaId: String(mediaId) };
}

/** True when X asked for a one-time code / 2FA / confirmation instead of failing outright. */
export function looksLikeCodeChallenge(message: string): boolean {
  return /(2fa|two[- ]factor|totp|otp|one[- ]time|verification code|confirmation code|confirm your|code is required|code required|challenge|acid|arkose)/i.test(
    message,
  );
}

/** Log in to X via twitterapi.io and obtain base64-encoded login_cookies. */
export async function loginAccount(input: {
  userName: string;
  email?: string;
  password: string;
  proxy: string;
  totpSecret?: string;
  /** A one-time code the operator read from the account's email/SMS/authenticator. */
  code?: string;
}): Promise<{ loginCookies: string; handle: string } | { error: string; needsCode?: boolean }> {
  const attempt = async (opts: { totpSecret?: string; code?: string }) => {
    const body: Record<string, unknown> = {
      user_name: input.userName,
      email: input.email || input.userName,
      password: input.password,
      proxy: input.proxy,
    };
    if (opts.totpSecret) body["totp_secret"] = opts.totpSecret;
    if (opts.code) {
      // twitterapi.io accepts the live code in place of a TOTP secret; send the
      // common field aliases so whichever the endpoint reads is present.
      body["totp_secret"] = opts.code;
      body["two_fa_code"] = opts.code;
      body["2fa_code"] = opts.code;
      body["verification_code"] = opts.code;
    }
    return callLogin(body, input.userName);
  };

  // 1) Manual code wins when the operator supplied one.
  if (input.code) return attempt({ code: input.code });

  if (input.totpSecret) {
    const first = await attempt({ totpSecret: input.totpSecret });
    if (!("error" in first)) return first;
    // 2) Fall back to generating the live 6-digit code ourselves from the
    //    stored base32 secret (no external OTP website needed).
    if (isValidBase32Secret(input.totpSecret)) {
      try {
        const live = await generateTotp(input.totpSecret);
        const second = await attempt({ code: live });
        if (!("error" in second)) return second;
        return second;
      } catch {
        /* fall through to the original error */
      }
    }
    return first;
  }

  return attempt({});
}

async function callLogin(
  body: Record<string, unknown>,
  userName: string,
): Promise<{ loginCookies: string; handle: string } | { error: string; needsCode?: boolean }> {
  const input = { userName };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${ENDPOINTS.userLogin}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey(),
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { error: (e as Error).message };
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    const msg =
      json?.detail ?? json?.msg ?? json?.message ?? text.slice(0, 400) ?? `HTTP ${res.status}`;
    return { error: String(msg), needsCode: looksLikeCodeChallenge(String(msg)) };
  }

  const loginCookies = json?.login_cookies ?? json?.data?.login_cookies ?? json?.cookies ?? null;
  if (!loginCookies) {
    // twitterapi.io often replies HTTP 200 with an error payload - surface it.
    const detail =
      json?.msg ??
      json?.message ??
      json?.detail ??
      json?.error ??
      json?.data?.msg ??
      (json?.status ? `status: ${json.status}` : null) ??
      (text ? text.slice(0, 300) : null);
    const message = detail
      ? `Login failed - ${detail}`
      : "Login failed - X did not return a session (it likely asked for a verification code).";
    return {
      error: message,
      // No cookies + no explicit reason is almost always a code challenge.
      needsCode: detail ? looksLikeCodeChallenge(String(detail)) : true,
    };
  }
  return { loginCookies: String(loginCookies), handle: input.userName };
}

/** Accepts a full x.com/twitter.com status URL or a bare numeric id. */
export function extractTweetId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{5,25}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/status(?:es)?\/(\d{5,25})/);
  return m?.[1] ?? null;
}

/**
 * Update the X profile display name, bio and location (not the @handle).
 * twitterapi.io has renamed this endpoint across versions, so we try the
 * known paths in order and keep the first non-404 answer.
 */
export async function updateProfileDisplayName(
  account: PostingAccount,
  name: string,
  bio?: string,
  location?: string,
): Promise<ApiResult> {
  const missing = missingAccountAuth(account);
  if (missing) return missing;

  const body = {
    login_cookies: sessionCookies(account),
    proxy: resolveProxy(account),
    name,
    ...(bio ? { description: bio } : {}),
    ...(location ? { location } : {}),
  };

  // update_profile_v2 is a PATCH endpoint on twitterapi.io.
  return callJson("/twitter/update_profile_v2", body, "PATCH");
}

/** Result of a screen-name change, including the handle X actually accepted. */
export type ScreenNameResult = ApiResult & { handle: string | null };

const cleanHandle = (raw: string) =>
  raw
    .replace(/^@/, "")
    .replace(/[^A-Za-z_]/g, "")
    .slice(0, 15);

/** Pull any handles X suggested inside an error payload (e.g. "try @NameKE"). */
function suggestedHandles(error: string | null): string[] {
  if (!error) return [];
  const out: string[] = [];
  for (const m of error.matchAll(/@?([A-Za-z][A-Za-z0-9_]{3,14})/g)) {
    const h = cleanHandle(m[1] ?? "");
    if (h.length >= 4 && !out.includes(h)) out.push(h);
  }
  return out;
}

/** Letter/underscore-only fallbacks derived from the desired handle. */
function handleVariants(base: string): string[] {
  const b = cleanHandle(base);
  return [`${b}KE`, `${b}_KE`, `the${b}`, `real${b}`, `${b}Says`, `${b}Talks`, `${b}_`, `iam${b}`]
    .map(cleanHandle)
    .filter((h) => h.length >= 4 && h !== b);
}

async function tryScreenName(account: PostingAccount, clean: string): Promise<ApiResult> {
  const body = {
    login_cookies: sessionCookies(account),
    proxy: resolveProxy(account),
    screen_name: clean,
    username: clean,
    new_screen_name: clean,
  };

  const paths = [
    "/twitter/update_screen_name_v2",
    "/twitter/update_screen_name",
    "/twitter/change_username",
    "/twitter/update_username",
  ];
  let last: ApiResult = { ok: false, tweetId: null, error: "No endpoint available." };
  for (const path of paths) {
    last = await callJson(path, body);
    if (last.ok) return last;
    const err = (last.error ?? "").toLowerCase();
    const notFound = err.includes("not found") || err.includes("404");
    if (!notFound) return last;
  }
  return last;
}

/**
 * Change the real @username (screen name) of an account.
 * If X rejects the handle as taken/unavailable, retry with whatever handle X
 * suggests in its error, then with letter-only variants of the desired name.
 */
export async function updateScreenName(
  account: PostingAccount,
  screenName: string,
): Promise<ScreenNameResult> {
  const missing = missingAccountAuth(account);
  if (missing) return { ...missing, handle: null };

  const clean = cleanHandle(screenName);
  if (clean.length < 4) {
    return {
      ok: false,
      tweetId: null,
      error: "Username must be at least 4 letters.",
      handle: null,
    };
  }

  let res = await tryScreenName(account, clean);
  if (res.ok) return { ...res, handle: clean };

  const err = (res.error ?? "").toLowerCase();
  const unavailable =
    err.includes("taken") ||
    err.includes("unavailable") ||
    err.includes("already in use") ||
    err.includes("not available") ||
    err.includes("in use");
  if (!unavailable) return { ...res, handle: null };

  const tried = new Set([clean.toLowerCase()]);
  const candidates = [...suggestedHandles(res.error), ...handleVariants(clean)];
  for (const candidate of candidates.slice(0, 6)) {
    if (tried.has(candidate.toLowerCase())) continue;
    tried.add(candidate.toLowerCase());
    await sleep(400 + Math.floor(Math.random() * 500));
    res = await tryScreenName(account, candidate);
    if (res.ok) return { ...res, handle: candidate };
  }
  return { ...res, handle: null };
}

/* ---------------------------------------------------------------------------
 * Profile artwork sync (avatar + header) - pushes the stored Unsplash portrait
 * and cover image onto the live X account. Runs server-side only.
 * ------------------------------------------------------------------------ */

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function patchImage(
  path: string,
  account: PostingAccount,
  bytes: Uint8Array,
): Promise<{ ok: boolean; error: string | null }> {
  const form = new FormData();
  const buffer = new Uint8Array(bytes.length);
  buffer.set(bytes);
  form.append("file", new Blob([buffer], { type: "image/jpeg" }), "image.jpg");
  form.append("login_cookies", sessionCookies(account));
  form.append("proxy", resolveProxy(account));

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: { "x-api-key": apiKey() },
      body: form,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok || json?.status === "error") {
    return {
      ok: false,
      error: json?.message ?? json?.detail ?? text.slice(0, 300) ?? `HTTP ${res.status}`,
    };
  }
  return { ok: true, error: null };
}

/** Push the account's stored portrait to X as its profile picture. */
export async function updateAvatarFromUrl(
  account: PostingAccount,
  imageUrl: string,
): Promise<{ ok: boolean; error: string | null }> {
  const missing = missingAccountAuth(account);
  if (missing) return { ok: false, error: missing.error };
  const bytes = await fetchImageBytes(imageUrl);
  if (!bytes) return { ok: false, error: "Could not download the portrait image." };
  return patchImage("/twitter/update_avatar_v2", account, bytes);
}

/** Push the account's stored cover image to X as its header/banner. */
export async function updateBannerFromUrl(
  account: PostingAccount,
  imageUrl: string,
): Promise<{ ok: boolean; error: string | null }> {
  const missing = missingAccountAuth(account);
  if (missing) return { ok: false, error: missing.error };
  const bytes = await fetchImageBytes(imageUrl);
  if (!bytes) return { ok: false, error: "Could not download the cover image." };
  return patchImage("/twitter/update_banner_v2", account, bytes);
}

export type TweetMetrics = {
  tweetId: string;
  text: string;
  authorHandle: string;
  authorName: string;
  isReply: boolean;
  createdAt: string | null;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  bookmarkCount: number;
  impressionCount: number;
};

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * Public metrics for up to 100 tweet IDs (read endpoint, no account session).
 * Returns only the tweets the API could resolve.
 */
export async function fetchTweetMetrics(
  tweetIds: string[],
): Promise<{ tweets: TweetMetrics[]; error: string | null }> {
  const ids = [...new Set(tweetIds.filter(Boolean))].slice(0, 100);
  if (!ids.length) return { tweets: [], error: null };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/twitter/tweets?tweet_ids=${encodeURIComponent(ids.join(","))}`, {
      headers: { "x-api-key": apiKey() },
    });
  } catch (e) {
    return { tweets: [], error: (e as Error).message };
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    return {
      tweets: [],
      error: json?.msg ?? json?.message ?? text.slice(0, 200) ?? `HTTP ${res.status}`,
    };
  }

  const raw: any[] = json?.tweets ?? json?.data?.tweets ?? json?.data ?? [];
  const tweets = (Array.isArray(raw) ? raw : [])
    .map((t: any): TweetMetrics | null => {
      const id = String(t?.id ?? t?.tweet_id ?? "");
      if (!id) return null;
      const createdRaw = t?.createdAt ?? t?.created_at ?? null;
      const created = createdRaw ? new Date(createdRaw) : null;
      return {
        tweetId: id,
        text: String(t?.text ?? ""),
        authorHandle: String(t?.author?.userName ?? t?.author?.screen_name ?? ""),
        authorName: String(
          t?.author?.name ?? t?.user?.name ?? t?.author?.userName ?? t?.author?.screen_name ?? "",
        ),
        isReply: Boolean(t?.isReply ?? t?.inReplyToId ?? t?.in_reply_to_status_id),
        createdAt: created && !Number.isNaN(created.getTime()) ? created.toISOString() : null,
        likeCount: toInt(t?.likeCount ?? t?.favorite_count),
        retweetCount: toInt(t?.retweetCount ?? t?.retweet_count),
        replyCount: toInt(t?.replyCount ?? t?.reply_count),
        quoteCount: toInt(t?.quoteCount ?? t?.quote_count),
        bookmarkCount: toInt(t?.bookmarkCount ?? t?.bookmark_count),
        impressionCount: toInt(t?.viewCount ?? t?.view_count ?? t?.impression_count),
      };
    })
    .filter((t): t is TweetMetrics => t !== null);

  return { tweets, error: tweets.length ? null : (json?.msg ?? null) };
}

export type FoundTweet = {
  id: string;
  text: string;
  authorHandle: string;
  authorName: string;
  url: string;
  createdAt: string | null;
  likeCount: number;
  viewCount: number;
  isVerified: boolean;
  /** True when the post is a reply in a conversation rather than a standalone post. */
  isReply: boolean;
  /** Handle the post replies to, when the API exposes it. */
  replyToHandle: string;
  /** Tweet id the post replies to, when the API exposes it. */
  replyToTweetId: string;
};

/**
 * Advanced search for public tweets matching a query (read endpoint, no
 * account session required). Used by listening campaigns to find people
 * already talking about the campaign keywords and hashtags.
 */
export async function searchTweets(
  query: string,
  limit = 20,
  cursor?: string,
): Promise<{ tweets: FoundTweet[]; error: string | null; nextCursor: string | null }> {
  const q = query.trim();
  if (!q) return { tweets: [], error: "empty query", nextCursor: null };

  let res: Response;
  try {
    res = await fetch(
      `${BASE_URL}/twitter/tweet/advanced_search?queryType=Latest&query=${encodeURIComponent(q)}${
        cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
      }`,
      { headers: { "x-api-key": apiKey() } },
    );
  } catch (e) {
    return { tweets: [], error: (e as Error).message, nextCursor: null };
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    return {
      tweets: [],
      error: json?.msg ?? json?.message ?? text.slice(0, 200) ?? `HTTP ${res.status}`,
      nextCursor: null,
    };
  }

  const raw: any[] = json?.tweets ?? json?.data?.tweets ?? json?.data ?? [];
  const tweets: FoundTweet[] = raw
    .filter((t) => t && !t.retweeted_tweet)
    .map((t) => {
      const handle = String(
        t?.author?.userName ?? t?.author?.screen_name ?? t?.user?.userName ?? "",
      ).replace(/^@/, "");
      const id = String(t?.id ?? t?.id_str ?? t?.tweet_id ?? "");
      return {
        id,
        text: String(t?.text ?? t?.full_text ?? "").trim(),
        authorHandle: handle,
        authorName: String(t?.author?.name ?? t?.user?.name ?? handle),
        url: t?.url ? String(t.url) : handle && id ? `https://x.com/${handle}/status/${id}` : "",
        createdAt: t?.createdAt ?? t?.created_at ?? null,
        likeCount: Number(t?.likeCount ?? t?.favorite_count ?? 0) || 0,
        viewCount: Number(t?.viewCount ?? t?.view_count ?? t?.impression_count ?? 0) || 0,
        isVerified: Boolean(
          t?.author?.isVerified ??
          t?.author?.isBlueVerified ??
          t?.user?.isVerified ??
          t?.user?.isBlueVerified ??
          false,
        ),
        isReply: Boolean(
          t?.isReply ??
          t?.inReplyToId ??
          t?.in_reply_to_status_id_str ??
          t?.in_reply_to_status_id ??
          t?.inReplyToUsername ??
          t?.in_reply_to_screen_name ??
          (t?.conversationId && String(t.conversationId) !== String(t?.id ?? "")),
        ),
        replyToHandle: String(
          t?.inReplyToUsername ?? t?.in_reply_to_screen_name ?? t?.inReplyToUserName ?? "",
        ).replace(/^@/, ""),
        replyToTweetId: String(
          t?.inReplyToId ?? t?.in_reply_to_status_id_str ?? t?.in_reply_to_status_id ?? "",
        ),
      };
    })

    .filter((t) => t.id && t.text && t.authorHandle)
    .slice(0, limit);

  const hasNext = json?.has_next_page ?? json?.hasNextPage ?? Boolean(json?.next_cursor);
  const nextCursorRaw = json?.next_cursor ?? json?.nextCursor ?? null;
  return {
    tweets,
    error: tweets.length ? null : (json?.msg ?? "no matching posts found"),
    nextCursor: hasNext && nextCursorRaw ? String(nextCursorRaw) : null,
  };
}

export type XProfile = {
  handle: string;
  displayName: string;
  description: string;
  location: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  followers: number;
  following: number;
  tweetCount: number;
  mediaCount: number;
  favouritesCount: number;
  isVerified: boolean;
  createdAt: string | null;
};

/**
 * Public profile card for any @handle (read endpoint, no account session).
 * Used by Brand Health to show follower counts and the real profile picture.
 */
export async function fetchXProfile(
  handle: string,
): Promise<{ profile: XProfile | null; error: string | null }> {
  const userName = handle.replace(/^@/, "").trim();
  if (!userName) return { profile: null, error: "empty handle" };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/twitter/user/info?userName=${encodeURIComponent(userName)}`, {
      headers: { "x-api-key": apiKey() },
    });
  } catch (e) {
    return { profile: null, error: (e as Error).message };
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  const d = json?.data ?? null;
  if (!res.ok || !d) {
    return {
      profile: null,
      error: json?.msg ?? json?.message ?? text.slice(0, 200) ?? `HTTP ${res.status}`,
    };
  }

  const toInt = (v: unknown) =>
    Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0;
  // Ask X for the full-size portrait instead of the _normal thumbnail.
  const avatar = d.profilePicture
    ? String(d.profilePicture).replace(/_normal(?=\.[a-z]+$)/i, "")
    : null;
  const created = d.createdAt ? new Date(d.createdAt) : null;

  return {
    profile: {
      handle: String(d.userName ?? userName),
      displayName: String(d.name ?? userName),
      description: String(d.description ?? ""),
      location: String(d.location ?? ""),
      avatarUrl: avatar,
      bannerUrl: d.coverPicture ? String(d.coverPicture) : null,
      followers: toInt(d.followers ?? d.followers_count),
      following: toInt(d.following ?? d.friends_count),
      tweetCount: toInt(d.statusesCount),
      mediaCount: toInt(d.mediaCount),
      favouritesCount: toInt(d.favouritesCount),
      isVerified: Boolean(d.isVerified || d.isBlueVerified),
      createdAt: created && !Number.isNaN(created.getTime()) ? created.toISOString() : null,
    },
    error: null,
  };
}
