export type CampaignManagerMode = "loading" | "error" | "first-use" | "ready" | "filtered-empty";

export type CampaignManagerStateInput = {
  isLoading: boolean;
  isError: boolean;
  totalCampaigns: number;
  visibleCampaigns: number;
  hasActiveFilters: boolean;
};

/**
 * Keeps request failure, first use and an empty filtered result distinct.
 * A failed request must never be presented as a valid zero-campaign result.
 */
export function deriveCampaignManagerMode({
  isLoading,
  isError,
  totalCampaigns,
  visibleCampaigns,
  hasActiveFilters,
}: CampaignManagerStateInput): CampaignManagerMode {
  if (isLoading) return "loading";
  if (isError) return "error";
  if (totalCampaigns === 0) return "first-use";
  if (visibleCampaigns === 0 && hasActiveFilters) return "filtered-empty";
  return "ready";
}
