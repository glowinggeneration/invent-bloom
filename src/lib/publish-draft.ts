/**
 * Local autosave for the publish composer so a navigation, refresh or accidental
 * tab close never loses an in-progress message. Drafts stay on the device.
 */
import { readWithLegacyKey } from "@/lib/legacy-storage";

export type PublishDraft = {
  mode: string;
  tweetText: string;
  commentText: string;
  targetTweetUrl: string;
  linkUrl: string;
  media: { url: string; kind?: string; name?: string }[];
  likeTarget: boolean;
  varyByPersona: boolean;
  objectiveMode: boolean;
  tone: string;
  intensity: number;
  actions: { like: boolean; retweet: boolean; bookmark: boolean; follow: boolean };
  targets: { author: boolean; peer: boolean; watchlist: boolean };
  selected: string[];
  savedAt: number;
};

const KEY = "smait.publish.draft.v1";
const LEGACY_KEY = "fkf.publish.draft.v1";

export function isDraftEmpty(
  draft: Pick<PublishDraft, "tweetText" | "commentText" | "targetTweetUrl" | "linkUrl" | "media">,
) {
  return (
    draft.tweetText.trim().length === 0 &&
    draft.commentText.trim().length === 0 &&
    draft.targetTweetUrl.trim().length === 0 &&
    draft.linkUrl.trim().length === 0 &&
    draft.media.length === 0
  );
}

export function loadPublishDraft(): PublishDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readWithLegacyKey(KEY, LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublishDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      mode: parsed.mode ?? "comment",
      tweetText: parsed.tweetText ?? "",
      commentText: parsed.commentText ?? "",
      targetTweetUrl: parsed.targetTweetUrl ?? "",
      linkUrl: parsed.linkUrl ?? "",
      media: Array.isArray(parsed.media) ? parsed.media : [],
      likeTarget: parsed.likeTarget ?? true,
      varyByPersona: parsed.varyByPersona ?? true,
      objectiveMode: parsed.objectiveMode ?? false,
      tone: parsed.tone ?? "auto",
      intensity: typeof parsed.intensity === "number" ? parsed.intensity : 3,
      actions: {
        like: parsed.actions?.like ?? true,
        retweet: parsed.actions?.retweet ?? true,
        bookmark: parsed.actions?.bookmark ?? true,
        follow: parsed.actions?.follow ?? true,
      },
      targets: {
        author: parsed.targets?.author ?? true,
        peer: parsed.targets?.peer ?? true,
        watchlist: parsed.targets?.watchlist ?? true,
      },
      selected: Array.isArray(parsed.selected) ? parsed.selected : [],
      savedAt: parsed.savedAt ?? 0,
    };
  } catch {
    return null;
  }
}

export function savePublishDraft(draft: Omit<PublishDraft, "savedAt">): number | null {
  if (typeof window === "undefined") return null;
  const savedAt = Date.now();
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt }));
    return savedAt;
  } catch {
    return null;
  }
}

export function clearPublishDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable - nothing to clean up */
  }
}

/* ---------------------------------------------------------------
 * Shared engagement preset - one set of action/target toggles that
 * can be reused across every draft and queued message.
 * ------------------------------------------------------------- */

export type EngagementPreset = {
  applyToAll: boolean;
  actions: { like: boolean; retweet: boolean; bookmark: boolean; follow: boolean };
  targets: { author: boolean; peer: boolean; watchlist: boolean };
};

const PRESET_KEY = "smait.publish.engagement-preset.v1";
const LEGACY_PRESET_KEY = "fkf.publish.engagement-preset.v1";

export const DEFAULT_ENGAGEMENT_PRESET: EngagementPreset = {
  applyToAll: false,
  actions: { like: true, retweet: true, bookmark: true, follow: true },
  targets: { author: true, peer: true, watchlist: true },
};

export function loadEngagementPreset(): EngagementPreset | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readWithLegacyKey(PRESET_KEY, LEGACY_PRESET_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as EngagementPreset;
    if (!p || typeof p !== "object") return null;
    return {
      applyToAll: p.applyToAll === true,
      actions: {
        like: p.actions?.like ?? true,
        retweet: p.actions?.retweet ?? true,
        bookmark: p.actions?.bookmark ?? true,
        follow: p.actions?.follow ?? true,
      },
      targets: {
        author: p.targets?.author ?? true,
        peer: p.targets?.peer ?? true,
        watchlist: p.targets?.watchlist ?? true,
      },
    };
  } catch {
    return null;
  }
}

export function saveEngagementPreset(preset: EngagementPreset) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRESET_KEY, JSON.stringify(preset));
  } catch {
    /* storage unavailable - the preset simply won't persist */
  }
}
