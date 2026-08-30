import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Gauge,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pause,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  Search,
  Send,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace-shell";
import { EmptyState, PageTabs, PageTitle, PageToolbar, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  generateCampaignNames,
  listManagedCampaigns,
  pauseManagedCampaign,
  renameManagedCampaign,
  resumeManagedCampaign,
} from "@/lib/campaign-manager.functions";
import {
  ACTION_KIND_LABELS,
  STATUS_LABELS,
  type CampaignActionKind,
  type CampaignStatus,
  type ManagedCampaign,
} from "@/lib/campaign-manager";
import { formatCount } from "@/lib/performance";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/campaign-manager")({
  head: () => ({
    meta: [
      { title: "Campaign Manager - FKF CommsIQ" },
      {
        name: "description",
        content:
          "Track campaign status, progress and execution in a familiar management workspace, then open proof or measured performance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Campaign Manager - FKF CommsIQ" },
      {
        property: "og:description",
        content: "Live status, progress and controls for every campaign on the platform.",
      },
    ],
  }),
  component: CampaignManagerPage,
});

type CampaignFilter = "all" | CampaignStatus;

const FILTERS: { value: CampaignFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

const STATUS_CLASS: Record<CampaignStatus, string> = {
  running: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  paused: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  scheduled: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  completed: "bg-primary/10 text-primary",
};

const STATUS_DOT: Record<CampaignStatus, string> = {
  running: "bg-emerald-500",
  paused: "bg-amber-500",
  scheduled: "bg-sky-500",
  completed: "bg-primary",
};

const KIND_ICON: Record<CampaignActionKind, typeof Heart> = {
  tweet: Send,
  comment: MessageCircle,
  like: Heart,
  retweet: Repeat2,
  bookmark: Bookmark,
  follow: UserPlus,
};

function stamp(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusPill({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASS[status]}`}
    >
      <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function Progress({ campaign, compact = false }: { campaign: ManagedCampaign; compact?: boolean }) {
  if (!campaign.hasExecution) {
    return <span className="type-meta text-muted-foreground">Awaiting execution data</span>;
  }
  return (
    <div className={compact ? "min-w-0" : "min-w-[9rem]"}>
      <div className="flex items-center justify-between gap-3">
        <p className="type-body font-semibold tabular-nums">{campaign.progress}%</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {formatCount(campaign.completed + campaign.failed)} / {formatCount(campaign.planned)}
        </p>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${campaign.status === "paused" ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${campaign.progress}%` }}
        />
      </div>
    </div>
  );
}

function ActionSummary({ campaign }: { campaign: ManagedCampaign }) {
  if (!campaign.breakdown.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
      {campaign.breakdown.slice(0, 4).map((item) => {
        const Icon = KIND_ICON[item.kind];
        return (
          <span
            key={item.kind}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
          >
            <Icon className="size-3" aria-hidden="true" />
            {ACTION_KIND_LABELS[item.kind]} {formatCount(item.completed)}/
            {formatCount(item.planned)}
          </span>
        );
      })}
    </div>
  );
}

function CampaignMenu({
  campaign,
  onPause,
  onResume,
  onRename,
}: {
  campaign: ManagedCampaign;
  onPause: () => void;
  onResume: () => void;
  onRename: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label={`More actions for ${campaign.name}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link to="/campaign-proof" search={{ campaign: campaign.key }}>
            <FileCheck2 className="size-4" /> Campaign Proof
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/performance" search={{ campaign: campaign.key }}>
            <BarChart3 className="size-4" /> Performance
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onRename}>
          <Pencil className="size-4" /> Rename
        </DropdownMenuItem>
        {campaign.status !== "completed" && campaign.status !== "paused" ? (
          <DropdownMenuItem onSelect={onPause}>
            <Pause className="size-4" /> Pause
          </DropdownMenuItem>
        ) : null}
        {campaign.status === "paused" ? (
          <DropdownMenuItem onSelect={onResume}>
            <Play className="size-4" /> Resume
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CampaignManagerPage() {
  const queryClient = useQueryClient();
  const fetchCampaigns = useServerFn(listManagedCampaigns);
  const nameCampaigns = useServerFn(generateCampaignNames);
  const pause = useServerFn(pauseManagedCampaign);
  const resume = useServerFn(resumeManagedCampaign);
  const rename = useServerFn(renameManagedCampaign);

  const [filter, setFilter] = useState<CampaignFilter>("all");
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<ManagedCampaign | null>(null);
  const [draftName, setDraftName] = useState("");
  const namedOnce = useRef(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["managed-campaigns"],
    queryFn: () => fetchCampaigns(),
    refetchInterval: 60_000,
  });

  const campaigns = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    if (namedOnce.current || campaigns.length === 0) return;
    const generic = campaigns.some(
      (campaign) => !campaign.name || /^campaign$/i.test(campaign.name.trim()) || !campaign.summary,
    );
    if (!generic) return;
    namedOnce.current = true;
    let cancelled = false;
    void (async () => {
      for (let round = 0; round < 12 && !cancelled; round += 1) {
        try {
          const result = await nameCampaigns();
          if (!result.named) break;
          if (!cancelled) queryClient.invalidateQueries({ queryKey: ["managed-campaigns"] });
        } catch {
          break;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaigns, nameCampaigns, queryClient]);

  const counts = useMemo(() => {
    const base: Record<CampaignFilter, number> = {
      all: campaigns.length,
      running: 0,
      scheduled: 0,
      paused: 0,
      completed: 0,
    };
    for (const campaign of campaigns) base[campaign.status] += 1;
    return base;
  }, [campaigns]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (filter !== "all" && campaign.status !== filter) return false;
      if (!q) return true;
      const haystack = [
        campaign.name,
        campaign.summary,
        campaign.type,
        ...campaign.breakdown.map((item) => ACTION_KIND_LABELS[item.kind]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [campaigns, filter, query]);

  const control = useMutation({
    mutationFn: async (input: { action: "pause" | "resume"; campaign: ManagedCampaign }) => {
      const payload = { source: input.campaign.source, id: input.campaign.id };
      return input.action === "pause" ? pause({ data: payload }) : resume({ data: payload });
    },
    onSuccess: (_result, input) => {
      toast.success(input.action === "pause" ? "Campaign paused." : "Campaign resumed.");
      queryClient.invalidateQueries({ queryKey: ["managed-campaigns"] });
    },
    onError: (error, input) =>
      toast.error(
        friendlyError(error, {
          action: input.action === "pause" ? "pause this campaign" : "resume this campaign",
        }),
      ),
  });

  const renameMutation = useMutation({
    mutationFn: async (input: { campaign: ManagedCampaign; name: string }) =>
      rename({ data: { source: input.campaign.source, id: input.campaign.id, name: input.name } }),
    onSuccess: () => {
      toast.success("Campaign renamed.");
      setRenaming(null);
      queryClient.invalidateQueries({ queryKey: ["managed-campaigns"] });
    },
    onError: (error) => toast.error(friendlyError(error, { action: "rename this campaign" })),
  });

  const busyKey = control.isPending ? control.variables?.campaign.key : null;
  const tabs = FILTERS.map((item) => ({ ...item, count: counts[item.value] }));

  return (
    <WorkspaceShell title="Campaigns" wide>
      <PageTitle description="Create, monitor and review campaigns from one place.">
        Campaigns
      </PageTitle>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Gauge}
          label="Running"
          value={counts.running}
          hint="Campaigns executing now"
        />
        <StatCard
          icon={CalendarClock}
          label="Scheduled"
          value={counts.scheduled}
          hint="Waiting for their next action"
        />
        <StatCard
          icon={PauseCircle}
          label="Paused"
          value={counts.paused}
          hint="Held until resumed"
          tone={counts.paused ? "neutral" : "default"}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={counts.completed}
          hint="Ready for proof and performance review"
        />
      </section>

      <PageTabs
        className="mt-5"
        items={tabs}
        value={filter}
        onChange={setFilter}
        ariaLabel="Campaign status"
      />

      <PageToolbar className="mt-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search campaigns…"
            aria-label="Search campaigns"
            className="h-10 w-full bg-background pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Check for updates
          </Button>
          <Button asChild size="sm">
            <Link to="/publish" search={{ choose: true }}>
              <Plus className="size-4" /> Create campaign
            </Link>
          </Button>
        </div>
      </PageToolbar>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 card-surface p-6 type-body text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading campaigns…
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={
              query
                ? "No results for this search."
                : filter === "all"
                  ? "Nothing here yet."
                  : `No ${filter} campaigns.`
            }
            description={
              query
                ? "Try a different keyword."
                : filter === "all"
                  ? "Campaigns you create will appear here with live progress."
                  : "Choose another status or create a new campaign."
            }
            action={
              !query && filter === "all" ? (
                <Button asChild size="sm">
                  <Link to="/publish" search={{ choose: true }}>
                    <Plus className="size-4" /> Create campaign
                  </Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* Phone: purpose-built cards instead of a collapsed desktop table. */}
          <ul className="mt-4 grid gap-3 md:hidden">
            {shown.map((campaign) => (
              <li key={campaign.key} className="card-surface overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/campaign-proof"
                        search={{ campaign: campaign.key }}
                        className="type-card block truncate font-semibold hover:text-primary"
                      >
                        {campaign.name}
                      </Link>
                      <p className="type-meta mt-1 line-clamp-2 text-muted-foreground">
                        {campaign.summary || campaign.type}
                      </p>
                    </div>
                    <StatusPill status={campaign.status} />
                  </div>

                  <ActionSummary campaign={campaign} />

                  <div className="mt-4">
                    <Progress campaign={campaign} compact />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Started</p>
                      <p className="type-meta mt-0.5 font-semibold">{stamp(campaign.startedAt)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        {campaign.status === "completed" ? "Completed" : "Next action"}
                      </p>
                      <p className="type-meta mt-0.5 font-semibold">
                        {campaign.status === "completed"
                          ? stamp(campaign.completedAt)
                          : stamp(campaign.nextRunAt)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
                  <Button asChild size="sm" className="flex-1">
                    <Link to="/campaign-proof" search={{ campaign: campaign.key }}>
                      <FileCheck2 className="size-4" /> View details
                    </Link>
                  </Button>
                  {campaign.status === "running" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyKey === campaign.key}
                      onClick={() => control.mutate({ action: "pause", campaign })}
                    >
                      <Pause className="size-4" /> Pause
                    </Button>
                  ) : null}
                  {campaign.status === "paused" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyKey === campaign.key}
                      onClick={() => control.mutate({ action: "resume", campaign })}
                    >
                      <Play className="size-4" /> Resume
                    </Button>
                  ) : null}
                  <CampaignMenu
                    campaign={campaign}
                    onPause={() => control.mutate({ action: "pause", campaign })}
                    onResume={() => control.mutate({ action: "resume", campaign })}
                    onRename={() => {
                      setRenaming(campaign);
                      setDraftName(campaign.name);
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {/* Tablet/desktop: compact management table with only decision-critical columns. */}
          <div className="mt-4 hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left type-body">
                <thead>
                  <tr className="border-b border-border bg-muted/30 type-meta text-muted-foreground">
                    <th className="px-5 py-3 font-semibold">Campaign</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Progress</th>
                    <th className="px-3 py-3 font-semibold">Schedule</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((campaign) => (
                    <tr
                      key={campaign.key}
                      className="border-b border-border/70 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-5 py-4 align-top">
                        <Link
                          to="/campaign-proof"
                          search={{ campaign: campaign.key }}
                          className="font-semibold hover:text-primary"
                        >
                          {campaign.name}
                        </Link>
                        <p className="type-meta mt-1 max-w-xl line-clamp-1 text-muted-foreground">
                          {campaign.summary || campaign.type}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                          {campaign.type}
                        </p>
                        <ActionSummary campaign={campaign} />
                      </td>
                      <td className="px-3 py-4 align-top">
                        <StatusPill status={campaign.status} />
                      </td>
                      <td className="px-3 py-4 align-top">
                        <Progress campaign={campaign} />
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="type-meta font-semibold">{stamp(campaign.startedAt)}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {campaign.status === "completed"
                            ? `Completed ${stamp(campaign.completedAt)}`
                            : campaign.nextRunAt
                              ? `Next ${stamp(campaign.nextRunAt)}`
                              : "No future action scheduled"}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center justify-end gap-2">
                          {campaign.status === "running" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busyKey === campaign.key}
                              onClick={() => control.mutate({ action: "pause", campaign })}
                            >
                              <Pause className="size-4" /> Pause
                            </Button>
                          ) : null}
                          {campaign.status === "paused" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busyKey === campaign.key}
                              onClick={() => control.mutate({ action: "resume", campaign })}
                            >
                              <Play className="size-4" /> Resume
                            </Button>
                          ) : null}
                          <Button
                            asChild
                            size="sm"
                            variant={campaign.status === "completed" ? "default" : "outline"}
                          >
                            <Link to="/campaign-proof" search={{ campaign: campaign.key }}>
                              <FileCheck2 className="size-4" /> View
                            </Link>
                          </Button>
                          <CampaignMenu
                            campaign={campaign}
                            onPause={() => control.mutate({ action: "pause", campaign })}
                            onResume={() => control.mutate({ action: "resume", campaign })}
                            onRename={() => {
                              setRenaming(campaign);
                              setDraftName(campaign.name);
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border px-5 py-2.5 type-meta text-muted-foreground">
              Showing {shown.length.toLocaleString()} of {campaigns.length.toLocaleString()}{" "}
              campaigns
            </div>
          </div>
        </>
      )}

      <Dialog open={Boolean(renaming)} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename campaign</DialogTitle>
          </DialogHeader>
          <Input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Campaign name"
            aria-label="Campaign name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              disabled={renameMutation.isPending || !draftName.trim()}
              onClick={() =>
                renaming && renameMutation.mutate({ campaign: renaming, name: draftName })
              }
            >
              {renameMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
