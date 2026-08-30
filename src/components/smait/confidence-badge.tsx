import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export function ConfidenceBadge({
  score,
  recommendation,
}: {
  score: number;
  recommendation: "approve" | "refine" | "rethink";
}) {
  const meta = {
    approve: {
      label: "Approve & Proceed",
      body: "Message is ready to roll out.",
      tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
    refine: {
      label: "Refine & Improve",
      body: "Minor adjustments recommended.",
      tone: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      icon: <AlertTriangle className="h-5 w-5" />,
    },
    rethink: {
      label: "Rethink & Reframe",
      body: "Major changes recommended.",
      tone: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
      icon: <XCircle className="h-5 w-5" />,
    },
  }[recommendation];

  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border p-4", meta.tone)}>
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-current">
        <span className="text-xl font-bold tabular-nums">{score}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {meta.icon}
          {meta.label}
        </div>
        <p className="mt-0.5 text-xs opacity-80">{meta.body}</p>
      </div>
      <div className="hidden text-right text-[11px] opacity-70 md:block">
        <div className="font-medium uppercase tracking-wider">Message Confidence</div>
        <div>Out of 100</div>
      </div>
    </div>
  );
}
