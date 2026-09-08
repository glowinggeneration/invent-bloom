import { describe, expect, it } from "vitest";
import {
  IMPORTANCE_RANK,
  matchesMentionTopic,
  mentionImportance,
  mentionNoiseKey,
  sourceAuthority,
} from "./mention-intelligence";

describe("matchesMentionTopic", () => {
  it("uses the known Overview narrative patterns", () => {
    expect(matchesMentionTopic("The chairperson speaks about board governance", "leadership")).toBe(
      true,
    );
    expect(
      matchesMentionTopic("New training ground and stadium investment announced", "stadium"),
    ).toBe(true);
    expect(matchesMentionTopic("Harambee Starlets prepare for their qualifier", "harambee")).toBe(
      true,
    );
    expect(matchesMentionTopic("A routine weather update", "grassroots")).toBe(false);
  });

  it("supports an ordinary multi-word investigation query", () => {
    expect(
      matchesMentionTopic("Coach education for youth academies is expanding", "coach education"),
    ).toBe(true);
    expect(matchesMentionTopic("Coach appointments announced", "coach education")).toBe(false);
  });

  it("does not filter when no usable topic is supplied", () => {
    expect(matchesMentionTopic("anything", "")).toBe(true);
    expect(matchesMentionTopic("anything", null)).toBe(true);
  });
});

describe("mentionNoiseKey", () => {
  it("collapses links, handles, hashtags and repost boilerplate", () => {
    const first = mentionNoiseKey(
      "RT @one: The federation launches youth programme #FootballKE https://t.co/abc",
    );
    const second = mentionNoiseKey(
      "via @two The federation launches youth programme #KenyaFootball https://example.com/story",
    );
    expect(first).toBe(second);
  });

  it("keeps materially different wording separate", () => {
    expect(mentionNoiseKey("The federation launches youth programme")).not.toBe(
      mentionNoiseKey("The federation suspends youth programme"),
    );
  });
});

describe("sourceAuthority", () => {
  it("treats verified accounts and publications as high authority", () => {
    expect(sourceAuthority({ verified: true })).toBe("High");
    expect(sourceAuthority({ isPublication: true })).toBe("High");
  });

  it("uses observed attention for medium authority", () => {
    expect(sourceAuthority({ views: 10_000 })).toBe("Medium");
    expect(sourceAuthority({ engagement: 500 })).toBe("Medium");
    expect(sourceAuthority({ views: 999, engagement: 12 })).toBe("Standard");
  });
});

describe("mentionImportance", () => {
  it("reserves Critical for damaging high-authority conversation with a strong signal", () => {
    expect(mentionImportance({ sentiment: "negative", authority: "High", views: 50_000 })).toBe(
      "Critical",
    );
    expect(mentionImportance({ sentiment: "negative", authority: "High", directReply: true })).toBe(
      "Critical",
    );
  });

  it("labels strong reach, engagement or direct replies as High impact", () => {
    expect(mentionImportance({ sentiment: "positive", views: 25_000 })).toBe("High impact");
    expect(mentionImportance({ engagement: 500 })).toBe("High impact");
    expect(mentionImportance({ directReply: true })).toBe("High impact");
  });

  it("keeps lower-signal material below the priority tiers", () => {
    expect(mentionImportance({ authority: "Medium" })).toBe("Relevant");
    expect(mentionImportance({ views: 2_500 })).toBe("Relevant");
    expect(mentionImportance({ views: 20, engagement: 1 })).toBe("Low signal");
  });

  it("keeps the exported priority rank in descending importance order", () => {
    expect(IMPORTANCE_RANK.Critical).toBeGreaterThan(IMPORTANCE_RANK["High impact"]);
    expect(IMPORTANCE_RANK["High impact"]).toBeGreaterThan(IMPORTANCE_RANK.Relevant);
    expect(IMPORTANCE_RANK.Relevant).toBeGreaterThan(IMPORTANCE_RANK["Low signal"]);
  });
});
