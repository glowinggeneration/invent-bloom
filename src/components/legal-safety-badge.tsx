import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import type { LegalSafety } from "@/lib/analysis";

const TONE = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  high: "bg-destructive/10 text-destructive",
} as const;

/**
 * Compact verdict from the Legal-Risk Language Transformation Engine:
 * what was flagged, whether wording was rewritten, and who must approve.
 */
export function LegalSafetyBadge({ legal }: { legal: LegalSafety }) {
  const tone = legal.level >= 3 ? "high" : legal.level === 2 ? "medium" : "low";
  const Icon = legal.level >= 4 ? ShieldX : legal.level >= 2 ? ShieldAlert : ShieldCheck;

  return (
    <div className={`mt-3 rounded-xl px-3 py-2 text-[11px] leading-relaxed ${TONE[tone]}`}>
      <p className="flex items-center gap-1.5 font-semibold">
        <Icon className="size-3.5 shrink-0" />
        Legal review · {legal.label}
        {legal.rewritten ? " · wording adjusted" : null}
      </p>
      <p className="mt-1 opacity-90">{legal.note}</p>
      {legal.categories.length ? (
        <p className="mt-1 capitalize opacity-80">Flagged: {legal.categories.join(", ")}</p>
      ) : null}
      {legal.approvalRequired !== "none" ? (
        <p className="mt-1 capitalize opacity-80">Approval: {legal.approvalRequired}</p>
      ) : null}
    </div>
  );
}
