import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Bell, Database, Gauge, ShieldCheck, UsersRound, Wrench } from "lucide-react";

import { AdminUsersPanel } from "@/components/admin-users";
import { ApifyIntegrationCard } from "@/components/apify-integration";
import { WorkspaceShell } from "@/components/workspace-shell";
import { initialsOf } from "@/lib/initials";
import { Button } from "@/components/ui/button";
import { Card, LockScreen, PageTitle } from "@/components/ui-kit";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/admin/profile")({
  head: () => ({
    meta: [
      { title: "Admin Profile - FKF CommsIQ" },
      {
        name: "description",
        content: "Administrative identity, workspace controls, users and integrations.",
      },
    ],
  }),
  component: AdminProfilePage,
});

function AdminProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);

  if (!isLoading && !isAdmin) {
    return (
      <WorkspaceShell title="Admin Profile">
        <LockScreen title="Administrator access required" />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell title="Admin Profile">
      <PageTitle
        description="Your administrator identity and the controls used to manage the CommsIQ workspace."
        actions={
          <Button asChild variant="outline">
            <Link to="/profile">Open my user profile</Link>
          </Button>
        }
      >
        Admin Profile
      </PageTitle>

      <Card className="border-primary/20 bg-primary/[0.025]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
            {initialsOf(profile?.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="type-card font-semibold">{profile?.fullName ?? "Administrator"}</p>
              <span className="rounded-full bg-primary/10 px-2 py-1 type-meta font-semibold text-primary">
                Workspace administrator
              </span>
            </div>
            <p className="mt-1 truncate type-meta text-muted-foreground">{profile?.email}</p>
            <p className="mt-2 type-meta text-muted-foreground">
              Administrative actions affect linked accounts, users, integrations and operational
              availability. Use the user profile for your own display name and personal preferences.
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <AdminUsersPanel />
          <ApifyIntegrationCard />
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="flex items-center gap-2 type-card font-semibold">
              <Wrench className="size-4 text-primary" /> Administration
            </h2>
            <div className="mt-3 grid gap-2">
              <Button asChild variant="outline" className="justify-start">
                <Link to="/linked-accounts">
                  <UsersRound className="size-4" /> Linked Accounts
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/account-health">
                  <Gauge className="size-4" /> X Account Health
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/admin/health">
                  <ShieldCheck className="size-4" /> System Health
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/admin/activity">
                  <Activity className="size-4" /> Operational Activity
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/governance">
                  <Database className="size-4" /> Governance & Data
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/notifications">
                  <Bell className="size-4" /> Notification rules
                </Link>
              </Button>
            </div>
          </Card>

          <Card className="bg-fkf-green/5">
            <h2 className="flex items-center gap-2 type-card font-semibold text-fkf-green">
              <ShieldCheck className="size-4" /> Admin responsibility
            </h2>
            <p className="mt-2 type-meta text-muted-foreground">
              Account credentials and provider secrets remain server-side. Use Linked Accounts for
              status/costs and Manage connections only when you need to import or reconnect
              sessions.
            </p>
          </Card>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
