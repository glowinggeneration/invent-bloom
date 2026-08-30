import { describe, expect, it } from "vitest";
import type { BrandMention } from "./brand-mentions.functions";
import type { ManagedCampaign } from "./campaign-manager";
import type { OfficialPost } from "./overview.functions";
import { buildNotifications, isCriticalMention, isImportantNegativeMention } from "./notifications";

function mention(overrides: Partial<BrandMention> = {}): BrandMention {
  return {
    id: "m1",
    text: "FKF needs to answer this criticism.",
    authorHandle: "fan",
    authorName: "Football Fan",
    url: "https://x.com/fan/status/1",
    createdAt: "2026-08-16T12:00:00.000Z",
    likeCount: 0,
    viewCount: 0,
    mentions: [],
    sentiment: "negative",
    sentimentScore: -2,
    isVerified: false,
    isReply: false,
    replyToHandle: "",
    replyToBrand: false,
    sentimentReason: "Criticises the federation.",
    sentimentHighlights: [],
    parentText: "",
    parentAuthorHandle: "",
    parentAuthorName: "",
    source: "mention",
    matchedKeyword: "",
    ...overrides,
  };
}

function campaign(overrides: Partial<ManagedCampaign> = {}): ManagedCampaign {
  return {
    key: "publish:c1",
    source: "publish",
    id: "c1",
    name: "Grassroots campaign",
    summary: "Distinct grassroots development posts.",
    hasExecution: true,
    type: "Post campaign",
    kinds: ["tweet"],
    status: "completed",
    startedAt: "2026-08-16T12:00:00.000Z",
    completedAt: "2026-08-16T13:00:00.000Z",
    planned: 5,
    completed: 5,
    failed: 0,
    remaining: 0,
    progress: 100,
    nextRunAt: null,
    breakdown: [{ kind: "tweet", planned: 5, completed: 5, failed: 0 }],
    ...overrides,
  };
}

function officialPost(overrides: Partial<OfficialPost> = {}): OfficialPost {
  return {
    handle: "Football_Kenya",
    name: "Football Kenya Federation",
    avatarUrl: null,
    followers: 100000,
    tweetId: "1234567890123456789",
    text: "A new grassroots football update.",
    url: "https://x.com/Football_Kenya/status/1234567890123456789",
    postedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    likes: 100,
    retweets: 20,
    replies: 10,
    quotes: 2,
    bookmarks: 5,
    impressions: 12000,
    ...overrides,
  };
}

describe("mention notification thresholds", () => {
  it("keeps ordinary negative posts below the critical threshold", () => {
    const item = mention({ sentimentScore: -2, viewCount: 100, likeCount: 2 });
    expect(isCriticalMention(item)).toBe(false);
    expect(isImportantNegativeMention(item)).toBe(false);
  });

  it("raises an important alert earlier for a direct negative reply", () => {
    const item = mention({ sentimentScore: -2, replyToBrand: true });
    expect(isCriticalMention(item)).toBe(true);
    expect(isImportantNegativeMention(item)).toBe(true);
  });

  it("raises the broader threshold for negative attention before it is critical", () => {
    const item = mention({ sentimentScore: -2, viewCount: 700, likeCount: 2 });
    expect(isCriticalMention(item)).toBe(false);
    expect(isImportantNegativeMention(item)).toBe(true);
  });
});

describe("buildNotifications preferences", () => {
  it("preserves the default critical-only behaviour", () => {
    const items = buildNotifications({
      campaigns: [],
      mentions: [mention({ sentimentScore: -4 })],
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("mention");
  });

  it("creates an action notification for a fresh official post", () => {
    const items = buildNotifications({
      campaigns: [],
      mentions: [],
      officialPosts: [officialPost()],
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("official");
    expect(items[0]?.severity).toBe("action");
    expect(items[0]?.href).toBe("/overview");
  });

  it("does not create an action notification for an old official post", () => {
    const items = buildNotifications({
      campaigns: [],
      mentions: [],
      officialPosts: [
        officialPost({ postedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() }),
      ],
    });
    expect(items).toEqual([]);
  });

  it("creates completion alerts from the current Campaign Manager model", () => {
    const items = buildNotifications({ campaigns: [campaign()], mentions: [] });
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("campaign");
    expect(items[0]?.body).toContain("5 of 5 planned actions completed");
  });

  it("does not alert for a campaign that is still running", () => {
    const items = buildNotifications({
      campaigns: [
        campaign({
          status: "running",
          completedAt: null,
          completed: 3,
          remaining: 2,
          progress: 60,
        }),
      ],
      mentions: [],
    });
    expect(items).toEqual([]);
  });

  it("can disable official-post alerts", () => {
    const items = buildNotifications({
      campaigns: [],
      mentions: [],
      officialPosts: [officialPost()],
      preferences: {
        officialPosts: false,
        campaignCompletions: true,
        negativeMentions: "critical",
      },
    });
    expect(items).toEqual([]);
  });

  it("can disable negative mention alerts without removing the mention from the feed", () => {
    const items = buildNotifications({
      campaigns: [],
      mentions: [mention({ sentimentScore: -5, viewCount: 5000 })],
      preferences: { officialPosts: true, campaignCompletions: true, negativeMentions: "off" },
    });
    expect(items).toEqual([]);
  });

  it("can include important negative mentions", () => {
    const items = buildNotifications({
      campaigns: [],
      mentions: [mention({ viewCount: 800 })],
      preferences: {
        officialPosts: true,
        campaignCompletions: true,
        negativeMentions: "important",
      },
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toContain("Important negative post");
  });

  it("can disable campaign completion updates", () => {
    const items = buildNotifications({
      campaigns: [campaign()],
      mentions: [],
      preferences: {
        officialPosts: true,
        campaignCompletions: false,
        negativeMentions: "critical",
      },
    });
    expect(items).toEqual([]);
  });
});
