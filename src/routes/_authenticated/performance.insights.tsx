import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, LockScreen, PageTitle } from "@/components/ui-kit";
import { PerformanceInsights } from "@/components/performance-insights";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import { getPerformance } from "@/lib/performance.functions";

export const Route = createFileRoute("/_authenticated/performance/insights")({
  head: () => ({
    meta: [
      { title: "Performance insights - FKF CommsIQ" },
      {
        name: "description",
        content:
          "Historical performance comparison, timing guidance and unusual movement from stored campaign data.",
      },
    ],
  }),
  component: PerformanceInsightsPage,
});

function PerformanceInsightsPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const load = useServerFn(getPerformance);
  const performance = useQuery({
    queryKey: ["performance"],
    queryFn: () => load(),
    enabled: !profileLoading && isAdminEmail(profile?.email),
    refetchInterval: 5 * 60 * 1000,
  });

  if (!profileLoading && !isAdminEmail(profile?.email)) {
    return (
      <WorkspaceShell title="Performance insights" wide>
        <LockScreen title="Performance is restricted to admins" />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell title="Performance insights" wide>
      <PageTitle
        description="The same performance history, with deeper context to help you decide what's next."
        actions={
          <Button asChild variant="outline">
            <Link to="/performance">
              <ArrowLeft className="size-4" /> Full Performance
            </Link>
          </Button>
        }
      >
        Performance insights
      </PageTitle>

      {performance.isLoading ? (
        <Card className="flex items-center gap-2 p-6 type-body text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading performance history…
        </Card>
      ) : performance.data ? (
        <PerformanceInsights data={performance.data} />
      ) : (
        <Card className="p-6">
          <p className="type-body">Nothing here yet.</p>
          <p className="type-meta mt-1 text-muted-foreground">
            Published posts and campaign replies will build this view over time.
          </p>
        </Card>
      )}
    </WorkspaceShell>
  );
}
