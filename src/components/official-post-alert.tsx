import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Clock3, Megaphone, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProfile } from "@/hooks/use-profile";
import {
  NOTIFICATION_PREFERENCES_EVENT,
  readNotificationPreferences,
} from "@/lib/notification-preferences";
import { getOfficialPosts, type OfficialPost } from "@/lib/overview.functions";

const REVIEW_WINDOW_MS = 60 * 60 * 1000;
const ALERT_FRESHNESS_MS = 90 * 60 * 1000;
const STORAGE_KEY = "commsiq.official-post-alert.dismissed.v2";
const LEGACY_STORAGE_KEY = "commsiq.official-post-alert.dismissed.v1";

function storageKey(scope?: string | null) {
  const safe = String(scope || "default")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);
  return `${STORAGE_KEY}.${safe}`;
}

function postedAt(post: OfficialPost): number | null {
  if (!post.postedAt) return null;
  const value = Date.parse(post.postedAt);
  return Number.isFinite(value) ? value : null;
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "Review window passed";
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes} min left in the fresh-post review window`;
  return `${Math.ceil(minutes / 60)} hr left in the fresh-post review window`;
}

function readDismissed(scope?: string | null): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(storageKey(scope)) ??
        window.localStorage.getItem(LEGACY_STORAGE_KEY) ??
        "[]",
    ) as unknown;
    return new Set(
      Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function dismiss(id: string, scope?: string | null) {
  if (typeof window === "undefined") return;
  const ids = readDismissed(scope);
  ids.add(id);
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify([...ids].slice(-40)));
  } catch {
    /* The alert can safely reappear if local storage is unavailable. */
  }
}

export function officialAmplificationBrief(post: OfficialPost) {
  return `Prepare a distinct, factual amplification post about this official update from @${post.handle}: ${post.text}`;
}

export function OfficialPostAlert() {
  const { data: profile } = useProfile();
  const scope = profile?.id ?? "default";
  const fetchPosts = useServerFn(getOfficialPosts);
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed(scope));
  const [enabled, setEnabled] = useState(() => readNotificationPreferences(scope).officialPosts);

  const query = useQuery({
    queryKey: ["official-posts"],
    queryFn: () => fetchPosts(),
    staleTime: 3 * 60 * 1000,
    refetchInterval: enabled ? 3 * 60 * 1000 : false,
    refetchOnWindowFocus: enabled,
    enabled,
  });

  useEffect(() => {
    setDismissed(readDismissed(scope));
    setEnabled(readNotificationPreferences(scope).officialPosts);
  }, [scope]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    const syncPreferences = () => setEnabled(readNotificationPreferences(scope).officialPosts);
    window.addEventListener(NOTIFICATION_PREFERENCES_EVENT, syncPreferences);
    window.addEventListener("storage", syncPreferences);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener(NOTIFICATION_PREFERENCES_EVENT, syncPreferences);
      window.removeEventListener("storage", syncPreferences);
    };
  }, [scope]);

  const post = useMemo(() => {
    if (!enabled) return null;
    const newest = query.data?.posts[0];
    if (!newest || dismissed.has(newest.tweetId)) return null;
    const at = postedAt(newest);
    if (at == null || now - at < 0 || now - at > ALERT_FRESHNESS_MS) return null;
    return newest;
  }, [dismissed, enabled, now, query.data?.posts]);

  if (!post) return null;

  const at = postedAt(post) ?? now;
  const remaining = REVIEW_WINDOW_MS - (now - at);
  const brief = officialAmplificationBrief(post);

  const close = () => {
    dismiss(post.tweetId, scope);
    setDismissed((current) => new Set([...current, post.tweetId]));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Megaphone className="size-4" />
            <span className="type-meta font-semibold uppercase tracking-wide">
              New official post
            </span>
          </div>
          <DialogTitle>{post.name} has just posted</DialogTitle>
          <DialogDescription>
            Review the opportunity while the conversation is fresh. CommsIQ will help prepare
            distinct, relevant amplification content; it will not automatically boost the post with
            every linked account.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 type-meta font-semibold text-primary">
            <Clock3 className="size-4" /> {formatRemaining(remaining)}
          </div>
          <p className="mt-3 line-clamp-5 type-body leading-relaxed">{post.text}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 type-meta text-muted-foreground">
            <span>{post.impressions.toLocaleString()} views</span>
            <span>{post.likes.toLocaleString()} likes</span>
            <span>{post.retweets.toLocaleString()} reposts</span>
            <span>{post.replies.toLocaleString()} replies</span>
          </div>
        </div>

        <div className="rounded-xl bg-primary/5 p-4">
          <p className="type-meta font-semibold text-primary">Recommended next step</p>
          <p className="mt-1 type-body">
            Prepare a small set of genuinely different posts from relevant authorised accounts,
            review them, then launch through Campaign Preflight.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={close}>
            Later
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" onClick={close}>
              <Link to="/new" search={{ text: brief }}>
                <Sparkles className="size-4" /> Test message
              </Link>
            </Button>
            <Button asChild onClick={close}>
              <Link
                to="/campaign/$action"
                params={{ action: "post" }}
                search={{ text: brief, link: post.url }}
              >
                Prepare amplification
              </Link>
            </Button>
            <Button asChild variant="outline" onClick={close}>
              <a href={post.url} target="_blank" rel="noreferrer">
                <ArrowUpRight className="size-4" /> X
              </a>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
