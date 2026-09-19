import { useMemo } from "react";
import { AvatarCircles } from "@/registry/magicui/avatar-circles";
import { useExternalProfiles } from "@/components/external-identity";
import type { BrandMention } from "@/lib/brand-mentions.functions";
import type { SocialMention } from "@/lib/apify-mentions.functions";

/** Most-recent distinct authors shown as avatars before the feed truncates into "+N". */
const MAX_AVATARS = 8;

type Author =
  | { kind: "x"; handle: string; name: string | null; time: number }
  | {
      kind: "social";
      handle: string;
      name: string | null;
      avatar: string | null;
      url: string | null;
      time: number;
    };

function authorKey(a: Author) {
  return `${a.kind}:${a.handle.replace(/^@/, "").toLowerCase()}`;
}

/**
 * "Who's talking about you" strip — overlapping avatars for the most recent
 * distinct authors across X mentions and other social platforms. Purely
 * decorative, so it renders nothing while avatars are still resolving or if
 * none can be shown with a real picture.
 */
export function MentionsAvatarStrip({
  mentions,
  social,
}: {
  mentions: BrandMention[];
  social: SocialMention[];
}) {
  const authors = useMemo(() => {
    const combined: Author[] = [
      ...mentions
        .filter((m) => m.authorHandle)
        .map((m) => ({
          kind: "x" as const,
          handle: m.authorHandle,
          name: m.authorName,
          time: m.createdAt ? new Date(m.createdAt).getTime() : 0,
        })),
      ...social
        .filter((s) => s.authorHandle)
        .map((s) => ({
          kind: "social" as const,
          handle: s.authorHandle as string,
          name: s.authorName,
          avatar: s.authorAvatar,
          url: s.url,
          time: s.publishedAt ? new Date(s.publishedAt).getTime() : 0,
        })),
    ];
    combined.sort((a, b) => b.time - a.time);

    const seen = new Set<string>();
    const deduped: Author[] = [];
    for (const a of combined) {
      const key = authorKey(a);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(a);
    }
    return deduped;
  }, [mentions, social]);

  const xHandles = useMemo(
    () =>
      authors
        .filter((a): a is Extract<Author, { kind: "x" }> => a.kind === "x")
        .map((a) => a.handle),
    [authors],
  );
  const { lookup, isLoading } = useExternalProfiles(xHandles);

  const { avatarUrls, remaining } = useMemo(() => {
    const capped = authors.slice(0, MAX_AVATARS);
    let skipped = authors.length - capped.length;
    const urls: { imageUrl: string; profileUrl?: string; alt?: string }[] = [];
    for (const a of capped) {
      if (a.kind === "x") {
        const avatarUrl = lookup(a.handle)?.avatarUrl;
        if (!avatarUrl) {
          skipped += 1;
          continue;
        }
        urls.push({
          imageUrl: avatarUrl,
          profileUrl: `https://x.com/${a.handle.replace(/^@/, "")}`,
          alt: a.name || a.handle,
        });
      } else {
        if (!a.avatar) {
          skipped += 1;
          continue;
        }
        urls.push({
          imageUrl: a.avatar,
          alt: a.name || a.handle,
          ...(a.url ? { profileUrl: a.url } : {}),
        });
      }
    }
    return { avatarUrls: urls, remaining: skipped };
  }, [authors, lookup]);

  if (authors.length === 0 || isLoading || avatarUrls.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <AvatarCircles avatarUrls={avatarUrls} {...(remaining > 0 ? { numPeople: remaining } : {})} />
      <span className="type-meta text-muted-foreground">Recent voices</span>
    </div>
  );
}
