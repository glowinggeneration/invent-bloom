import { Clock3, CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

function ageLabel(at: string): { minutes: number; label: string } | null {
  const time = new Date(at).getTime();
  if (!Number.isFinite(time)) return null;
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return { minutes, label: "just now" };
  if (minutes < 60) return { minutes, label: `${minutes} min ago` };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { minutes, label: `${hours}h ago` };
  return { minutes, label: `${Math.round(hours / 24)}d ago` };
}

export function DataFreshness({
  at,
  staleMinutes = 30,
  label = "Data",
  className,
}: {
  at: string | null | undefined;
  staleMinutes?: number;
  label?: string;
  className?: string;
}) {
  const age = at ? ageLabel(at) : null;
  const stale = age ? age.minutes > staleMinutes : false;
  const Icon = !age ? CircleAlert : stale ? Clock3 : CircleCheck;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
        stale && "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
        !age && "border-destructive/30 bg-destructive/5 text-destructive",
        className,
      )}
      title={
        at
          ? `Last confirmed update: ${new Date(at).toLocaleString()}`
          : `No confirmed ${label.toLowerCase()} update is available yet`
      }
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {!age
        ? `${label} not synced yet`
        : stale
          ? `${label} delayed · last confirmed ${age.label}`
          : `Updated ${age.label}`}
    </span>
  );
}
