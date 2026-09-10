import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, LockScreen, PageTitle, SectionTitle } from "@/components/ui-kit";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import { friendlyError } from "@/lib/friendly-errors";
import {
  listAllWorkspaces,
  updateWorkspacePlan,
  type AdminWorkspace,
} from "@/lib/admin-users.functions";
import { listPlanTiers, type PlanTier } from "@/lib/workspace-team.functions";

export const Route = createFileRoute("/_authenticated/admin/workspaces")({
  head: () => ({
    meta: [
      { title: "All Workspaces - SMAIT" },
      {
        name: "description",
        content:
          "Every workspace on the platform, its plan tier, and its member and account counts.",
      },
    ],
  }),
  component: AdminWorkspacesPage,
});

const PLAN_TIERS = ["free", "pro", "enterprise"] as const;

function stamp(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { dateStyle: "medium" });
}

function AdminWorkspacesPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  const load = useServerFn(listAllWorkspaces);
  const loadPlans = useServerFn(listPlanTiers);
  const changePlan = useServerFn(updateWorkspacePlan);
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const workspaces = useQuery({
    queryKey: ["admin-workspaces"],
    queryFn: () => load(),
    enabled: !profileLoading && isAdmin,
  });

  const plans = useQuery({
    queryKey: ["plan-tiers"],
    queryFn: () => loadPlans(),
    enabled: !profileLoading && isAdmin,
  });
  const planByTier = new Map((plans.data ?? []).map((p) => [p.tier, p]));

  function priceLabel(tier: PlanTier | undefined): string {
    if (!tier) return "";
    if (tier.monthlyPriceUsd === null) return "custom";
    if (tier.monthlyPriceUsd === 0) return "free";
    return `$${tier.monthlyPriceUsd}/mo`;
  }

  const updatePlan = useMutation({
    mutationFn: (input: { workspaceId: string; planTier: (typeof PLAN_TIERS)[number] }) =>
      changePlan({ data: input }),
    onMutate: (input) => setPendingId(input.workspaceId),
    onSuccess: () => {
      toast.success("Plan updated.");
      void queryClient.invalidateQueries({ queryKey: ["admin-workspaces"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e, { action: "change that plan" })),
    onSettled: () => setPendingId(null),
  });

  if (!profileLoading && !isAdmin) {
    return (
      <WorkspaceShell title="All Workspaces" wide>
        <LockScreen title="Platform administration is restricted" />
      </WorkspaceShell>
    );
  }

  const rows: AdminWorkspace[] = workspaces.data ?? [];

  return (
    <WorkspaceShell title="All Workspaces" wide>
      <PageTitle
        description="Every isolated workspace on the platform — its plan, members and connected accounts. Plan changes take effect immediately; there is no payment step yet."
        actions={
          <Button
            variant="outline"
            onClick={() => workspaces.refetch()}
            disabled={workspaces.isFetching}
          >
            <RefreshCw className={workspaces.isFetching ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        }
      >
        All Workspaces
      </PageTitle>

      {plans.data ? (
        <Card className="mt-6 p-0">
          <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {plans.data.map((tier) => (
              <div key={tier.tier} className="p-5">
                <p className="type-meta font-semibold uppercase tracking-wide text-muted-foreground">
                  {tier.label}
                </p>
                <p className="mt-1 type-card font-semibold">{priceLabel(tier)}</p>
                <p className="mt-2 type-meta text-muted-foreground">
                  {tier.maxAccounts} accounts · {tier.maxSeats} seats · {tier.maxKeywords} keywords
                  · {tier.maxAiCallsMonth.toLocaleString()} AI calls/mo
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {tier.costNote}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {workspaces.isLoading ? (
        <Card className="mt-6 flex items-center gap-2 p-6 type-body text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading workspaces…
        </Card>
      ) : rows.length ? (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <SectionTitle>{rows.length.toLocaleString()} workspaces</SectionTitle>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-border type-meta text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Workspace</th>
                  <th className="px-5 py-3 font-medium">Owner</th>
                  <th className="px-5 py-3 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" /> Members
                    </span>
                  </th>
                  <th className="px-5 py-3 font-medium">Accounts</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((ws) => (
                  <tr key={ws.id}>
                    <td className="px-5 py-3">
                      <p className="type-body font-medium">{ws.name}</p>
                      <p className="type-meta text-muted-foreground">{ws.status}</p>
                    </td>
                    <td className="px-5 py-3 type-body">{ws.ownerEmail ?? "—"}</td>
                    <td className="px-5 py-3 type-body">{ws.memberCount}</td>
                    <td className="px-5 py-3 type-body">{ws.accountCount}</td>
                    <td className="px-5 py-3 type-meta text-muted-foreground">
                      {stamp(ws.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        aria-label={`Plan tier for ${ws.name}`}
                        value={ws.planTier}
                        disabled={pendingId === ws.id}
                        onChange={(e) =>
                          updatePlan.mutate({
                            workspaceId: ws.id,
                            planTier: e.target.value as (typeof PLAN_TIERS)[number],
                          })
                        }
                        className="h-9 rounded-lg border border-input bg-background px-2 type-meta capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {PLAN_TIERS.map((tier) => (
                          <option key={tier} value={tier}>
                            {tier} · {priceLabel(planByTier.get(tier))}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="mt-6 p-6">
          <p className="type-body">No workspaces yet.</p>
        </Card>
      )}
    </WorkspaceShell>
  );
}
