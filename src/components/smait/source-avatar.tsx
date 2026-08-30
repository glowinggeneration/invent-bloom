/**
 * Avatar that always prefers the real profile image supplied by the source
 * platform, falling back to account initials only when none is available.
 */
import { useState } from "react";
import { PlatformBadge } from "./platform-icon";

const SIZES = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-xs",
  lg: "h-16 w-16 text-base",
} as const;

export function SourceAvatar({
  name,
  src,
  platform,
  size = "sm",
  showPlatform = false,
}: {
  name?: string;
  src?: string;
  platform?: string;
  size?: keyof typeof SIZES;
  showPlatform?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const label = (name ?? "Unknown").replace(/^@/, "");
  const initials =
    label
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <span className="relative inline-block shrink-0">
      {src && !failed ? (
        <img
          src={src}
          alt={`${label} profile picture`}
          loading="lazy"
          onError={() => setFailed(true)}
          className={`${SIZES[size]} rounded-full object-cover ring-1 ring-border`}
        />
      ) : (
        <span
          aria-hidden
          className={`${SIZES[size]} grid place-items-center rounded-full bg-muted font-semibold text-muted-foreground ring-1 ring-border`}
        >
          {initials}
        </span>
      )}
      {showPlatform && platform && (
        <PlatformBadge platform={platform} className="absolute -bottom-0.5 -right-0.5" />
      )}
    </span>
  );
}
