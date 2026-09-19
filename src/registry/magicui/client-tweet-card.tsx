import "react-tweet/theme.css";

import { EmbeddedTweet, TweetNotFound, TweetSkeleton, useTweet } from "react-tweet";
import type { Tweet } from "react-tweet/api";

import { cn } from "@/lib/utils";

/**
 * MagicUI-style client tweet card: fetches a real X/Twitter post client-side
 * (via react-tweet's `useTweet`, backed by Twitter's public syndication API)
 * and renders it as an embedded card, with loading and not-found states.
 *
 * This makes a network request to Twitter/X's own infrastructure from the
 * user's browser — not this app's backend — so only mount it where a live
 * embed is actually wanted (a single-mention detail view), not in a list
 * that renders many of these at once.
 */
export function ClientTweetCard({
  id,
  apiUrl,
  fallback = <TweetSkeleton />,
  components,
  onError,
  className,
  ...props
}: {
  id: string;
  apiUrl?: string;
  fallback?: React.ReactNode;
  components?: React.ComponentProps<typeof EmbeddedTweet>["components"];
  onError?: (error: unknown) => unknown;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { data, error, isLoading } = useTweet(id, apiUrl);

  return (
    <div className={cn("react-tweet-theme", className)} {...props}>
      {isLoading ? (
        fallback
      ) : error || !data ? (
        <TweetNotFound error={onError ? onError(error) : error} />
      ) : (
        <EmbeddedTweet tweet={data as Tweet} {...(components ? { components } : {})} />
      )}
    </div>
  );
}
