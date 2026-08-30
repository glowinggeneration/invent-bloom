import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Gauge } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui-kit";
import { PublishGoalGrid } from "@/components/publish-goals";
import { CampaignActionLoading } from "@/components/campaign-loading";

/**
 * Single front door for campaign creation. Keep the choice small and familiar:
 * choose the publishing outcome first, then complete the relevant workflow.
 */
export function PublishLanding({ startChoosing = true }: { startChoosing?: boolean }) {
  const [loadingGoal, setLoadingGoal] = useState<string | null>(null);

  if (loadingGoal) return <CampaignActionLoading label={loadingGoal} />;

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle>
            {startChoosing ? "What do you want to do?" : "Create a campaign"}
          </SectionTitle>
          <p className="mt-1 type-meta text-muted-foreground">
            Choose Post for original content or Reply for one reviewed response to a specific
            conversation.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/campaign-manager">
            <Gauge className="size-4" /> View campaigns
          </Link>
        </Button>
      </div>

      <PublishGoalGrid onPick={(title) => setLoadingGoal(title)} />

      <p className="type-meta border-t border-border pt-4 text-muted-foreground">
        Monitoring, intelligence and watchlists are managed separately so creating a campaign always
        remains a deliberate action.
      </p>
    </Card>
  );
}
