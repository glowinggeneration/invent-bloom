import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, PageTitle, SectionTitle } from "@/components/ui-kit";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import { getBrandHealth } from "@/lib/brand-health.functions";
import { downloadCustomReportPdf, type CustomReportSections } from "@/lib/custom-report-pdf";
import type { OverviewWindow } from "@/lib/overview";
import { getOverview } from "@/lib/overview.functions";
import { getOverviewIntelligence } from "@/lib/overview-intelligence.functions";
import { getPerformance } from "@/lib/performance.functions";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/reports/builder")({
  head: () => ({
    meta: [
      { title: "Custom Report Builder - FKF CommsIQ" },
      {
        name: "description",
        content:
          "Build a PDF from selected current Overview, intelligence, message-testing, campaign and performance sections.",
      },
    ],
  }),
  component: CustomReportBuilderPage,
});

const WINDOWS: { value: OverviewWindow; label: string }[] = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

const SECTION_OPTIONS: {
  key: keyof CustomReportSections;
  title: string;
  description: string;
}[] = [
  {
    key: "executive",
    title: "Executive snapshot",
    description: "Brand health, mentions, views, engagements, sentiment and leading topics.",
  },
  {
    key: "intelligence",
    title: "Conversation intelligence",
    description:
      "Intelligence brief, narratives, risks, opportunities and compared-with-normal context.",
  },
  {
    key: "messageTesting",
    title: "Response Studio",
    description: "Test volume, confidence and recent message-test results.",
  },
  {
    key: "campaigns",
    title: "Campaigns and delivery",
    description: "Campaign activity, replies, delivery outcomes and active-account context.",
  },
  {
    key: "performance",
    title: "Performance",
    description:
      "Measured posts, replies, reach, impressions, engagements and leading campaigns. Admin only.",
  },
];

function CustomReportBuilderPage() {
  const { data: profile } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  const fetchOverview = useServerFn(getOverview);
  const fetchIntel = useServerFn(getOverviewIntelligence);
  const fetchHealth = useServerFn(getBrandHealth);
  const fetchPerformance = useServerFn(getPerformance);
  const [window, setWindow] = useState<OverviewWindow>("7d");
  const [title, setTitle] = useState("FKF Communications Intelligence Report");
  const [sections, setSections] = useState<CustomReportSections>({
    executive: true,
    intelligence: true,
    messageTesting: true,
    campaigns: true,
    performance: isAdmin,
  });

  const overview = useQuery({
    queryKey: ["report-builder", "overview", window],
    queryFn: () => fetchOverview({ data: { window } }),
  });

  const range = useMemo(
    () =>
      overview.data
        ? { from: overview.data.from.slice(0, 10), to: overview.data.to.slice(0, 10) }
        : null,
    [overview.data],
  );

  const intel = useQuery({
    queryKey: ["report-builder", "intelligence"],
    queryFn: () => fetchIntel(),
  });

  const health = useQuery({
    queryKey: ["report-builder", "health", range?.from ?? "", range?.to ?? ""],
    queryFn: () => fetchHealth({ data: range ?? {} }),
    enabled: Boolean(range),
  });

  const performance = useQuery({
    queryKey: ["report-builder", "performance"],
    queryFn: () => fetchPerformance(),
    enabled: isAdmin && sections.performance,
  });

  const selectedCount = Object.values(sections).filter(Boolean).length;
  const loading =
    overview.isLoading ||
    (sections.intelligence && intel.isLoading) ||
    ((sections.messageTesting || sections.campaigns) && health.isLoading) ||
    (sections.performance && isAdmin && performance.isLoading);

  function toggle(key: keyof CustomReportSections, checked: boolean) {
    if (key === "performance" && !isAdmin) return;
    setSections((current) => ({ ...current, [key]: checked }));
  }

  async function generate() {
    if (!overview.data) {
      toast.error("This report isn't ready yet. Wait a moment and try again.");
      return;
    }
    if (!selectedCount) {
      toast.error("Choose at least one section before creating this report.");
      return;
    }
    try {
      const periodLabel = WINDOWS.find((item) => item.value === window)?.label ?? window;
      await downloadCustomReportPdf({
        title: title.trim() || "FKF Communications Intelligence Report",
        periodLabel,
        overview: overview.data,
        intelligence: sections.intelligence ? (intel.data ?? null) : null,
        brandHealth: sections.messageTesting || sections.campaigns ? (health.data ?? null) : null,
        performance: sections.performance && isAdmin ? (performance.data ?? null) : null,
        sections: {
          ...sections,
          performance: sections.performance && isAdmin,
        },
      });
      toast.success("Your report is ready.");
    } catch (error) {
      console.error(error);
      toast.error(friendlyError(error, { action: "create this report" }));
    }
  }

  return (
    <WorkspaceShell title="Custom Report Builder" wide>
      <PageTitle
        description="Choose the sections you need and create a PDF from data the platform has already collected."
        actions={
          <Button asChild variant="outline">
            <Link to="/reports">
              <ArrowLeft className="size-4" /> Reports
            </Link>
          </Button>
        }
      >
        Custom Report Builder
      </PageTitle>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <Card className="p-5">
            <SectionTitle>Report setup</SectionTitle>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="type-meta font-semibold text-muted-foreground">Report title</span>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={100}
                />
              </label>
              <div className="grid gap-2">
                <span className="type-meta font-semibold text-muted-foreground">
                  Reporting window
                </span>
                <div className="flex flex-wrap gap-2">
                  {WINDOWS.map((item) => (
                    <Button
                      key={item.value}
                      type="button"
                      size="sm"
                      variant={window === item.value ? "default" : "outline"}
                      aria-pressed={window === item.value}
                      onClick={() => setWindow(item.value)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle>Include sections</SectionTitle>
            <div className="mt-4 grid gap-3">
              {SECTION_OPTIONS.map((option) => {
                const disabled = option.key === "performance" && !isAdmin;
                return (
                  <label
                    key={option.key}
                    className={`flex items-start gap-3 rounded-xl border border-border p-4 ${disabled ? "opacity-60" : "cursor-pointer"}`}
                  >
                    <Checkbox
                      checked={sections[option.key]}
                      disabled={disabled}
                      onCheckedChange={(checked) => toggle(option.key, checked === true)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="type-body block font-semibold">{option.title}</span>
                      <span className="type-meta mt-1 block text-muted-foreground">
                        {option.description}
                        {disabled ? " Performance is only available to admins." : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Card>
        </div>

        <div>
          <Card className="sticky top-20 p-5">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <SectionTitle>Report summary</SectionTitle>
            </div>
            <dl className="mt-4 grid gap-3">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <dt className="type-meta text-muted-foreground">Window</dt>
                <dd className="type-body font-semibold">
                  {WINDOWS.find((item) => item.value === window)?.label}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <dt className="type-meta text-muted-foreground">Sections</dt>
                <dd className="type-body font-semibold">{selectedCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="type-meta text-muted-foreground">Format</dt>
                <dd className="type-body font-semibold">PDF</dd>
              </div>
            </dl>

            <p className="type-meta mt-4 text-muted-foreground">
              Built from Overview, intelligence, message-testing, campaign and performance data
              already stored in the platform. It won't start a new monitoring run.
            </p>

            <Button
              className="mt-5 w-full"
              size="lg"
              disabled={loading || !selectedCount}
              onClick={() => void generate()}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {loading ? "Preparing data…" : "Create PDF"}
            </Button>
          </Card>
        </div>
      </div>
    </WorkspaceShell>
  );
}
