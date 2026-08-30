/**
 * Managed Reports — the documents the Persona_Voices team prepares by hand and hands
 * over to the federation.
 *
 * These are deliberately kept apart from the automated daily record: an
 * automated report is a machine snapshot of what happened, a managed report is
 * considered analysis with a person's name behind it. Everything here is
 * browser-safe.
 */

export const MANAGED_REPORT_CATEGORIES = [
  { value: "campaign_performance", label: "Campaign Performance" },
  { value: "social_listening", label: "Social Listening" },
  { value: "media_monitoring", label: "Media Monitoring" },
  { value: "sentiment", label: "Sentiment" },
  { value: "brand_health", label: "Brand Health" },
  { value: "executive", label: "Executive Report" },
  { value: "weekly", label: "Weekly Report" },
  { value: "monthly", label: "Monthly Report" },
  { value: "research", label: "Research" },
  { value: "other", label: "Other" },
] as const;

export type ManagedReportCategory = (typeof MANAGED_REPORT_CATEGORIES)[number]["value"];
export type ManagedReportStatus = "draft" | "published" | "archived";

export function categoryLabel(value: string): string {
  return MANAGED_REPORT_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

export type ManagedReport = {
  id: string;
  title: string;
  description: string;
  category: string;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  client: string;
  campaign: string;
  tags: string[];
  coverImage: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: ManagedReportStatus;
  uploadedBy: string;
  uploadedAt: string;
};

/** Friendly badge for the file, taken from the stored MIME type or extension. */
export function fileTypeLabel(fileType: string, fileName: string): string {
  const value = `${fileType} ${fileName}`.toLowerCase();
  if (value.includes("pdf")) return "PDF";
  if (value.includes("presentation") || /\.pptx?$/.test(value)) return "PowerPoint";
  if (value.includes("sheet") || value.includes("excel") || /\.xlsx?$/.test(value)) return "Excel";
  if (value.includes("csv")) return "CSV";
  if (value.includes("word") || /\.docx?$/.test(value)) return "Word";
  return (fileName.split(".").pop() ?? "File").toUpperCase();
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function day(date: string): string {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatUploadedAt(value: string): string {
  return day(value);
}

/** "10–13 August 2026", collapsing the parts the two dates share. */
export function formatReportingPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "No period set";
  if (!start || !end) return day((start ?? end)!);
  const a = new Date(`${start}T12:00:00Z`);
  const b = new Date(`${end}T12:00:00Z`);
  const sameMonth =
    a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  if (sameMonth) {
    return `${a.getUTCDate()}–${b.getUTCDate()} ${b.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })}`;
  }
  return `${day(start)} – ${day(end)}`;
}
