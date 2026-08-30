/**
 * Campaign skip audit: a quiet, collapsed log of accounts left out of runs.
 */
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { listSkipAudit, type SkipAuditEntry } from "@/lib/skip-audit.functions";

const REASON_LABEL: Record<string, string> = {
  suspended: "Suspended on X",
  inactive: "Switched off",
  no_session: "No saved session",
};

function when(iso: string) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleString();
}

export function SkipAuditPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["skip-audit"],
    queryFn: () => listSkipAudit(),
    staleTime: 60_000,
  });
  const entries = (data ?? []) as SkipAuditEntry[];

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Skipped accounts log</SectionTitle>
        <span className="type-meta text-muted-foreground">
          {isLoading ? "Loading…" : `${entries.length} recent`}
        </span>
      </div>
      <p className="mt-1 type-meta text-muted-foreground">
        Accounts left out of campaign runs, and why.
      </p>

      {!isLoading && entries.length === 0 && (
        <p className="mt-4 type-meta text-muted-foreground">
          Nothing skipped yet. Entries appear after your next campaign run.
        </p>
      )}

      {entries.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer type-meta text-muted-foreground">View log</summary>
          <ul className="mt-3 divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start gap-2 py-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="type-card break-words">
                    {e.personaName || "Account"}{" "}
                    <span className="text-muted-foreground">{e.handle ? `@${e.handle}` : ""}</span>
                  </p>
                  <p className="type-meta break-words text-muted-foreground">
                    {REASON_LABEL[e.reason] ?? e.reason} · {e.source} campaign · {when(e.createdAt)}
                  </p>
                  {e.detail && (
                    <p className="type-meta break-words text-muted-foreground">{e.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
