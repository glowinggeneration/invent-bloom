import { useQuery } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAccountDirectory,
  type AccountDirectoryEntry,
} from "@/lib/account-directory.functions";

const norm = (handle?: string | null) => (handle ?? "").trim().replace(/^@/, "").toLowerCase();

export function useAccountDirectory() {
  const fetchDirectory = useServerFn(listAccountDirectory);
  const query = useQuery({
    queryKey: ["account-directory"],
    queryFn: () => fetchDirectory(),
    staleTime: 5 * 60 * 1000,
  });
  const byHandle = new Map<string, AccountDirectoryEntry>();
  for (const entry of query.data ?? []) byHandle.set(norm(entry.handle), entry);
  return {
    entries: query.data ?? [],
    lookup: (handle?: string | null) => byHandle.get(norm(handle)) ?? null,
  };
}

export function AccountAvatar({
  handle,
  displayName,
  avatarUrl,
  className = "size-7",
}: {
  handle?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  className?: string;
}) {
  const name = displayName || handle || "Account";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${name} profile picture`}
        loading="lazy"
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold uppercase text-muted-foreground`}
    >
      {name.slice(0, 2)}
    </span>
  );
}

/**
 * Shows an account by its display name and picture instead of its @handle.
 * Falls back to the directory entry for the handle when name/avatar aren't passed in.
 */
export function AccountIdentity({
  handle,
  displayName,
  avatarUrl,
  subtitle,
  avatarClassName = "size-7",
  className = "",
  nameClassName = "truncate font-medium",
  showAvatar = true,
  verified,
}: {
  handle?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  subtitle?: React.ReactNode;
  avatarClassName?: string;
  className?: string;
  nameClassName?: string;
  showAvatar?: boolean;
  /** Force the verified state when the caller already knows it. */
  verified?: boolean;
}) {
  const { lookup } = useAccountDirectory();
  const entry = lookup(handle);
  const name = displayName || entry?.displayName || handle || "Account";
  const picture = avatarUrl ?? entry?.avatarUrl ?? null;
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      {showAvatar && (
        <AccountAvatar
          handle={handle ?? null}
          displayName={name}
          avatarUrl={picture}
          className={avatarClassName}
        />
      )}
      <span className="min-w-0">
        <span className={`flex min-w-0 items-center gap-1 ${nameClassName}`}>
          <span className="truncate">{name}</span>
          {(verified ?? entry?.isVerified) ? (
            <BadgeCheck className="size-3.5 shrink-0 text-x-blue" aria-label="Verified account" />
          ) : null}
        </span>
        {subtitle ? (
          <span className="block truncate type-meta font-normal text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
