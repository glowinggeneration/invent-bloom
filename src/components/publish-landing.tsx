import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Gauge, ShieldCheck } from "lucide-react";

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
          <SectionTitle>{startChoosing ? "Choose one outcome" : "Create a campaign"}</SectionTitle>
          <p className="mt-1 type-meta text-muted-foreground">
            Start with the action. The relevant accounts, review controls and timing options follow.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/campaign-manager">
            <Gauge className="size-4" /> View campaigns
          </Link>
        </Button>
      </div>

      <PublishGoalGrid onPick={(title) => setLoadingGoal(title)} />

      <div className="flex items-start gap-3 border-t border-border pt-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="type-meta text-muted-foreground">
          Every path requires an authorised account, content review and confirmed timing before it
          can run.
        </p>
      </div>
    </Card>
  );
}
