import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { History, RefreshCw } from "lucide-react";

import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, EmptyState, PageTitle, PageToolbar } from "@/components/ui-kit";
import { listAccountDirectory } from "@/lib/account-directory.functions";
import {
  CAMPAIGN_HISTORY_ACTION_TYPES,
  CAMPAIGN_HISTORY_STATUSES,
  listCampaignHistory,
  type CampaignHistoryActionType,
  type CampaignHistoryRow,
  type CampaignHistoryStatus,
  type ListCampaignHistoryInput,
} from "@/lib/campaign-history.functions";
import { ACTION_KIND_LABELS } from "@/lib/campaign-manager";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/campaign-history")({
  head: () => ({
    meta: [
      { title: "Campaign History - SMAIT" },
      {
        name: "description",
        content:
          "Flat, filterable activity feed of every scheduled action across all campaigns and accounts, most recent first.",
      },
    ],
  }),
  component: CampaignHistoryPage,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  success: "Posted",
  failed: "Failed",
  paused: "Paused",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent",
  running: "bg-primary/10 text-primary border-transparent",
  pending: "bg-muted text-muted-foreground border-transparent",
  paused: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-transparent",
  failed: "bg-destructive/10 text-destructive border-transparent",
  cancelled: "bg-muted text-muted-foreground border-transparent",
};

const ACTION_LABELS: Record<string, string> = {
  tweet: ACTION_KIND_LABELS.tweet,
  comment: ACTION_KIND_LABELS.comment,
  like: ACTION_KIND_LABELS.like,
  retweet: ACTION_KIND_LABELS.retweet,
  bookmark: ACTION_KIND_LABELS.bookmark,
  follow: ACTION_KIND_LABELS.follow,
};

const ALL = "all";

function stamp(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

function targetPreview(row: CampaignHistoryRow) {
  if (row.content.trim()) {
    return row.content.trim().length > 140
      ? `${row.content.trim().slice(0, 139)}…`
      : row.content.trim();
  }
  if (row.targetHandle) return `@${row.targetHandle}`;
  if (row.targetTweetId) return `Tweet ${row.targetTweetId}`;
  if (row.resultTweetId) return `Posted ${row.resultTweetId}`;
  return "—";
}

function CampaignHistoryPage() {
  const fetchHistory = useServerFn(listCampaignHistory);
  const fetchAccounts = useServerFn(listAccountDirectory);

  const [status, setStatus] = useState<string>(ALL);
  const [actionType, setActionType] = useState<string>(ALL);
  const [accountId, setAccountId] = useState<string>(ALL);

  const accounts = useQuery({
    queryKey: ["campaign-history", "accounts"],
    queryFn: () => fetchAccounts(),
  });

  const history = useQuery({
    queryKey: ["campaign-history", "list", status, actionType, accountId],
    queryFn: () =>
      fetchHistory({
        data: {
          ...(status !== ALL ? { status: status as CampaignHistoryStatus } : {}),
          ...(actionType !== ALL ? { actionType: actionType as CampaignHistoryActionType } : {}),
          ...(accountId !== ALL ? { accountId } : {}),
          limit: 100,
        } satisfies ListCampaignHistoryInput,
      }),
  });

  const rows = useMemo(() => history.data ?? [], [history.data]);

  return (
    <WorkspaceShell title="Campaign History" wide>
      <PageTitle
        description="Every scheduled action across all campaigns and accounts, most recent first — see which posts actually posted."
        actions={
          <Button
            variant="outline"
            onClick={() => void history.refetch()}
            disabled={history.isFetching}
          >
            <RefreshCw className={history.isFetching ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        }
      >
        Campaign History
      </PageTitle>

      <PageToolbar className="mt-5">
        <div className="min-w-[160px] flex-1">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {CAMPAIGN_HISTORY_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_LABELS[value] ?? value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px] flex-1">
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger aria-label="Filter by action type">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All actions</SelectItem>
              {CAMPAIGN_HISTORY_ACTION_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {ACTION_LABELS[value] ?? value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[200px] flex-1">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger aria-label="Filter by account">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All accounts</SelectItem>
              {(accounts.data ?? []).map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  @{account.handle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageToolbar>

      {history.isLoading ? (
        <div className="mt-4 grid gap-3" aria-label="Loading campaign history">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : history.isError ? (
        <div className="mt-4">
          <EmptyState
            title="Campaign history could not be loaded"
            description={friendlyError(history.error, { action: "load campaign history" })}
            action={
              <Button variant="outline" size="sm" onClick={() => void history.refetch()}>
                <RefreshCw className="size-4" /> Try again
              </Button>
            }
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No activity yet"
            description="Scheduled actions will show up here once a campaign starts running."
          />
        </div>
      ) : (
        <Card className="mt-4 overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Content / target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const statusKey = row.status.toLowerCase();
                return (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-0">
                      <span className="block truncate font-semibold">
                        @{row.handle || "unknown"}
                      </span>
                      {row.personaName ? (
                        <span className="block truncate type-meta text-muted-foreground">
                          {row.personaName}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ACTION_LABELS[row.actionType] ?? row.actionType}
                    </TableCell>
                    <TableCell className="whitespace-nowrap type-meta text-muted-foreground">
                      {stamp(row.runAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_STYLE[statusKey] ?? "bg-muted text-muted-foreground"}
                      >
                        {STATUS_LABELS[statusKey] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs min-w-0">
                      <span className="block truncate type-meta text-muted-foreground">
                        {targetPreview(row)}
                      </span>
                      {row.error ? (
                        <span className="mt-1 block truncate type-meta text-destructive">
                          {row.error}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </WorkspaceShell>
  );
}
