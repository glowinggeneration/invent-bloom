import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PublishLanding } from "@/components/publish-landing";
import { ReplyCampaign } from "@/components/reply-campaign";
import { PostCampaign } from "@/components/post-campaign";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, PageTitle } from "@/components/ui-kit";

const publishSearchSchema = z.object({
  text: z.string().optional(),
  image: z.string().url().optional(),
  mode: z.enum(["comment", "tweet", "both"]).optional(),
  target: z.string().optional(),
  goal: z.string().optional(),
  choose: z.boolean().optional(),
});

export const Route = createFileRoute("/_authenticated/publish")({
  head: () => ({
    meta: [
      { title: "Create campaign - FKF CommsIQ" },
      {
        name: "description",
        content:
          "Create a reviewed Post or Reply campaign from the connected FKF communications workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Create campaign - FKF CommsIQ" },
      {
        property: "og:description",
        content:
          "Choose a deliberate publishing workflow, review the content and launch through the normal campaign safeguards.",
      },
    ],
  }),
  validateSearch: publishSearchSchema,
  component: PublishPage,
});

function PublishPage() {
  const search = Route.useSearch();

  // Preserve older deep links that supplied a mode instead of the newer goal.
  // A target conversation always means Reply; otherwise an explicit tweet goal
  // means Post. Everything else goes through the safe campaign chooser.
  const resolvedGoal =
    search.goal === "post" || search.mode === "tweet"
      ? "post"
      : search.goal === "reply" || search.mode === "comment" || Boolean(search.target)
        ? "reply"
        : null;

  if (resolvedGoal === "post") return <PostCampaign />;
  if (resolvedGoal === "reply") return <ReplyCampaign />;

  return (
    <WorkspaceShell title="Create campaign">
      <PageTitle description="Choose the publishing outcome you need. Each workflow takes you through content, account selection, review and timing.">
        Create campaign
      </PageTitle>
      <PublishLanding startChoosing={search.choose !== false} />
    </WorkspaceShell>
  );
}

/**
 * Compatibility surface for older route imports. Normal campaign creation now
 * resolves only to reviewed Post or Reply flows. Retired legacy goals land on a
 * clear explanation instead of exposing old engagement or follow controls.
 */
export function PublishWorkspace({
  goal = null,
  title = "Create campaign",
}: {
  goal?: string | null;
  title?: string;
}) {
  if (goal === "post") return <PostCampaign />;
  if (goal === "reply" || goal === "comment") return <ReplyCampaign />;

  return (
    <WorkspaceShell title={title}>
      <PageTitle description="This older campaign path is no longer part of the current execution model.">
        {title}
      </PageTitle>
      <Card>
        <p className="type-card font-semibold">Choose a current campaign workflow</p>
        <p className="type-meta mt-1 text-muted-foreground">
          Campaign creation now uses reviewed Post and Reply workflows. Monitoring remains available
          separately in Mentions and Watchlist.
        </p>
        <div className="mt-4">
          <PublishLanding startChoosing />
        </div>
      </Card>
    </WorkspaceShell>
  );
}
