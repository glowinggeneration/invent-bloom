import { describe, expect, it } from "vitest";
import {
  emptySummary,
  isReachEstimated,
  reachOf,
  scopeSummary,
  type PerformanceRow,
  type PerformanceSummary,
} from "./performance";

function row(overrides: Partial<PerformanceRow> = {}): PerformanceRow {
  return {
    tweetId: "1",
    handle: "acct",
    kind: "tweet",
    content: "hello",
    likes: 0,
    retweets: 0,
    replies: 0,
    quotes: 0,
    bookmarks: 0,
    impressions: 0,
    engagements: 0,
    reach: 0,
    tweetedAt: "2026-09-20T00:00:00Z",
    fetchedAt: "2026-09-20T00:00:00Z",
    url: "https://x.com/acct/status/1",
    campaignId: null,
    campaignName: null,
    targetHandle: null,
    ...overrides,
  };
}

function summaryWith(rows: PerformanceRow[]): PerformanceSummary {
  return { ...emptySummary(), rows };
}

describe("isReachEstimated matches reachOf's own fallback condition", () => {
  it("is true whenever reachOf would use the amplification formula", () => {
    expect(isReachEstimated(0)).toBe(true);
    expect(isReachEstimated(-1)).toBe(true);
  });

  it("is false whenever reachOf would use real impressions", () => {
    expect(isReachEstimated(1)).toBe(false);
    expect(isReachEstimated(5000)).toBe(false);
  });

  it("reachOf's branch condition and isReachEstimated never disagree", () => {
    for (const impressions of [-5, 0, 1, 500]) {
      const usedRealImpressions = reachOf(impressions, 10, 10) === impressions;
      expect(usedRealImpressions).toBe(!isReachEstimated(impressions));
    }
  });
});

describe("emptySummary never implies confirmed zero performance", () => {
  const empty = emptySummary();

  it("engagementRateAvailable is false, not a bare 0%", () => {
    expect(empty.totals.engagementRateAvailable).toBe(false);
  });

  it("reachIncludesEstimates is false (there is no reach at all, estimated or real)", () => {
    expect(empty.totals.reachIncludesEstimates).toBe(false);
  });

  it("sourceCoverage starts at zero/zero, not omitted", () => {
    expect(empty.sourceCoverage).toEqual({ executedPosts: 0, postsWithMetrics: 0 });
  });
});

describe("scopeSummary computes engagementRateAvailable and reachIncludesEstimates from the scoped rows", () => {
  it("is available when at least one scoped row has real impressions", () => {
    const summary = summaryWith([
      row({ campaignId: null, impressions: 1000, engagements: 50, reach: 1000 }),
    ]);
    const scoped = scopeSummary(summary, "none");
    expect(scoped.totals.engagementRateAvailable).toBe(true);
    expect(scoped.totals.engagementRate).toBeCloseTo(5, 5);
  });

  it("is unavailable when every scoped row has zero impressions - never silently 0%", () => {
    const summary = summaryWith([
      row({ campaignId: null, impressions: 0, engagements: 0, reach: 0 }),
    ]);
    const scoped = scopeSummary(summary, "none");
    expect(scoped.totals.engagementRateAvailable).toBe(false);
    expect(scoped.totals.engagementRate).toBe(0);
  });

  it("flags reachIncludesEstimates true when any scoped row's reach came from the fallback formula", () => {
    const summary = summaryWith([
      row({ campaignId: null, impressions: 500, retweets: 1, reach: 500 }),
      row({
        tweetId: "2",
        campaignId: null,
        impressions: 0,
        retweets: 2,
        quotes: 1,
        reach: reachOf(0, 2, 1),
      }),
    ]);
    const scoped = scopeSummary(summary, "none");
    expect(scoped.totals.reachIncludesEstimates).toBe(true);
  });

  it("leaves reachIncludesEstimates false when every scoped row has real impressions", () => {
    const summary = summaryWith([
      row({ campaignId: null, impressions: 500, reach: 500 }),
      row({ tweetId: "2", campaignId: null, impressions: 200, reach: 200 }),
    ]);
    const scoped = scopeSummary(summary, "none");
    expect(scoped.totals.reachIncludesEstimates).toBe(false);
  });
});
