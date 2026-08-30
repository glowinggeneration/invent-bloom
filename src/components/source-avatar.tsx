import { useEffect, useState } from "react";
import { Globe } from "lucide-react";

export type SourcePlatform =
  | "x"
  | "facebook"
  | "facebook_groups"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "youtube"
  | "threads"
  | "news"
  | "other";

const BRAND: Record<string, { bg: string; path: string; viewBox?: string }> = {
  x: {
    bg: "#000000",
    path: "M18.9 2h3.3l-7.2 8.3L23.4 22h-6.6l-5.2-6.8L5.7 22H2.4l7.7-8.8L1.8 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20Z",
  },
  facebook: {
    bg: "#1877F2",
    path: "M22 12a10 10 0 1 0-11.6 9.9v-7h-2.5V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z",
  },
  instagram: {
    bg: "#E1306C",
    path: "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.8-.1Zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4Zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3Zm6.9-11.1a1.5 1.5 0 1 1-1.6-1.6 1.5 1.5 0 0 1 1.6 1.6Z",
  },
  tiktok: {
    bg: "#000000",
    path: "M16.6 2h-3v13.1a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .7.1V9.5a5.7 5.7 0 1 0 5 5.6V8.7a6.6 6.6 0 0 0 3.9 1.3V7a3.9 3.9 0 0 1-3.9-3.9V2Z",
  },
  linkedin: {
    bg: "#0A66C2",
    path: "M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5ZM3 9.5h4V21H3V9.5Zm7 0h3.8v1.6h.05a4.2 4.2 0 0 1 3.75-2c4 0 4.75 2.6 4.75 6V21h-4v-5.2c0-1.25 0-2.85-1.75-2.85s-2 1.35-2 2.75V21h-4V9.5Z",
  },
  youtube: {
    bg: "#FF0000",
    path: "M23 12s0-3.4-.4-5a2.5 2.5 0 0 0-1.8-1.8C19.1 4.8 12 4.8 12 4.8s-7.1 0-8.8.4A2.5 2.5 0 0 0 1.4 7C1 8.6 1 12 1 12s0 3.4.4 5a2.5 2.5 0 0 0 1.8 1.8c1.7.4 8.8.4 8.8.4s7.1 0 8.8-.4A2.5 2.5 0 0 0 22.6 17c.4-1.6.4-5 .4-5ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z",
  },
  threads: {
    bg: "#000000",
    path: "M12.2 22C6.6 22 3 18.2 3 12S6.7 2 12.2 2c4 0 6.9 1.7 8.3 4.9l-2 .9c-1.1-2.4-3.2-3.6-6.3-3.6C8.1 4.2 5.2 7 5.2 12s2.9 7.8 7 7.8c3.6 0 5.5-1.6 5.5-3.5 0-1.3-.8-2.3-2.2-2.9-.4 2.3-2 3.7-4.3 3.7-2.2 0-3.8-1.3-3.8-3.2 0-2.1 1.8-3.4 4.5-3.4.8 0 1.5.1 2.2.2 0-1.4-.9-2.2-2.4-2.2-1.1 0-2 .4-2.6 1.2l-1.6-1.2c1-1.3 2.5-2 4.3-2 2.8 0 4.5 1.7 4.5 4.5v.3c2.2.8 3.5 2.5 3.5 4.9 0 3.3-3 5.8-7.6 5.8Zm-.3-9.6c-1.5 0-2.4.6-2.4 1.5s.7 1.4 1.8 1.4c1.5 0 2.4-1 2.6-2.7-.6-.1-1.3-.2-2-.2Z",
  },
};

/**
 * Avatar for a ranked source. Tries the real profile / publication image and
 * quietly falls back to the platform's own logo when it fails to load.
 */
export function SourceAvatar({
  src,
  name,
  platform,
  className = "size-7",
}: {
  src: string | null;
  name: string;
  platform: SourcePlatform;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const brand = BRAND[platform === "facebook_groups" ? "facebook" : platform];

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${className} shrink-0 rounded-full bg-muted object-cover`}
      />
    );
  }

  if (brand) {
    return (
      <span
        className={`${className} flex shrink-0 items-center justify-center rounded-full`}
        style={{ backgroundColor: brand.bg }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="size-[60%] fill-white" role="presentation">
          <path d={brand.path} />
        </svg>
      </span>
    );
  }

  if (platform === "news") {
    return (
      <span
        className={`${className} flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground`}
        aria-hidden="true"
      >
        <Globe className="size-[55%]" />
      </span>
    );
  }

  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold`}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Favicon for a publication, used when no logo came with the article. */
export function faviconFor(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
  } catch {
    return null;
  }
}
