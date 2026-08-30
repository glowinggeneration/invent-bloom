import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  Bell,
  Building2,
  Gauge,
  HelpCircle,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { WorkspaceShell } from "@/components/workspace-shell";
import { initialsOf } from "@/lib/initials";
import { ContactSupportButton } from "@/components/contact-support";
import { TipPreferences } from "@/components/tip-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, PageTitle, StatCard } from "@/components/ui-kit";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { listThreads, updateProfileName } from "@/lib/smait.functions";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile - FKF CommsIQ" },
      {
        name: "description",
        content: "Manage your CommsIQ identity, preferences, activity and session.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const rename = useServerFn(updateProfileName);
  const fetchThreads = useServerFn(listThreads);
  const { theme, setTheme } = useTheme();
  const [fullName, setFullName] = useState("");

  const { data: threads } = useQuery({
    queryKey: ["threads", "mine"],
    queryFn: () => fetchThreads({ data: { scope: "mine" } }),
  });

  const list = threads ?? [];
  const scored = list.filter((thread) => typeof thread.confidence === "number");
  const average = scored.length
    ? Math.round(scored.reduce((sum, thread) => sum + (thread.confidence ?? 0), 0) / scored.length)
    : null;
  const shared = list.filter((thread) => thread.visibility === "workspace").length;

  useEffect(() => {
    if (profile) setFullName(profile.fullName);
  }, [profile]);

  const save = useMutation({
    mutationFn: () => rename({ data: { fullName } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Saved.");
    },
    onError: (e: Error) => toast.error(friendlyError(e, { action: "save that name" })),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <WorkspaceShell title="My Profile">
      <PageTitle description="Your identity, preferences and personal activity inside the communications workspace.">
        My Profile
      </PageTitle>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tests created" value={list.length} icon={UserRound} />
        <StatCard label="Shared with FKF" value={shared} icon={Building2} />
        <StatCard
          label="Avg confidence"
          value={average === null ? "—" : `${average}%`}
          icon={Gauge}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-4">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-fkf-green text-lg font-bold text-navy-foreground">
                {initialsOf(profile?.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate type-card font-semibold">{profile?.fullName ?? "…"}</p>
                <p className="truncate type-meta text-muted-foreground">{profile?.email}</p>
                <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-1 type-meta font-semibold text-primary">
                  {profile?.org === "fkf" ? "FKF workspace" : "External workspace"}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
              <p className="type-meta text-muted-foreground">
                This is how your name appears on tests, shared work and workspace activity.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending || !fullName.trim()}>
                Save changes
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="size-4" /> Log out
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 type-card font-semibold">
              <Building2 className="size-4 text-primary" /> Workspace
            </h2>
            <p className="mt-2 type-body text-muted-foreground">
              {profile?.org === "fkf"
                ? "Football Kenya Federation shared workspace. Your Response Studio tests stay private until you choose to share them."
                : "Your current workspace. Tests and files follow the access rules shown when you share them."}
            </p>
          </Card>

          <Card>
            <h2 className="type-card font-semibold">Appearance</h2>
            <p className="mt-1 type-meta text-muted-foreground">
              Choose the interface that is easiest for you to work in.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                <Sun className="size-4" /> Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                <Moon className="size-4" /> Dark
              </Button>
            </div>
          </Card>

          <TipPreferences />
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="type-card font-semibold">Quick settings</h2>
            <div className="mt-3 grid gap-2">
              <Button asChild variant="outline" className="justify-start">
                <Link to="/notifications">
                  <Bell className="size-4" /> Notifications
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link
                  to="/archive"
                  search={{ q: "", persona: "all", reaction: "all", date: "all", sort: "recent" }}
                >
                  <Archive className="size-4" /> Test archive
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/help">
                  <HelpCircle className="size-4" /> Help Centre
                </Link>
              </Button>
            </div>
          </Card>

          <Card className="bg-fkf-green/5">
            <h2 className="flex items-center gap-2 type-card font-semibold text-fkf-green">
              <ShieldCheck className="size-4" /> Access & security
            </h2>
            <p className="mt-2 type-meta text-muted-foreground">
              Your email is managed by workspace authentication. Contact the workspace administrator
              if you need access or password help.
            </p>
          </Card>

          <Card>
            <h2 className="type-card font-semibold">Need help?</h2>
            <p className="mt-2 type-meta text-muted-foreground">
              Open the Help Centre first, or contact platform support on WhatsApp.
            </p>
            <ContactSupportButton context="Profile support" className="mt-3 w-full" size="sm" />
          </Card>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
