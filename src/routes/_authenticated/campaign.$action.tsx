import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { PublishWorkspace } from "@/routes/_authenticated/publish";
import { PUBLISH_GOALS } from "@/components/publish-goals";
import { ReplyCampaign } from "@/components/reply-campaign";
import { PostCampaign } from "@/components/post-campaign";
import { EngageCampaign } from "@/components/engage-campaign";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, PageTitle } from "@/components/ui-kit";

/** One dedicated page per supported campaign action. */
export const Route = createFileRoute("/_authenticated/campaign/$action")({
  // Optional prefill, used when a campaign is started from a mention or a news story.
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    text?: string | undefined;
    link?: string | undefined;
    mode?: string | undefined;
    target?: string | undefined;
  } => {
    const str = (key: string) =>
      typeof search[key] === "string" ? (search[key] as string) : undefined;
    return { text: str("text"), link: str("link"), mode: str("mode"), target: str("target") };
  },
  head: ({ params }) => {
    const goal = PUBLISH_GOALS.find((g) => g.action === params.action);
    const title = `${goal?.title ?? "Campaign"} campaign - CommsIQ`;
    const description = goal?.description ?? "Run a controlled campaign on X.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: CampaignActionPage,
});

const RETIRED_ACTIONS = new Set(["like", "follow", "intercept", "auto"]);

function RetiredCampaignAction({ action }: { action: string }) {
  return (
    <WorkspaceShell title="Campaign safety">
      <PageTitle description="This legacy execution path has been retired from campaign automation.">
        Campaign safety
      </PageTitle>
      <Card className="mt-6 p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="type-section">{action} automation is no longer an execution mode</h2>
            <p className="type-body mt-2 text-muted-foreground">
              Monitoring and campaign execution are now separated. Use Mentions and Watchlist to
              identify a conversation, then deliberately publish an original post or respond with
              one suitable linked account after review.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/mentions">Open Mentions</Link>
              </Button>
              <Button asChild>
                <Link to="/campaign/$action" params={{ action: "post" }}>
                  Create post campaign
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/campaign/$action" params={{ action: "reply" }}>
                  Create reply
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </WorkspaceShell>
  );
}

function CampaignActionPage() {
  const { action } = Route.useParams();
  if (action === "reply") return <ReplyCampaign />;
  if (action === "post") return <PostCampaign />;
  if (action === "engage") return <EngageCampaign />;
  if (RETIRED_ACTIONS.has(action)) return <RetiredCampaignAction action={action} />;
  return <PublishWorkspace goal={null} title="Campaigns" />;
}
