import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ExternalLink, FileCheck2, Loader2, Search } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTitle, StatCard, LockScreen, EmptyState, PageToolbar } from "@/components/ui-kit";
import { CATEGORY_LABELS } from "@/lib/always-on";
import { listAlwaysOnPublished } from "@/lib/always-on.functions";

export const Route = createFileRoute("/_authenticated/always-on")({
  head: () => ({
    meta: [
      { title: "Content Planning - FKF CommsIQ" },
      {
        name: "description",
        content:
          "Review the publication history created through the account content-planning workflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Content Planning - FKF CommsIQ" },
      {
        property: "og:description",
        content: "A review-first content planning and publication history workspace.",
      },
    ],
  }),
  component: AlwaysOnPage,
});

function when(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AlwaysOnPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  const loadFeed = useServerFn(listAlwaysOnPublished);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["always-on-feed"],
    queryFn: () => loadFeed({ data: {} }),
    enabled: isAdmin,
    refetchInterval: 2 * 60 * 1000,
  });

  const items = data?.items ?? [];
  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      !q
        ? items
        : items.filter(
            (item) =>
              item.handle.toLowerCase().includes(q) ||
              item.displayName.toLowerCase().includes(q) ||
              item.content.toLowerCase().includes(q) ||
              item.topic.toLowerCase().includes(q),
          ),
    [items, q],
  );

  if (!profileLoading && !isAdmin) {
    return (
      <WorkspaceShell title="Content Planning" wide>
        <LockScreen title="Content planning is restricted" />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell title="Content Planning" wide>
      <PageTitle
        description="Plan content ahead, review it before publishing, and keep a record of what has gone live."
        actions={
          <span className="type-meta inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 font-semibold text-foreground">
            <FileCheck2 className="size-3.5 text-primary" aria-hidden="true" /> Review-first
            publishing
          </span>
        }
      >
        Content Planning
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Published today" value={data?.today ?? 0} />
        <StatCard label="Published in total" value={data?.total ?? 0} />
        <StatCard label="Accounts represented" value={data?.accounts ?? 0} />
      </div>

      <PageToolbar className="mt-5">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search published content or account…"
            aria-label="Search published content"
            className="h-10 bg-background pl-9"
          />
        </div>
        <Button asChild variant="outline" size="sm" className="sm:ml-auto">
          <Link to="/admin/accounts">Manage account planning</Link>
        </Button>
      </PageToolbar>

      {isLoading ? (
        <div className="type-body flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading publication
          history…
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title={
              items.length === 0
                ? "No reviewed content has been published yet"
                : "Nothing matches that search"
            }
            description={
              items.length === 0
                ? "Content prepared through the planning workflow will appear here after an operator reviews and publishes it."
                : "Try a different account, topic or keyword."
            }
            action={
              items.length === 0 ? (
                <Button variant="outline" asChild>
                  <Link to="/admin/accounts">Open connected accounts</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          <div className="type-meta hidden grid-cols-[minmax(0,1fr)_180px_150px_170px] gap-4 border-b border-border bg-muted/30 px-4 py-3 font-semibold text-muted-foreground md:grid">
            <span>Content</span>
            <span>Account</span>
            <span>Type</span>
            <span>Published</span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((item) => (
              <li
                key={item.id}
                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_180px_150px_170px] md:items-center md:gap-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.topic || "Post image"}
                      loading="lazy"
                      className="size-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="size-12 shrink-0 rounded-lg bg-muted" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="type-body line-clamp-2 leading-snug">{item.content}</p>
                    {item.tweetUrl ? (
                      <a
                        href={item.tweetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="type-meta mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        View post <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2">
                  {item.avatarUrl ? (
                    <img
                      src={item.avatarUrl}
                      alt=""
                      loading="lazy"
                      className="size-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="size-7 rounded-full bg-muted" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="type-meta truncate font-semibold">
                      {item.displayName || item.handle}
                    </p>
                    {item.personaName ? (
                      <p className="type-meta truncate text-muted-foreground">{item.personaName}</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <Badge variant="secondary" className="type-meta">
                    {CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] ??
                      item.category}
                  </Badge>
                </div>

                <p className="type-meta text-muted-foreground">{when(item.publishedAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WorkspaceShell>
  );
}
