import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Download,
  Gauge,
  History,
  Loader2,
  Lock,
  MessageSquareText,
  PlusCircle,
  Search,
  ShieldAlert,
  TrendingUp,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteThread, listThreads } from "@/lib/smait.functions";
import { useCachedQuery } from "@/lib/offline-cache";
import { OfflineNotice } from "@/components/offline-notice";
import { EmptyState, PageTitle, StatCard } from "@/components/ui-kit";
import {
  CommandGrid,
  RailAction,
  RailBar,
  RailCard,
  RailStat,
  RailStatList,
} from "@/components/command-layout";
import { friendlyError } from "@/lib/friendly-errors";

type ArchiveSearch = {
  q: string;
  persona: string;
  reaction: string;
  date: string;
  sort: string;
};

function str(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export const Route = createFileRoute("/_authenticated/archive")({
  validateSearch: (search: Record<string, unknown>): ArchiveSearch => ({
    q: str(search["q"], ""),
    persona: str(search["persona"], "all"),
    reaction: str(search["reaction"], "all"),
    date: str(search["date"], "all"),
    sort: str(search["sort"], "recent"),
  }),

  head: () => ({
    meta: [
      { title: "Archive - CommsIQ" },
      {
        name: "description",
        content:
          "Every message you have tested in CommsIQ, with its persona analysis and recommended rewrites.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Archive - CommsIQ" },
      {
        property: "og:description",
        content: "Every message you have tested, saved with its analysis.",
      },
    ],
  }),
  component: ArchivePage,
});

function confidenceClass(value: number | null) {
  if (value === null) return "bg-secondary text-muted-foreground";
  if (value >= 75) return "bg-fkf-green/10 text-fkf-green";
  if (value >= 60) return "bg-neutral/15 text-foreground";
  return "bg-primary/10 text-primary";
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function ArchivePage() {
  const queryClient = useQueryClient();
  const fetchThreads = useServerFn(listThreads);
  const removeThread = useServerFn(deleteThread);
  const { q: query, persona, reaction, date: dateRange, sort } = Route.useSearch();
  const navigate = useNavigate({ from: "/archive" });
  const patch = (next: Partial<ArchiveSearch>) =>
    navigate({ search: (prev: ArchiveSearch) => ({ ...prev, ...next }), replace: true });

  const setQuery = (value: string) => patch({ q: value });
  const setPersona = (value: string) => patch({ persona: value });
  const setReaction = (value: string) => patch({ reaction: value });
  const setDateRange = (value: string) => patch({ date: value });
  const setSort = (value: string) => patch({ sort: value });

  const {
    data: threads,
    isPending,
    isOffline,
    cachedAt,
  } = useCachedQuery(["threads", "mine"], () => fetchThreads({ data: { scope: "mine" } }));

  const remove = useMutation({
    mutationFn: (threadId: string) => removeThread({ data: { threadId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["threads"] }),
    onError: (error: Error) => toast.error(friendlyError(error, { action: "delete this test" })),
  });

  const list = threads ?? [];
  const scored = list.filter((t) => typeof t.confidence === "number");
  const average = scored.length
    ? Math.round(scored.reduce((sum, t) => sum + (t.confidence ?? 0), 0) / scored.length)
    : null;
  const strong = scored.filter((t) => (t.confidence ?? 0) >= 75).length;
  const weak = scored.filter((t) => (t.confidence ?? 0) < 60).length;
  const shared = list.filter((t) => t.visibility === "workspace").length;
  const privateCount = list.length - shared;

  const activityByPeriod = useMemo(() => {
    const now = Date.now();
    const in7 = list.filter((t) => now - new Date(t.updatedAt).getTime() <= 7 * 864e5).length;
    const in30 = list.filter((t) => now - new Date(t.updatedAt).getTime() <= 30 * 864e5).length;
    const in90 = list.filter((t) => now - new Date(t.updatedAt).getTime() <= 90 * 864e5).length;
    return { in7, in30, in90 };
  }, [list]);

  const recentlyViewed = useMemo(
    () =>
      [...list]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [list],
  );

  const personaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of list) {
      for (const p of t.personas ?? []) set.add(p);
      for (const s of t.segments ?? []) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [list]);

  const filtersActive =
    query.trim() !== "" || persona !== "all" || reaction !== "all" || dateRange !== "all";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const windows: Record<string, number> = {
      "7d": 7 * 864e5,
      "30d": 30 * 864e5,
      "90d": 90 * 864e5,
    };
    const rows = list.filter((t) => {
      if (q) {
        const haystack = [t.title, ...(t.personas ?? []), ...(t.segments ?? [])]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (persona !== "all") {
        const tags = [...(t.personas ?? []), ...(t.segments ?? [])];
        if (!tags.includes(persona)) return false;
      }
      if (reaction !== "all" && (t.reaction ?? "") !== reaction) return false;
      const span = windows[dateRange];
      if (span && now - new Date(t.updatedAt).getTime() > span) return false;
      return true;
    });
    return rows.sort((a, b) => {
      if (sort === "oldest")
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      if (sort === "confidence") return (b.confidence ?? -1) - (a.confidence ?? -1);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [list, query, persona, reaction, dateRange, sort]);

  function clearFilters() {
    patch({ q: "", persona: "all", reaction: "all", date: "all" });
  }

  function exportCsv() {
    if (filtered.length === 0) {
      toast.error("There's nothing to export yet. Run a test first.");
      return;
    }
    const header = ["Title", "Confidence", "Reaction", "Visibility", "Updated"];
    const rows = filtered.map((t) => [
      t.title,
      t.confidence === null ? "" : String(t.confidence),
      t.reaction ?? "",
      t.visibility,
      new Date(t.updatedAt).toISOString(),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "archive-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const stats = [
    { icon: MessageSquareText, label: "Total tests", value: String(list.length) },
    { icon: Gauge, label: "Avg confidence", value: average === null ? "-" : `${average}%` },
    { icon: TrendingUp, label: "High confidence", value: String(strong) },
    { icon: ShieldAlert, label: "Needs work", value: String(weak) },
  ];

  const leftRail = (
    <>
      <RailCard title="Search" icon={Search}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by message or persona…"
            aria-label="Search your tests"
            className="h-10 rounded-xl pl-9"
          />
        </div>
      </RailCard>

      <RailCard
        title="Filters"
        action={
          filtersActive ? (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={clearFilters}>
              <X className="mr-1 size-3" /> Clear
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-2">
          <Select value={persona} onValueChange={setPersona}>
            <SelectTrigger className="h-10 w-full rounded-xl" aria-label="Filter by persona">
              <SelectValue placeholder="Persona" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All personas</SelectItem>
              {personaOptions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={reaction} onValueChange={setReaction}>
            <SelectTrigger
              className="h-10 w-full rounded-xl"
              aria-label="Filter by predicted reaction"
            >
              <SelectValue placeholder="Reaction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any reaction</SelectItem>
              <SelectItem value="positive">Mostly positive</SelectItem>
              <SelectItem value="neutral">Mostly neutral</SelectItem>
              <SelectItem value="negative">Mostly negative</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="h-10 w-full rounded-xl" aria-label="Filter by date">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any date</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-10 w-full rounded-xl" aria-label="Sort results">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="confidence">Highest confidence</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </RailCard>

      <RailCard title="Thread counts" icon={Users}>
        <RailStatList>
          <RailStat label="Total tests" value={list.length} />
          <RailStat label="Shared with FKF" value={shared} />
          <RailStat label="Private" value={privateCount} />
          <RailStat label="Matching filters" value={filtered.length} />
        </RailStatList>
      </RailCard>

      <RailCard title="Activity by period" icon={History}>
        <div className="grid gap-1">
          <RailBar label="Last 7 days" value={activityByPeriod.in7} total={list.length || 1} />
          <RailBar label="Last 30 days" value={activityByPeriod.in30} total={list.length || 1} />
          <RailBar label="Last 90 days" value={activityByPeriod.in90} total={list.length || 1} />
        </div>
      </RailCard>
    </>
  );

  const rightRail = (
    <>
      <RailCard title="Actions" icon={PlusCircle}>
        <div className="grid gap-2">
          <RailAction
            to="/new"
            icon={PlusCircle}
            title="New test"
            description="Run a fresh message test"
          />
          <RailAction
            onClick={exportCsv}
            icon={Download}
            title="Export CSV"
            description={`Export ${filtered.length} filtered run${filtered.length === 1 ? "" : "s"}`}
          />
        </div>
      </RailCard>

      <RailCard title="Explore" icon={BarChart3}>
        <div className="grid gap-2">
          <RailAction
            to="/reports"
            icon={BarChart3}
            title="Reports"
            description="Saved and shared reports"
          />
          <RailAction
            to="/performance"
            icon={TrendingUp}
            title="Performance"
            description="Team performance view"
          />
        </div>
      </RailCard>

      <RailCard title="Recently viewed" icon={History}>
        {recentlyViewed.length === 0 ? (
          <p className="type-meta text-muted-foreground">Nothing tested yet.</p>
        ) : (
          <div className="grid gap-2">
            {recentlyViewed.map((thread) => (
              <RailAction
                key={thread.id}
                to={`/chat/${thread.id}`}
                icon={MessageSquareText}
                title={thread.title}
                description={new Date(thread.updatedAt).toLocaleDateString("en-KE")}
              />
            ))}
          </div>
        )}
      </RailCard>
    </>
  );

  return (
    <WorkspaceShell title="Archive" wide>
      <PageTitle
        description="Your own tests, private unless shared with the workspace."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link to="/new">New test</Link>
            </Button>
          </div>
        }
      >
        Archive
      </PageTitle>

      {isOffline && (
        <div className="mb-4">
          <OfflineNotice cachedAt={cachedAt} label="tests" />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} />
        ))}
      </div>

      <div className="mt-6">
        <CommandGrid left={leftRail} right={rightRail}>
          {!isPending && list.length > 0 && (
            <p className="type-meta text-muted-foreground">
              Showing {filtered.length} of {list.length} runs
            </p>
          )}

          {isPending && (
            <div className="flex items-center gap-2 py-16 type-body text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Getting your archive ready…
            </div>
          )}

          {!isPending && list.length === 0 && (
            <EmptyState
              title="Nothing here yet."
              description="Run your first test to start building your archive."
              action={
                <Button asChild>
                  <Link to="/new">New test</Link>
                </Button>
              }
            />
          )}

          {!isPending && list.length > 0 && filtered.length === 0 && (
            <EmptyState
              title="No results for this search."
              description="Try a different keyword or adjust your filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {filtered.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="hidden grid-cols-[minmax(0,1fr)_130px_190px_auto] gap-3 border-b border-border bg-muted/50 px-4 py-2 type-meta font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                <span>Message</span>
                <span>Confidence</span>
                <span>Last updated</span>
                <span className="sr-only">Actions</span>
              </div>
              <ul className="divide-y divide-border">
                {filtered.map((thread) => (
                  <li
                    key={thread.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_130px_190px_auto]"
                  >
                    <Link
                      to="/chat/$threadId"
                      params={{ threadId: thread.id }}
                      className="min-w-0 row-start-1"
                    >
                      <span className="block truncate type-card">{thread.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 type-meta text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {thread.visibility === "workspace" ? (
                            <>
                              <Users className="size-3" /> Shared with FKF
                            </>
                          ) : (
                            <>
                              <Lock className="size-3" /> Private
                            </>
                          )}
                        </span>
                        {thread.reaction && (
                          <span className="rounded-full bg-secondary px-2 py-1 capitalize">
                            {thread.reaction} lean
                          </span>
                        )}
                        {(thread.personas ?? []).slice(0, 2).map((p) => (
                          <span key={p} className="truncate rounded-full bg-secondary px-2 py-1">
                            {p}
                          </span>
                        ))}
                      </span>
                    </Link>
                    <span
                      className={`w-fit rounded-full px-2 py-1 type-meta font-semibold ${confidenceClass(thread.confidence)}`}
                    >
                      {thread.confidence === null ? "-" : `${thread.confidence}%`}
                    </span>
                    <span className="hidden type-meta text-muted-foreground sm:block">
                      {new Date(thread.updatedAt).toLocaleString("en-KE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    <div className="row-start-1 flex shrink-0 items-center gap-1 justify-self-end sm:row-auto">
                      <Button asChild variant="outline" size="sm" className="rounded-xl">
                        <Link to="/chat/$threadId" params={{ threadId: thread.id }}>
                          Open
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${thread.title}`}
                        className="text-muted-foreground"
                        onClick={() => remove.mutate(thread.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CommandGrid>
      </div>
    </WorkspaceShell>
  );
}
