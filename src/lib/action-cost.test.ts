import { describe, expect, it } from "vitest";
import { ACTION_PRICING, actionsRemaining, creditsPerAction } from "./action-cost";

describe("TwitterAPI.io V2 action pricing", () => {
  it("prices create/reply calls at 300 credits", () => {
    expect(creditsPerAction("post")).toBe(300);
    expect(creditsPerAction("comment")).toBe(300);
    expect(ACTION_PRICING.post.usd).toBe(0.003);
  });

  it("prices interaction calls at 200 credits", () => {
    expect(creditsPerAction("like")).toBe(200);
    expect(creditsPerAction("retweet")).toBe(200);
    expect(creditsPerAction("bookmark")).toBe(200);
    expect(creditsPerAction("follow")).toBe(200);
  });

  it("calculates remaining capacity by action instead of one flat assumption", () => {
    expect(actionsRemaining(3_000, "post")).toBe(10);
    expect(actionsRemaining(3_000, "comment")).toBe(10);
    expect(actionsRemaining(3_000, "retweet")).toBe(15);
  });
});
