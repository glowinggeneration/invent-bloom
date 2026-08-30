import type { ContentCategory } from "./always-on";

/** Client-safe shape for one published always-on post. */
export type AlwaysOnFeedItem = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  personaName: string;
  category: ContentCategory | string;
  topic: string;
  content: string;
  imageUrl: string | null;
  publishedAt: string;
  tweetId: string | null;
  tweetUrl: string | null;
};

export type AlwaysOnFeed = {
  items: AlwaysOnFeedItem[];
  total: number;
  today: number;
  accounts: number;
  lastPublishedAt: string | null;
};
