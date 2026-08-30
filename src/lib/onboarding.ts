/** Shared types for the guided profile setup that runs after sign-in. */

export type SetupStatus = {
  needsSetup: boolean;
  fullName: string;
  jobTitle: string;
  team: string;
  phone: string;
  brandName: string;
  brandHandle: string;
  keywords: string[];
  socials: SetupSocials;
};

export type SetupSocials = {
  facebook: string;
  instagram: string;
  tiktok: string;
  youtube: string;
};

export const EMPTY_SOCIALS: SetupSocials = {
  facebook: "",
  instagram: "",
  tiktok: "",
  youtube: "",
};

export const SOCIAL_FIELDS: { key: keyof SetupSocials; label: string; placeholder: string }[] = [
  { key: "facebook", label: "Facebook page", placeholder: "FootballKenyaFederation" },
  { key: "instagram", label: "Instagram", placeholder: "football_kenya_federation" },
  { key: "tiktok", label: "TikTok", placeholder: "footballkenya" },
  { key: "youtube", label: "YouTube", placeholder: "@FootballKenyaFederation" },
];

/** Clean a handle for storage: strip @, URLs and spaces. */
export function cleanHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .trim();
}
