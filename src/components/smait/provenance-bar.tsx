import { Plug, Unplug, RefreshCw, Search } from "lucide-react";
import { platformLabel, type SourceStatus } from "@/lib/platform-labels";

function formatStamp(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Data provenance strip: shows which upstream provider powered each source,
 * the last-updated timestamp and a manual refresh control.
 */
export function ProvenanceBar({
  sources,
  fetchedAt,
  running,
  onRefresh,
  idleHint,
}: {
  sources?: SourceStatus[];
  fetchedAt?: string | null;
  running: boolean;
  onRefresh: () => void;
  idleHint: string;
}) {
  const stamp = formatStamp(fetchedAt);
  return (
    <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        {sources && sources.length > 0 ? (
          sources.map((s) => {
            const healthy = s.configured && !s.error && s.count > 0;
            return (
              <span
                key={s.platform}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"
              >
                {healthy ? (
                  <Plug className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Unplug className="h-3.5 w-3.5 text-warning" />
                )}
                <span className="font-medium text-foreground">{platformLabel(s.platform)}</span>
                <span className="tabular-nums">
                  {s.error ?? (s.configured ? `${s.count} results` : "not connected")}
                </span>
              </span>
            );
          })
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" /> {idleHint}
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="tabular-nums">
            {stamp ? `Last updated ${stamp}` : "Not yet updated"}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
            {running ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}
