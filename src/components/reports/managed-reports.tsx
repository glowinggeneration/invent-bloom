/**
 * The Managed Reports library — SMAIT's hand-prepared deliverables.
 *
 * Clients read and download here; the admin can also tidy titles, change the
 * category or retire a report. New reports arrive through Lovable Chat, so
 * there is deliberately no upload form to maintain.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download, ExternalLink, FileText, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/ui-kit";
import { friendlyError } from "@/lib/friendly-errors";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  categoryLabel,
  fileTypeLabel,
  formatFileSize,
  formatReportingPeriod,
  formatUploadedAt,
  MANAGED_REPORT_CATEGORIES,
  type ManagedReport,
} from "@/lib/managed-reports";
import {
  deleteManagedReport,
  getManagedReportLink,
  listManagedReports,
  updateManagedReport,
} from "@/lib/managed-reports.functions";

function useOpenFile() {
  const link = useServerFn(getManagedReportLink);
  const [busy, setBusy] = useState<string | null>(null);

  const open = async (id: string, download: boolean) => {
    setBusy(`${id}:${download}`);
    try {
      const { url } = await link({ data: { id, download } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(friendlyError(err, { action: "open this report" }));
    } finally {
      setBusy(null);
    }
  };

  return { open, busy };
}

function ReportRow({ report, isAdmin }: { report: ManagedReport; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { open, busy } = useOpenFile();
  const update = useServerFn(updateManagedReport);
  const remove = useServerFn(deleteManagedReport);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["managed-reports"] });

  const archive = useMutation({
    mutationFn: () => update({ data: { id: report.id, status: "archived" } }),
    onSuccess: () => {
      toast.success("Report archived.");
      void refresh();
    },
    onError: (e: Error) => toast.error(friendlyError(e, { action: "archive this report" })),
  });

  const destroy = useMutation({
    mutationFn: () => remove({ data: { id: report.id } }),
    onSuccess: () => {
      toast.success("Report deleted.");
      void refresh();
    },
    onError: (e: Error) => toast.error(friendlyError(e, { action: "delete this report" })),
  });

  return (
    <div className="card-surface flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        {report.coverImage ? (
          <img
            src={report.coverImage}
            alt=""
            loading="lazy"
            className="hidden size-14 shrink-0 rounded-lg object-cover sm:block"
          />
        ) : (
          <div className="hidden size-14 shrink-0 items-center justify-center rounded-lg bg-muted sm:flex">
            <FileText className="size-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="type-card font-semibold">{report.title}</p>
            <span className="type-meta rounded-full border border-border px-2 py-0.5 text-muted-foreground">
              {fileTypeLabel(report.fileType, report.fileName)}
            </span>
            {report.status === "draft" ? (
              <span className="type-meta rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                Draft
              </span>
            ) : null}
          </div>
          <p className="type-meta mt-0.5 text-muted-foreground">
            {formatReportingPeriod(report.reportingPeriodStart, report.reportingPeriodEnd)}
          </p>
          {report.description ? <p className="mt-2 text-sm">{report.description}</p> : null}
          <div className="type-meta mt-2 flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
            <span>{categoryLabel(report.category)}</span>
            <span>
              Uploaded by {report.uploadedBy} · {formatUploadedAt(report.uploadedAt)}
            </span>
            <span>{formatFileSize(report.fileSize)}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => open(report.id, false)}
          disabled={busy !== null}
        >
          {busy === `${report.id}:false` ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ExternalLink className="size-4" />
          )}
          View report
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => open(report.id, true)}
          disabled={busy !== null}
        >
          {busy === `${report.id}:true` ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Download
        </Button>
        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Report options">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {report.status === "draft" ? (
                <DropdownMenuItem
                  onSelect={() =>
                    update({ data: { id: report.id, status: "published" } }).then(refresh)
                  }
                >
                  Publish
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => archive.mutate()}>Archive</DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive" onSelect={() => destroy.mutate()}>
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

export function ManagedReportsLibrary({ isAdmin }: { isAdmin: boolean }) {
  const [category, setCategory] = useState("all");
  const load = useServerFn(listManagedReports);

  const { data, isLoading } = useQuery({
    queryKey: ["managed-reports", category],
    queryFn: () => load({ data: { category } }),
  });

  const reports = data?.reports ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[{ value: "all", label: "All" }, ...MANAGED_REPORT_CATEGORIES].map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={`type-meta rounded-full border px-3 py-1.5 transition-colors ${
              category === c.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          title="Nothing here yet."
          description={
            isAdmin
              ? "Attach a report in Lovable Chat and say “Add this to Managed Reports” — it will be published here."
              : "The team publishes prepared reports here. Nothing has been shared yet."
          }
        />
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
