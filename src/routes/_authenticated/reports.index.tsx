import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Archive,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  Loader2,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { WorkspaceShell } from "@/components/workspace-shell";
import { EmptyState, PageTabs, PageTitle, SectionTitle } from "@/components/ui-kit";
import {
  CommandGrid,
  RailAction,
  RailBar,
  RailCard,
  RailStat,
  RailStatList,
} from "@/components/command-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createReport, listReports } from "@/lib/reports.functions";
import { friendlyError } from "@/lib/friendly-errors";
import { ManagedReportsLibrary } from "@/components/reports/managed-reports";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import { ReportCsvMenu, ReportPdfButton, StatusPill } from "@/components/reports/report-parts";
import { formatReportDateShort, REPORT_FILTERS, type ReportFilter } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({
    meta: [
      { title: "Reports - FKF CommsIQ" },
      {
        name: "description",
        content:
          "The daily record of FKF conversation, campaign execution and persona activity, with downloadable CSVs.",
      },
      { property: "og:title", content: "Reports - FKF CommsIQ" },
      {
        property: "og:description",
        content:
          "Every day leaves behind a clear, downloadable record of mentions and campaign activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "custom", label: "Custom date range" },
] as const;

function GenerateDialog() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const run = useServerFn(createReport);
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["value"]>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const mutation = useMutation({
    mutationFn: () => run({ data: { period, from: from || undefined, to: to || undefined } }),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      setOpen(false);
      navigate({ to: "/reports/$reportId", params: { reportId: id } });
    },
    onError: (error: Error) => toast.error(friendlyError(error, { action: "create this report" })),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full">
          <CalendarRange className="size-4" /> Create report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PERIODS.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant={period === item.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          {period === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="type-meta space-y-1 text-muted-foreground">
                From
                <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label className="type-meta space-y-1 text-muted-foreground">
                To
                <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
            </div>
          ) : null}
          <p className="type-meta text-muted-foreground">
            Uses data already stored in the platform — creating a report won't start a new
            monitoring sweep.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Section = "automated" | "managed";
const PAGE_SIZE = 10;

function MetricCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MessageSquare;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="type-meta truncate text-muted-foreground">{label}</p>
        <p className="type-meta font-semibold text-foreground">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function ReportsPage() {
  const [section, setSection] = useState<Section>("automated");
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [page, setPage] = useState(1);
  const { data: profile } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  const load = useServerFn(listReports);

  const kind =
    filter === "campaign" || filter === "mentions" || filter === "persona" ? "all" : filter;
  const { data, isLoading } = useQuery({
    queryKey: ["reports", kind],
    queryFn: () => load({ data: { kind } }),
  });

  const reports = data?.reports ?? [];
  const totals = reports.reduce(
    (acc, report) => ({
      mentions: acc.mentions + report.mentions,
      campaigns: acc.campaigns + report.campaigns,
      actions: acc.actions + report.engagementActions,
    }),
    { mentions: 0, campaigns: 0, actions: 0 },
  );
  const pageCount = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = reports.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const kindCounts = reports.reduce<Record<string, number>>((acc, report) => {
    acc[report.kind] = (acc[report.kind] ?? 0) + 1;
    return acc;
  }, {});
  const maxKindCount = Math.max(1, ...Object.values(kindCounts));

  const sortedByDate = [...reports].sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1));
  const latestReport = sortedByDate[0];
  const oldestReport = sortedByDate[sortedByDate.length - 1];

  return (
    <WorkspaceShell title="Reports" wide>
      <PageTitle description="Your daily records and Persona_Voices's prepared reports, all in one place.">
        Reports
      </PageTitle>

      <PageTabs
        items={[
          { value: "automated", label: "Automated reports", count: reports.length },
          { value: "managed", label: "Managed reports" },
        ]}
        value={section}
        onChange={setSection}
        ariaLabel="Report libraries"
      />

      {section === "managed" ? (
        <div className="mt-5">
          <ManagedReportsLibrary isAdmin={isAdmin} />
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 gap-5">
          {!isLoading && reports.length > 0 ? (
            <div className="card-surface grid grid-cols-2 divide-border overflow-hidden p-0 lg:grid-cols-4 lg:divide-x">
              {[
                { icon: FileText, label: "Reports", value: reports.length },
                { icon: TrendingUp, label: "Engagement actions", value: totals.actions },
                { icon: Megaphone, label: "Campaigns", value: totals.campaigns },
                { icon: MessageSquare, label: "Mentions", value: totals.mentions },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 border-b border-border px-4 py-4 last:border-b-0 lg:border-b-0"
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <item.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-semibold tracking-tight">
                      {item.value.toLocaleString()}
                    </p>
                    <p className="type-meta truncate text-muted-foreground">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <CommandGrid
            left={
              <>
                <RailCard title="Report type" icon={Layers}>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    {REPORT_FILTERS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setFilter(item.value);
                          setPage(1);
                        }}
                        className={`type-meta shrink-0 rounded-lg border px-2.5 py-1.5 font-medium transition-colors ${
                          filter === item.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </RailCard>

                <RailCard title="Distribution" icon={FileText}>
                  {Object.keys(kindCounts).length === 0 ? (
                    <p className="type-meta text-muted-foreground">No reports loaded yet.</p>
                  ) : (
                    <div>
                      {Object.entries(kindCounts).map(([k, count]) => (
                        <RailBar
                          key={k}
                          label={k}
                          value={count}
                          total={maxKindCount}
                          valueLabel={count}
                        />
                      ))}
                    </div>
                  )}
                </RailCard>

                <RailCard title="Period summary" icon={Clock}>
                  <RailStatList>
                    <RailStat label="Reports loaded" value={reports.length} />
                    <RailStat
                      label="Most recent"
                      value={latestReport ? formatReportDateShort(latestReport.reportDate) : "—"}
                    />
                    <RailStat
                      label="Earliest"
                      value={oldestReport ? formatReportDateShort(oldestReport.reportDate) : "—"}
                    />
                  </RailStatList>
                </RailCard>
              </>
            }
            right={
              <>
                <RailCard title="Actions" icon={CalendarRange}>
                  <div className="grid gap-2">
                    <GenerateDialog />
                    <RailAction
                      onClick={() => setSection("managed")}
                      icon={Archive}
                      title="Browse managed reports"
                      description="Persona_Voices's hand-prepared deliverables"
                    />
                    {isAdmin ? (
                      <RailAction
                        onClick={() => setSection("managed")}
                        icon={ShieldCheck}
                        title="Publish a managed report"
                        description="Attach a file in Lovable Chat, then say “Add this to Managed Reports”"
                      />
                    ) : null}
                  </div>
                </RailCard>

                {latestReport ? (
                  <RailCard title="Latest report" icon={FileText}>
                    <div className="space-y-2">
                      <p className="type-card font-semibold capitalize">
                        {latestReport.kind === "daily"
                          ? "Daily summary"
                          : `${latestReport.kind} report`}
                      </p>
                      <p className="type-meta text-muted-foreground">
                        {formatReportDateShort(latestReport.reportDate)}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <ReportPdfButton reportId={latestReport.id} className="flex-1" />
                        <ReportCsvMenu reportId={latestReport.id} />
                      </div>
                    </div>
                  </RailCard>
                ) : null}
              </>
            }
          >
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-28 animate-pulse rounded-xl bg-muted/60" />
                ))}
              </div>
            ) : reports.length === 0 ? (
              <EmptyState
                title="No reports yet"
                description="Daily records appear automatically. Create a focused report whenever you need a snapshot for a specific period."
                action={<GenerateDialog />}
              />
            ) : (
              <div className="card-surface overflow-hidden p-0">
                <div className="border-b border-border px-4 py-3 sm:px-5">
                  <SectionTitle>Recent reports</SectionTitle>
                </div>
                <ul className="divide-y divide-border">
                  {visible.map((report) => (
                    <li
                      key={report.id}
                      className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-center leading-tight">
                          <span className="type-meta font-semibold text-primary">
                            {formatReportDateShort(report.reportDate).replace(/ \d{4}$/, "")}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="type-card font-semibold capitalize">
                              {report.kind === "daily" ? "Daily summary" : `${report.kind} report`}
                            </p>
                            <StatusPill status={report.status} />
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3">
                            <MetricCell
                              icon={MessageSquare}
                              label="Mentions"
                              value={report.mentions}
                            />
                            <MetricCell
                              icon={Megaphone}
                              label="Campaigns"
                              value={report.campaigns}
                            />
                            <MetricCell
                              icon={TrendingUp}
                              label="Engagement actions"
                              value={report.engagementActions}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                        <ReportPdfButton reportId={report.id} className="flex-1 md:flex-none" />
                        <ReportCsvMenu reportId={report.id} />
                      </div>
                    </li>
                  ))}
                </ul>
                {pageCount > 1 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-1 overflow-x-auto">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 shrink-0"
                        disabled={current === 1}
                        onClick={() => setPage(current - 1)}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                        <Button
                          key={number}
                          variant={number === current ? "default" : "ghost"}
                          size="icon"
                          className="size-9 shrink-0"
                          onClick={() => setPage(number)}
                        >
                          {number}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 shrink-0"
                        disabled={current === pageCount}
                        onClick={() => setPage(current + 1)}
                        aria-label="Next page"
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                    <p className="type-meta text-muted-foreground">
                      {reports.length.toLocaleString()} reports
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </CommandGrid>
        </div>
      )}
    </WorkspaceShell>
  );
}
