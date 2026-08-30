export type NegativeAlertLevel = "critical" | "important" | "off";

export type NotificationPreferences = {
  officialPosts: boolean;
  campaignCompletions: boolean;
  negativeMentions: NegativeAlertLevel;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  officialPosts: true,
  campaignCompletions: true,
  negativeMentions: "critical",
};

const STORAGE_KEY = "commsiq.notifications.preferences.v3";
const LEGACY_STORAGE_KEYS = [
  "commsiq.notifications.preferences.v2",
  "commsiq.notifications.preferences.v1",
] as const;
export const NOTIFICATION_PREFERENCES_EVENT = "commsiq:notification-preferences";

function scopedKey(scope?: string | null) {
  const safe = String(scope || "default")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);
  return `${STORAGE_KEY}.${safe}`;
}

export function readNotificationPreferences(scope?: string | null): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const specific = window.localStorage.getItem(scopedKey(scope));
    const legacy =
      LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean) ?? null;
    const raw = specific ?? legacy;
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    const negativeMentions: NegativeAlertLevel =
      parsed.negativeMentions === "important" ||
      parsed.negativeMentions === "off" ||
      parsed.negativeMentions === "critical"
        ? parsed.negativeMentions
        : DEFAULT_NOTIFICATION_PREFERENCES.negativeMentions;
    return {
      officialPosts:
        typeof parsed.officialPosts === "boolean"
          ? parsed.officialPosts
          : DEFAULT_NOTIFICATION_PREFERENCES.officialPosts,
      campaignCompletions:
        typeof parsed.campaignCompletions === "boolean"
          ? parsed.campaignCompletions
          : DEFAULT_NOTIFICATION_PREFERENCES.campaignCompletions,
      negativeMentions,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export function saveNotificationPreferences(
  preferences: NotificationPreferences,
  scope?: string | null,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scopedKey(scope), JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCES_EVENT, { detail: { scope } }));
  } catch {
    /* If device storage is unavailable, the default alert policy remains in use. */
  }
}
