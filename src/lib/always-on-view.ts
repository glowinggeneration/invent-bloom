import type { ContentCategory } from "./always-on";

/** Client-safe shapes for the always-on daily schedule. */

export type AlwaysOnPostView = {
  id: string;
  accountId: string;
  slotIndex: number;
  category: ContentCategory;
  topic: string;
  content: string;
  imageUrl: string | null;
  imageCreditName: string | null;
  imageCreditUrl: string | null;
  scheduledAt: string;
  status: "scheduled" | "held" | "published" | "failed" | "skipped";
  reviewNotes: string;
  legalLabel: string | null;
  legalLevel: number | null;
  error: string | null;
  resultTweetId: string | null;
};

export type AlwaysOnPlanView = {
  id: string;
  accountId: string;
  handle: string;
  displayName: string;
  personaId: string;
  personaName: string;
  date: string;
  activityType: string;
  target: number;
  campaignCount: number;
  notes: string;
  posts: AlwaysOnPostView[];
};

export const STATUS_LABELS: Record<AlwaysOnPostView["status"], string> = {
  scheduled: "Scheduled",
  held: "Held for review",
  published: "Published",
  failed: "Failed",
  skipped: "Skipped",
};
