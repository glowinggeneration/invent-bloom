import { describe, expect, it } from "vitest";

import { deriveCampaignManagerMode } from "./campaign-manager-state";

describe("deriveCampaignManagerMode", () => {
  it("keeps the unresolved request in loading", () => {
    expect(
      deriveCampaignManagerMode({
        isLoading: true,
        isError: false,
        totalCampaigns: 0,
        visibleCampaigns: 0,
        hasActiveFilters: false,
      }),
    ).toBe("loading");
  });

  it("does not turn a failed request into first use", () => {
    expect(
      deriveCampaignManagerMode({
        isLoading: false,
        isError: true,
        totalCampaigns: 0,
        visibleCampaigns: 0,
        hasActiveFilters: false,
      }),
    ).toBe("error");
  });

  it("uses one first-use state when the workspace has no campaigns", () => {
    expect(
      deriveCampaignManagerMode({
        isLoading: false,
        isError: false,
        totalCampaigns: 0,
        visibleCampaigns: 0,
        hasActiveFilters: false,
      }),
    ).toBe("first-use");
  });

  it("keeps controls visible for an empty filtered result", () => {
    expect(
      deriveCampaignManagerMode({
        isLoading: false,
        isError: false,
        totalCampaigns: 7,
        visibleCampaigns: 0,
        hasActiveFilters: true,
      }),
    ).toBe("filtered-empty");
  });

  it("renders the manager when campaigns are available", () => {
    expect(
      deriveCampaignManagerMode({
        isLoading: false,
        isError: false,
        totalCampaigns: 7,
        visibleCampaigns: 4,
        hasActiveFilters: true,
      }),
    ).toBe("ready");
  });
});
