import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CheckCircle2, Clock, Gauge, Users } from "lucide-react";
import { useMemo } from "react";
import { PublishGoalGrid } from "@/components/publish-goals";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, PageTitle, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { listPublishJobs, listXAccounts } from "@/lib/publish.functions";
import { listScheduledActions } from "@/lib/scheduler.functions";

export const Route = createFileRoute("/_authenticated/campaign/overview")({
  head: () => ({
    meta: [
      { title: "Create campaign - FKF CommsIQ" },
      {
        name: "description",
        content:
          "Choose a campaign type, review queued activity and continue into Campaign Manager.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Create campaign - FKF CommsIQ" },
      {
        property: "og:description",
        content: "A simple campaign home for deliberate Post and Reply workflows.",
      },
    ],
  }),
  component: CampaignOverviewPage,
});

function CampaignOverviewPage() {
  const fetchAccounts = useServerFn(listXAccounts);
  const fetchJobs = useServerFn(listPublishJobs);
  const fetchQueue = useServerFn(listScheduledActions);

  const accountsQuery = useQuery({ queryKey: ["x-accounts"], queryFn: () => fetchAccounts() });
  const jobsQuery = useQuery({ queryKey: ["publish-jobs"], queryFn: () => fetchJobs() });
  const queueQuery = useQuery({
    queryKey: ["scheduled-actions"],
    queryFn: () => fetchQueue(),
    refetchInterval: 60_000,
  });

  const queue = useMemo(() => queueQuery.data ?? [], [queueQuery.data]);
  const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data]);
  const nextAction = queue[0] ?? null;
  const succeeded = jobs.reduce((total, job) => total + job.succeeded, 0);
  const failed = jobs.reduce((total, job) => total + job.failed, 0);
  const activeAccounts = (accountsQuery.data ?? []).filter((account) => account.isActive).length;

  return (
    <WorkspaceShell title="Create campaign" wide>
      <PageTitle
        description="Choose what you want to publish, then review live progress in Campaigns."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/campaign-manager">
              <Gauge className="size-4" /> Open Campaigns
            </Link>
          </Button>
        }
      >
        Create campaign
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarClock}
          label="Queued actions"
          value={queue.length}
          hint={nextAction ? `Next ${nextAction.actionType} is scheduled` : "Nothing waiting"}
        />
        <StatCard
          icon={CheckCircle2}
          label="Actions completed"
          value={succeeded}
          hint="Across recent campaign runs"
        />
        <StatCard
          icon={Users}
          label="Active accounts"
          value={activeAccounts}
          hint="Available for reviewed campaigns"
        />
        <StatCard
          icon={Gauge}
          label="Failed actions"
          value={failed}
          hint={failed ? "Review before adding more work" : "No recent failures"}
          tone={failed ? "negative" : "positive"}
        />
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]">
        <Card>
          <h2 className="type-section">What do you want to do?</h2>
          <p className="type-meta mt-1 text-muted-foreground">
            Start with the outcome. The platform will take you through the relevant message,
            account, review and timing steps.
          </p>
          <div className="mt-4">
            <PublishGoalGrid />
          </div>
        </Card>

        <div className="grid gap-5">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="type-section">Up next</h2>
                <p className="type-meta mt-1 text-muted-foreground">
                  Reviewed actions waiting in the queue.
                </p>
              </div>
              <span className="type-meta font-semibold">{queue.length}</span>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {queue.slice(0, 6).map((action) => (
                <li key={action.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="type-meta block truncate font-semibold">
                      @{action.handle} · {action.actionType}
                    </span>
                    <span className="type-meta mt-0.5 block text-muted-foreground">
                      {new Date(action.runAt).toLocaleString()}
                    </span>
                  </span>
                </li>
              ))}
              {!queue.length ? (
                <li className="type-meta text-muted-foreground">Nothing is queued right now.</li>
              ) : null}
            </ul>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="type-section">Recent campaigns</h2>
                <p className="type-meta mt-1 text-muted-foreground">Recent Post and Reply runs.</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/campaign-manager">View all</Link>
              </Button>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {jobs.slice(0, 6).map((job) => (
                <li key={job.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="type-meta line-clamp-2 font-semibold">
                    {job.objectiveText || job.tweetText || job.targetTweetUrl || "Campaign run"}
                  </p>
                  <p className="type-meta mt-1 text-muted-foreground">
                    {job.succeeded} completed · {job.failed} failed ·{" "}
                    {new Date(job.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
              {!jobs.length ? (
                <li className="type-meta text-muted-foreground">No campaign runs yet.</li>
              ) : null}
            </ul>
          </Card>
        </div>
      </div>
    </WorkspaceShell>
  );
}
