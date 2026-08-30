import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { resolveExternalProfiles, type ExternalProfile } from "@/lib/external-profiles.functions";
import { BadgeCheck } from "lucide-react";
import { AccountAvatar } from "@/components/account-identity";

const norm = (h?: string | null) => (h ?? "").trim().replace(/^@/, "").toLowerCase();

/**
 * Looks up the public profiles (name + picture) of people the personas
 * replied to or engaged with.
 */
export function useExternalProfiles(handles: (string | null | undefined)[]) {
  const resolve = useServerFn(resolveExternalProfiles);
  const list = Array.from(new Set(handles.map(norm).filter(Boolean))).sort();
  const query = useQuery({
    queryKey: ["external-profiles", list.join(",")],
    queryFn: () => resolve({ data: { handles: list } }),
    enabled: list.length > 0,
    staleTime: 30 * 60 * 1000,
  });
  const byHandle = new Map<string, ExternalProfile>();
  for (const p of query.data ?? []) byHandle.set(norm(p.handle), p);
  return {
    profiles: query.data ?? [],
    lookup: (handle?: string | null) => byHandle.get(norm(handle)) ?? null,
    isLoading: query.isLoading,
  };
}

/** Blue check shown next to any account X has verified. */
export function VerifiedBadge({ className = "size-4" }: { className?: string }) {
  return (
    <BadgeCheck className={`shrink-0 text-x-blue ${className}`} aria-label="Verified account" />
  );
}

/** Shows an external X user by display name and profile picture. */
export function ExternalIdentity({
  handle,
  fallbackName,
  avatarUrl,
  verified,
  subtitle,
  avatarClassName = "size-6",
  nameClassName = "truncate type-meta font-medium",
  className = "",
}: {
  handle?: string | null;
  fallbackName?: string | null;
  avatarUrl?: string | null;
  /** Force the verified state when the caller already knows it. */
  verified?: boolean;
  subtitle?: React.ReactNode;
  avatarClassName?: string;
  nameClassName?: string;
  className?: string;
}) {
  const { lookup } = useExternalProfiles([handle]);
  const profile = lookup(handle);
  const name = profile?.displayName || fallbackName || handle || "Unknown";
  const picture = profile?.avatarUrl ?? avatarUrl ?? null;
  const meta =
    subtitle ??
    (profile && profile.followers > 0 ? `${profile.followers.toLocaleString()} followers` : null);
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      <AccountAvatar displayName={name} avatarUrl={picture} className={avatarClassName} />
      <span className="min-w-0">
        <span className={`flex min-w-0 items-center gap-1 ${nameClassName}`}>
          <span className="truncate">{name}</span>
          {(verified ?? profile?.isVerified) ? <VerifiedBadge className="size-3.5" /> : null}
        </span>
        {meta ? (
          <span className="block truncate type-meta font-normal text-muted-foreground">{meta}</span>
        ) : null}
      </span>
    </span>
  );
}
