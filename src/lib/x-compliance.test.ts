import { describe, expect, it } from "vitest";
import { contentSimilarity, reviewBatch } from "./x-compliance";

describe("X campaign compliance", () => {
  it("blocks automated follow, like and bookmark actions", () => {
    const issues = reviewBatch([
      { accountId: "a", handle: "one", actionType: "follow", targetHandle: "target" },
      { accountId: "a", handle: "one", actionType: "like", targetTweetId: "1" },
      { accountId: "a", handle: "one", actionType: "bookmark", targetTweetId: "1" },
    ]);
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["AUTOMATED_FOLLOW", "AUTOMATED_LIKE", "AUTOMATED_BOOKMARK"]),
    );
  });

  it("blocks two linked accounts acting on the same target post", () => {
    const issues = reviewBatch([
      {
        accountId: "a",
        handle: "one",
        actionType: "comment",
        targetTweetId: "123",
        content: "Thanks for asking. Here is the update.",
      },
      { accountId: "b", handle: "two", actionType: "retweet", targetTweetId: "123" },
    ]);
    expect(issues.some((issue) => issue.code === "TARGET_COLLISION")).toBe(true);
  });

  it("blocks materially similar copy across linked accounts", () => {
    const issues = reviewBatch([
      {
        accountId: "a",
        handle: "one",
        actionType: "tweet",
        content: "Coach education creates stronger teams and better pathways for young players.",
      },
      {
        accountId: "b",
        handle: "two",
        actionType: "tweet",
        content:
          "Coach education creates stronger teams and better pathways for young players across Kenya.",
      },
    ]);
    expect(issues.some((issue) => issue.code === "NEAR_DUPLICATE_CONTENT")).toBe(true);
  });

  it("allows distinct original posts for different audiences", () => {
    const issues = reviewBatch([
      {
        accountId: "a",
        handle: "club-news",
        actionType: "tweet",
        content:
          "Registration for the western region coaching clinic closes Friday. Clubs can submit two coaches.",
      },
      {
        accountId: "b",
        handle: "youth-programme",
        actionType: "tweet",
        content:
          "U15 scouts will be in Kakamega this weekend. Players should carry school identification and arrive before 8am.",
      },
    ]);
    expect(issues).toHaveLength(0);
  });

  it("returns full similarity for exact duplicate copy", () => {
    expect(
      contentSimilarity(
        "Football development starts with coaches",
        "Football development starts with coaches",
      ),
    ).toBe(1);
  });
});
