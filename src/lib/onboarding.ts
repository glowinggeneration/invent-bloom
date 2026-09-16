/** Shared types for the guided profile setup that runs after sign-in. */

export type SetupStatus = {
  needsSetup: boolean;
  fullName: string;
  jobTitle: string;
  team: string;
  phone: string;
  /** Whether the saved phone number is on WhatsApp (urgent alerts). */
  phoneWhatsapp: boolean;
  brandName: string;
  brandHandle: string;
  /** Postal or street address of the organisation. */
  orgAddress: string;
  /** Public website address. */
  orgWebsite: string;
  /** Short description of what the organisation does. */
  orgDescription: string;
  /** Storage path of an uploaded company profile document ("" when none). */
  orgProfilePath: string;
  /** Original file name of the uploaded company profile document. */
  orgProfileName: string;
  /** Named individuals to track alongside the organisation (leadership, spokespeople). */
  keyFigures: string[];
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
  { key: "facebook", label: "Facebook page", placeholder: "YourOrganisation" },
  { key: "instagram", label: "Instagram", placeholder: "your_organisation" },
  { key: "tiktok", label: "TikTok", placeholder: "yourorganisation" },
  { key: "youtube", label: "YouTube", placeholder: "@YourOrganisation" },
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
