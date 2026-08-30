import { CloudOff } from "lucide-react";
import { formatCachedAt } from "@/lib/offline-cache";

/** Shown when a screen is rendering data from the offline cache. */
export function OfflineNotice({ cachedAt, label }: { cachedAt: number | null; label: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground"
    >
      <CloudOff className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>
        You're offline - showing saved {label}
        {cachedAt ? ` from ${formatCachedAt(cachedAt)}` : ""}.
      </span>
    </div>
  );
}
