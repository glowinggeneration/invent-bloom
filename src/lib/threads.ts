export type ThreadListItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  visibility: "private" | "workspace";
  pinned: boolean;
  isOwner: boolean;
  ownerName: string;
  confidence: number | null;
  personas?: string[];
  segments?: string[];
  reaction?: "positive" | "neutral" | "negative" | null;
};

export type Profile = {
  id: string;
  email: string;
  fullName: string;
  org: "team" | "external";
  /** The configured organisation name, or "Team" when unconfigured. */
  workspaceName: string;
};
