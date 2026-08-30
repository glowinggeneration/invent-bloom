/**
 * Every social feed the mentions page listens to, in one editable place.
 *
 * All of these are RSS/Atom and are fetched server-side only — Reddit blocks
 * anonymous browser traffic, and none of the feeds send CORS headers.
 *
 * Slots that need an ID or a paid feed generator (YouTube, Bluesky, Facebook,
 * Instagram) ship empty and dormant: the sweep skips them until a value is
 * pasted in, so nothing here needs code changes to go live.
 */

/** How often the scheduled sweep should poll these feeds. */
export const SOCIAL_POLL_MINUTES = 25;

/** Reddit is rate-limited and rejects requests without a descriptive agent. */
export const SOCIAL_USER_AGENT = "fkf-commsiq/1.0";

/** Raw Reddit search queries — URL-encoded at request time. */
export const REDDIT_QUERIES: string[] = [
  '"Harambee Stars" OR "Football Kenya Federation" OR FKF',
  '"Harambee Starlets" OR "Kenya women football"',
  '"AFCON 2027" OR "Pamoja 2027"',
  '"Gor Mahia" OR "AFC Leopards" OR "Kenyan Premier League"',
  "FKF AND (corruption OR crisis OR court OR elections)",
  '"Hussein Mohammed" OR "McDonald Mariga"',
];

/** Subreddits searched on their own, with a narrower query. */
export const REDDIT_SUBREDDITS: string[] = ["Kenya", "soccer"];
export const REDDIT_SUBREDDIT_QUERY = 'FKF OR Harambee OR "Kenyan football"';

/** Mastodon reads one single-word hashtag per feed — no spaces, no operators. */
export const MASTODON_HOST = "mastodon.social";
export const MASTODON_TAGS: string[] = [
  "HarambeeStars",
  "HarambeeStarlets",
  "FootballKenya",
  "KenyanFootball",
  "KenyaFootball",
  "FKF",
  "AFCON2027",
  "FKFPL",
  "Pamoja2027",
];

/**
 * YouTube has no keyword RSS, only per-channel feeds. Channel IDs must be read
 * off each channel's page source — never guessed — so this starts empty.
 */
export const YOUTUBE_CHANNELS: { name: string; channelId: string }[] = [
  { name: "Football Kenya Federation (official)", channelId: "" },
];

/** Bluesky is per-account only. Handles go in as they are confirmed. */
export const BLUESKY_HANDLES: { name: string; handle: string }[] = [
  { name: "Football Kenya Federation", handle: "" },
];

/**
 * Meta has no free feeds. Each slot takes a URL from an external feed
 * generator; empty slots are skipped every cycle.
 */
export const META_FEEDS: {
  platform: "Facebook" | "Instagram";
  sourceName: string;
  feedUrl: string;
}[] = [
  { platform: "Facebook", sourceName: "FKF official Page", feedUrl: "" },
  { platform: "Facebook", sourceName: "Harambee Stars Page", feedUrl: "" },
  { platform: "Instagram", sourceName: "FKF official account", feedUrl: "" },
  { platform: "Instagram", sourceName: "#HarambeeStars hashtag", feedUrl: "" },
  { platform: "Instagram", sourceName: "#AFCON2027 hashtag", feedUrl: "" },
];

export function redditSearchUrl(query: string): string {
  return `https://www.reddit.com/search.rss?q=${encodeURIComponent(query)}&sort=new`;
}

export function redditSubredditUrl(subreddit: string, query: string): string {
  return `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.rss?q=${encodeURIComponent(
    query,
  )}&restrict_sr=1&sort=new`;
}

export function mastodonTagUrl(tag: string, host: string = MASTODON_HOST): string {
  return `https://${host}/tags/${encodeURIComponent(tag)}.rss`;
}

export function youtubeChannelUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

export function blueskyProfileUrl(handle: string): string {
  return `https://bsky.app/profile/${encodeURIComponent(handle.replace(/^@/, ""))}/rss`;
}
