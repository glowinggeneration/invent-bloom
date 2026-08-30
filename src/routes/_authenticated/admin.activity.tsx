import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Download, Loader2, RefreshCw } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, LockScreen, PageTitle, SectionTitle } from "@/components/ui-kit";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import {
  getOperationsActivity,
  type OperationsActivityItem,
} from "@/lib/operations-activity.functions";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  head: () => ({
    meta: [
      { title: "Operational Activity - CommsIQ" },
      {
        name: "description",
        content:
          "Read-only activity feed assembled from existing campaign, publishing and message-test records.",
      },
    ],
  }),
  component: OperationsActivityPage,
});

type Filter = "all" | OperationsActivityItem["category"];

const LABELS: Record<Filter, string> = {
  all: "All",
  publish: "Publishing",
  campaign: "Campaigns",
  "always-on": "Always-on",
  test: "Response Studio",
};

const STATUS_STYLE: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  published: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  recorded: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
  error: "bg-destructive/10 text-destructive",
  held: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  pending: "bg-muted text-muted-foreground",
};

function stamp(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function OperationsActivityPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const load = useServerFn(getOperationsActivity);
  const [filter, setFilter] = useState<Filter>("all");

  const activity = useQuery({
    queryKey: ["operations-activity"],
    queryFn: () => load(),
    enabled: !profileLoading && isAdminEmail(profile?.email),
    refetchInterval: 60_000,
  });

  const visible = useMemo(() => {
    const rows = activity.data ?? [];
    return filter === "all" ? rows : rows.filter((item) => item.category === filter);
  }, [activity.data, filter]);

  if (!profileLoading && !isAdminEmail(profile?.email)) {
    return (
      <WorkspaceShell title="Operational Activity" wide>
        <LockScreen title="Operational activity is restricted" />
      </WorkspaceShell>
    );
  }

  function downloadCsv() {
    const rows = [
      ["Time", "Category", "Title", "Status", "Detail", "Link"],
      ...visible.map((item) => [
        item.at,
        item.category,
        item.title,
        item.status,
        item.detail,
        item.href ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fkf-commsiq-operational-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <WorkspaceShell title="Operational Activity" wide>
      <PageTitle
        description="Read-only timeline assembled from records the platform already stores. It helps reconstruct operational activity but is not an immutable forensic audit log."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => activity.refetch()}
              disabled={activity.isFetching}
            >
              <RefreshCw className={activity.isFetching ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>
            <Button variant="outline" onClick={downloadCsv} disabled={!visible.length}>
              <Download className="size-4" /> Export CSV
            </Button>
          </>
        }
      >
        Operational Activity
      </PageTitle>

      <Card className="mt-6 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(LABELS) as Filter[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {LABELS[key]}
            </Button>
          ))}
        </div>
      </Card>

      {activity.isLoading ? (
        <Card className="mt-4 flex items-center gap-2 p-6 type-body text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading operational history…
        </Card>
      ) : visible.length ? (
        <Card className="mt-4 overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <SectionTitle>{visible.length.toLocaleString()} recent records</SectionTitle>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {visible.map((item) => {
              const status = item.status.toLowerCase();
              return (
                <li
                  key={item.id}
                  className="grid gap-3 px-5 py-4 md:grid-cols-[150px_140px_minmax(0,1fr)_auto] md:items-start"
                >
                  <span className="type-meta text-muted-foreground">{stamp(item.at)}</span>
                  <span className="type-meta font-semibold">{LABELS[item.category]}</span>
                  <span className="min-w-0">
                    <span className="type-body block font-semibold">{item.title}</span>
                    <span className="type-meta mt-1 block text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2 md:justify-end">
                    <span
                      className={`rounded-full px-2 py-1 type-meta font-semibold capitalize ${STATUS_STYLE[status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {item.status}
                    </span>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="type-meta font-semibold text-primary hover:underline"
                      >
                        Open
                      </a>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <Card className="mt-4 p-6">
          <p className="type-body">No matching operational records are available.</p>
        </Card>
      )}
    </WorkspaceShell>
  );
}
