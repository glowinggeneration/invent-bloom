import { useEffect, useState } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";

const PREFIX = "fkf.offline.v1:";
const MAX_ENTRIES = 40;

type Entry<T> = { at: number; data: T };

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function keyOf(queryKey: QueryKey) {
  return PREFIX + JSON.stringify(queryKey);
}

function prune(store: Storage) {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  if (keys.length <= MAX_ENTRIES) return;
  const dated = keys.map((k) => {
    let at = 0;
    try {
      at = (JSON.parse(store.getItem(k) ?? "{}") as Entry<unknown>).at ?? 0;
    } catch {
      at = 0;
    }
    return { k, at };
  });
  dated.sort((a, b) => a.at - b.at);
  for (const { k } of dated.slice(0, dated.length - MAX_ENTRIES)) store.removeItem(k);
}

export function readOfflineCache<T>(queryKey: QueryKey): Entry<T> | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(keyOf(queryKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (!parsed || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeOfflineCache<T>(queryKey: QueryKey, data: T) {
  const store = storage();
  if (!store || data === undefined) return;
  try {
    store.setItem(keyOf(queryKey), JSON.stringify({ at: Date.now(), data }));
    prune(store);
  } catch {
    /* quota or private mode - offline cache is best effort */
  }
}

export function clearOfflineCache() {
  const store = storage();
  if (!store) return;
  const keys: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  for (const k of keys) store.removeItem(k);
}

/** Tracks browser connectivity so views can explain stale data. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

type CachedQueryResult<T> = {
  data: T | undefined;
  isPending: boolean;
  /** True when the data shown came from the offline cache, not the network. */
  isOffline: boolean;
  cachedAt: number | null;
  error: unknown;
};

/**
 * useQuery + a localStorage mirror. On a failed or pending fetch (poor
 * connection) the last successful payload is returned so the screen stays
 * usable instead of showing an empty state.
 */
export function useCachedQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options?: { enabled?: boolean },
): CachedQueryResult<T> {
  const enabled = options?.enabled ?? true;
  const [fallback, setFallback] = useState<Entry<T> | null>(null);

  useEffect(() => {
    setFallback(readOfflineCache<T>(queryKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(queryKey)]);

  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    retry: 1,
    networkMode: "offlineFirst",
  });

  useEffect(() => {
    if (query.data !== undefined) writeOfflineCache(queryKey, query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const live = query.data;
  if (live !== undefined) {
    return { data: live, isPending: false, isOffline: false, cachedAt: null, error: null };
  }
  if (fallback) {
    return {
      data: fallback.data,
      isPending: false,
      isOffline: true,
      cachedAt: fallback.at,
      error: query.error,
    };
  }
  return {
    data: undefined,
    isPending: enabled && query.isPending,
    isOffline: false,
    cachedAt: null,
    error: query.error,
  };
}

export function formatCachedAt(at: number | null) {
  if (!at) return "";
  const mins = Math.max(1, Math.round((Date.now() - at) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
