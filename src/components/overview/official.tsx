import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Clock3, Megaphone, MessageSquareText, Sparkles } from "lucide-react";

import { officialAmplificationBrief } from "@/components/official-post-alert";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui-kit";
import { getOfficialPosts, type OfficialPost } from "@/lib/overview.functions";
import { formatCompact } from "@/lib/overview";

function ageLabel(value: string | null) {
  if (!value) return "Posting time unavailable";
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return "Posting time unavailable";
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60_000));
  if (minutes < 1) return "Just posted";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function PostCard({ post }: { post: OfficialPost }) {
  const brief = officialAmplificationBrief(post);
  const fresh = post.postedAt ? Date.now() - Date.parse(post.postedAt) <= 60 * 60 * 1000 : false;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        {post.avatarUrl ? (
          <img
            src={post.avatarUrl}
            alt=""
            loading="lazy"
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="type-body truncate font-semibold">{post.name}</p>
            {fresh ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                Fresh opportunity
              </span>
            ) : null}
          </div>
          <p className="type-meta truncate text-muted-foreground">
            @{post.handle}
            {post.followers ? ` · ${formatCompact(post.followers)} followers` : ""}
          </p>
          <p className="mt-1 flex items-center gap-1 type-meta text-muted-foreground">
            <Clock3 className="size-3.5" /> {ageLabel(post.postedAt)}
          </p>
        </div>
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Open on X"
        >
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </a>
      </div>

      <p className="type-body mt-3 whitespace-pre-wrap">{post.text}</p>

      <dl className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
        {[
          { label: "Likes", value: post.likes },
          { label: "Reposts", value: post.retweets },
          { label: "Replies", value: post.replies },
          { label: "Bookmarks", value: post.bookmarks },
          { label: "Views", value: post.impressions },
        ].map((metric) => (
          <div key={metric.label}>
            <dt className="type-meta text-muted-foreground">{metric.label}</dt>
            <dd className="type-body font-semibold tabular-nums">{formatCompact(metric.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-border/60 pt-4">
        <div className="flex items-start gap-2 rounded-xl bg-primary/5 p-3">
          <Megaphone className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="type-meta text-muted-foreground">
            Write your own take from the right account — nothing posts automatically from here.
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild size="sm">
            <Link
              to="/campaign/$action"
              params={{ action: "post" }}
              search={{ text: brief, link: post.url }}
            >
              <Megaphone className="size-4" /> Amplify this
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/new" search={{ text: brief }}>
              <Sparkles className="size-4" /> Test message
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link
              to="/campaign/$action"
              params={{ action: "reply" }}
              search={{
                target: post.url,
                text: `Prepare a direct, factual response to this official post: ${post.text}`,
              }}
            >
              <MessageSquareText className="size-4" /> Reply
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Latest official post from each FKF/President account, with reviewed next actions. */
export function OfficialPosts() {
  const fetchPosts = useServerFn(getOfficialPosts);
  const { data, isLoading } = useQuery({
    queryKey: ["official-posts"],
    queryFn: () => fetchPosts(),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  return (
    <section className="grid gap-4">
      <div>
        <SectionTitle>Latest official posts</SectionTitle>
        <p className="type-meta mt-1 text-muted-foreground">
          The latest FKF and President posts, with a clear next step for each.
        </p>
      </div>
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      ) : data?.posts.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.posts.map((post) => (
            <PostCard key={post.tweetId} post={post} />
          ))}
        </div>
      ) : (
        <Card className="p-5">
          <p className="type-meta text-muted-foreground">
            {data?.error ? `Could not read X right now: ${data.error}` : "No recent official post."}
          </p>
        </Card>
      )}
    </section>
  );
}
