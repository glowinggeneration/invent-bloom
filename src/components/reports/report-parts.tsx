import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getReport, getReportCsv } from "@/lib/reports.functions";
import { friendlyError } from "@/lib/friendly-errors";
import { STATUS_LABEL, type ReportStatus } from "@/lib/reports";

export function StatusPill({ status }: { status: ReportStatus }) {
  const tone =
    status === "ready"
      ? "bg-positive/10 text-positive"
      : status === "partial"
        ? "bg-neutral/10 text-neutral"
        : status === "failed"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`type-meta rounded-full px-2 py-0.5 ${tone}`}>{STATUS_LABEL[status]}</span>
  );
}

const SHEETS = [
  { value: "mentions", label: "Mentions CSV" },
  { value: "campaigns", label: "Campaign CSV" },
  { value: "personas", label: "Persona activity CSV" },
] as const;

/** Downloads are built server-side from the stored rows for the period. */
export function ReportCsvMenu({ reportId }: { reportId: string }) {
  const fetchCsv = useServerFn(getReportCsv);
  const [busy, setBusy] = useState<string | null>(null);

  async function download(sheet: (typeof SHEETS)[number]["value"]) {
    setBusy(sheet);
    try {
      const { filename, csv } = await fetchCsv({ data: { id: reportId, sheet } });
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(friendlyError(err, { action: "download this file" }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy !== null}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download CSV
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SHEETS.map((s) => (
          <DropdownMenuItem key={s.value} onSelect={() => void download(s.value)}>
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Builds the branded SMAIT PDF for a stored report, straight from the list. */
export function ReportPdfButton({ reportId, className }: { reportId: string; className?: string }) {
  const load = useServerFn(getReport);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const { report } = await load({ data: { id: reportId } });
      if (!report) throw new Error("not found");
      const { downloadReportPdf } = await import("@/lib/daily-report-pdf");
      await downloadReportPdf(report);
    } catch (err) {
      toast.error(friendlyError(err, { action: "create this PDF" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={busy}
      onClick={() => void create()}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
      Download PDF
    </Button>
  );
}
