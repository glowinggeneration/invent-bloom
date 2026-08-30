import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useProfile } from "@/hooks/use-profile";
import { listBrandMentions } from "@/lib/brand-mentions.functions";
import { listManagedCampaigns } from "@/lib/campaign-manager.functions";
import { getOfficialPosts } from "@/lib/overview.functions";
import {
  buildNotifications,
  readIds,
  saveReadIds,
  type AppNotification,
} from "@/lib/notifications";
import {
  NOTIFICATION_PREFERENCES_EVENT,
  readNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notification-preferences";

/**
 * Notifications are derived from current workspace data: new official posts,
 * Campaign Manager completion and material negative mentions. Read state and
 * preferences are stored per signed-in profile on this device.
 */
export function useNotifications() {
  const { data: profile } = useProfile();
  const scope = profile?.id ?? "default";
  const fetchMentions = useServerFn(listBrandMentions);
  const fetchCampaigns = useServerFn(listManagedCampaigns);
  const fetchOfficialPosts = useServerFn(getOfficialPosts);

  const officialQuery = useQuery({
    queryKey: ["official-posts"],
    queryFn: () => fetchOfficialPosts(),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const mentionsQuery = useQuery({
    queryKey: ["brand-mentions", ""],
    queryFn: () => fetchMentions({ data: { cursor: "" } }),
    staleTime: 10 * 60 * 1000,
  });

  const campaignsQuery = useQuery({
    queryKey: ["managed-campaigns"],
    queryFn: () => fetchCampaigns(),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const [preferences, setPreferencesState] = useState<NotificationPreferences>(() =>
    readNotificationPreferences(scope),
  );
  useEffect(() => {
    const sync = () => setPreferencesState(readNotificationPreferences(scope));
    sync();
    window.addEventListener(NOTIFICATION_PREFERENCES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(NOTIFICATION_PREFERENCES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [scope]);

  const notifications = useMemo(
    () =>
      buildNotifications({
        campaigns: campaignsQuery.data ?? [],
        mentions: mentionsQuery.data?.mentions ?? [],
        officialPosts: officialQuery.data?.posts ?? [],
        preferences,
      }),
    [campaignsQuery.data, mentionsQuery.data, officialQuery.data, preferences],
  );

  const [read, setRead] = useState<string[]>([]);
  useEffect(() => setRead(readIds(scope)), [scope]);

  const markRead = useCallback(
    (ids: string[]) => {
      setRead((previous) => {
        const next = [...new Set([...previous, ...ids])];
        saveReadIds(next, scope);
        return next;
      });
    },
    [scope],
  );

  const setPreferences = useCallback(
    (next: NotificationPreferences) => {
      saveNotificationPreferences(next, scope);
      setPreferencesState(next);
    },
    [scope],
  );

  const readSet = useMemo(() => new Set(read), [read]);
  const items: (AppNotification & { read: boolean })[] = notifications.map((notification) => ({
    ...notification,
    read: readSet.has(notification.id),
  }));
  const unread = items.filter((notification) => !notification.read).length;

  return {
    items,
    unread,
    isPending: officialQuery.isPending || mentionsQuery.isPending || campaignsQuery.isPending,
    refresh: () => {
      void officialQuery.refetch();
      void mentionsQuery.refetch();
      void campaignsQuery.refetch();
    },
    markRead,
    markAllRead: () => markRead(notifications.map((notification) => notification.id)),
    preferences,
    setPreferences,
  };
}
