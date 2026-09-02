"use client";

import { AlertTriangle, CheckCircle2, Globe2, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";

type ConnectedAccountsStatusProps = {
  total: number;
  ready: number;
  attention: number;
  suspended: number;
  isRefreshing: boolean;
  lastSyncedAt?: string | null | undefined;
  onRefresh: () => Promise<unknown>;
};

function syncLabel(value?: string | null) {
  if (!value) return "No confirmed sync yet";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "No confirmed sync yet";
  return `Last confirmed ${new Date(time).toLocaleString()}`;
}

/** Real connection-health popover based on the loaded account data. */
export function ConnectedAccountsStatus({
  total,
  ready,
  attention,
  suspended,
  isRefreshing,
  lastSyncedAt,
  onRefresh,
}: ConnectedAccountsStatusProps) {
  const readyPercent = total ? Math.round((ready / total) * 100) : 0;
  const healthy = total > 0 && attention === 0 && suspended === 0;
  const StatusIcon = healthy ? CheckCircle2 : AlertTriangle;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Globe2 className="size-4" aria-hidden="true" /> Connection status
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-0">
        <div className="border-b border-border p-4">
          <div className="flex items-start gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                healthy
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              <StatusIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="type-body font-semibold">
                {healthy ? "All linked accounts are ready" : "Some accounts need attention"}
              </p>
              <p className="mt-0.5 type-meta text-muted-foreground">{syncLabel(lastSyncedAt)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <div className="mb-2 flex items-center justify-between type-meta">
              <span className="text-muted-foreground">Ready for execution</span>
              <span className="font-semibold tabular-nums">
                {ready} of {total}
              </span>
            </div>
            <Progress value={readyPercent} aria-label={`${readyPercent}% of accounts ready`} />
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Ready", ready],
              ["Attention", attention],
              ["Suspended", suspended],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted/60 px-2 py-3">
                <dt className="text-[11px] text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 type-body font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isRefreshing}
            onClick={() => void onRefresh()}
          >
            {isRefreshing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {isRefreshing ? "Checking connections" : "Check connections"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
