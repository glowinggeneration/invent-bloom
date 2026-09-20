import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleHelp,
  CreditCard,
  FileDown,
  FileText,
  LogOut,
  MapPin,
  Megaphone,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  UserMinus,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AvatarLabelGroup } from "@/components/base/avatar/avatar-label-group";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AnimatedBackground } from "@/components/core/animated-background";
import { TransitionPanel } from "@/components/core/transition-panel";
import { ContactSupportButton } from "@/components/contact-support";
import { AiBudgetCard } from "@/components/ai-budget-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { friendlyError } from "@/lib/friendly-errors";
import { resetFirstRun } from "@/lib/first-run";
import { recordTipReset, setTipEnabled, useTipPrefs } from "@/lib/tip-prefs";
import { initialsOf } from "@/lib/initials";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { updateProfileName } from "@/lib/smait.functions";
import { getSetupStatus } from "@/lib/onboarding.functions";
import type { SetupStatus } from "@/lib/onboarding";
import {
  getWorkspaceOverview,
  inviteWorkspaceMember,
  removeWorkspaceMember,
} from "@/lib/workspace-team.functions";
import { GlowBorderCard } from "@/components/vengeance/glow-border-card";
import { AnimatedTooltip } from "@/components/vengeance/animated-tooltip";
import { RadialGlowButton } from "@/components/vengeance/radial-glow-button";
import { cn } from "@/lib/utils";

type SectionId = "profile" | "preferences" | "plan" | "security";
type ProfileSearch = { section?: SectionId };

export const Route = createFileRoute("/_authenticated/profile")({
  validateSearch: (search: Record<string, unknown>): ProfileSearch => {
    const section = search["section"];
    return section === "profile" ||
      section === "preferences" ||
      section === "plan" ||
      section === "security"
      ? { section }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Profile & settings - SMAIT" },
      { name: "description", content: "Manage how you appear and work across SMAIT." },
    ],
  }),
  component: ProfilePage,
});

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "plan", label: "Plan" },
  { id: "security", label: "Security" },
];

type ActionState = "idle" | "loading" | "success" | "error";

function ProfilePage() {
  const { section } = Route.useSearch();
  const { data: profile, isLoading } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const rename = useServerFn(updateProfileName);
  const { theme, setTheme } = useTheme();
  const tipPrefs = useTipPrefs();

  const [activeIndex, setActiveIndex] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [saveState, setSaveState] = useState<ActionState>("idle");
  const [saveError, setSaveError] = useState("");
  const [resetState, setResetState] = useState<ActionState>("idle");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");

  const loadWorkspace = useServerFn(getWorkspaceOverview);
  const invite = useServerFn(inviteWorkspaceMember);
  const removeMember = useServerFn(removeWorkspaceMember);
  const fetchSetupStatus = useServerFn(getSetupStatus);

  const workspaceOverview = useQuery({
    queryKey: ["workspace-overview"],
    queryFn: () => loadWorkspace(),
  });

  // Shared with MonitoringSetupCard (same query key, so this is a cache hit
  // once either has fetched) — the completion sidebar reads the same fields
  // that card already shows, nothing new to fetch.
  const setupStatus = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => fetchSetupStatus(),
  });

  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { email: inviteEmail, role: inviteRole } }),
    onSuccess: () => {
      toast.success("Member added.");
      setInviteEmail("");
      void queryClient.invalidateQueries({ queryKey: ["workspace-overview"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e, { action: "add that member" })),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember({ data: { userId } }),
    onSuccess: () => {
      toast.success("Member removed.");
      void queryClient.invalidateQueries({ queryKey: ["workspace-overview"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e, { action: "remove that member" })),
  });

  useEffect(() => {
    if (!section) return;
    const index = SECTIONS.findIndex((item) => item.id === section);
    if (index >= 0) setActiveIndex(index);
  }, [section]);

  // Only follow the server value when it actually changes underneath us
  // (initial load, or a workspace switch) — never clobber an unsaved edit
  // the person is mid-typing just because an unrelated preference elsewhere
  // triggered a re-render.
  useEffect(() => {
    if (profile) setDisplayName((current) => (current === "" ? profile.fullName : current));
  }, [profile?.fullName]);

  const trimmedDisplayName = displayName.trim();
  const displayNameError = useMemo(() => {
    if (!trimmedDisplayName) return "Enter a display name.";
    if (trimmedDisplayName.length < 2) return "Use at least 2 characters.";
    if (trimmedDisplayName.length > 80) return "Use 80 characters or fewer.";
    return "";
  }, [trimmedDisplayName]);

  const isDirty = Boolean(profile) && trimmedDisplayName !== profile?.fullName;
  const isSaving = saveState === "loading";

  useBlocker({
    shouldBlockFn: () => {
      if (!isDirty) return false;
      return !window.confirm("You have unsaved profile changes. Leave without saving?");
    },
  });

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const save = useMutation({
    mutationFn: (name: string) => rename({ data: { fullName: name } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSaveState("success");
    },
    onError: (error: Error) => {
      setSaveState("error");
      setSaveError(friendlyError(error, { action: "save that name" }));
    },
  });

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDirty || displayNameError || isSaving) return;
    setSaveState("loading");
    setSaveError("");
    save.mutate(trimmedDisplayName);
  }

  async function handleResetTips() {
    if (resetState === "loading") return;
    setResetState("loading");
    try {
      resetFirstRun();
      recordTipReset("All guides");
      setResetState("success");
    } catch {
      setResetState("error");
    }
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const relationshipLabel =
    profile?.org === "team" ? `${profile.workspaceName} workspace` : "External collaborator";
  const workspaceName = profile?.org === "team" ? (profile?.workspaceName ?? "Team") : "External";

  return (
    <WorkspaceShell title="Profile & settings">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
        <header>
          <p className="type-meta font-semibold uppercase tracking-[0.08em] text-primary">
            Account
          </p>
          <h1 className="mt-1 type-title">Profile &amp; settings</h1>
        </header>

        {isLoading ? (
          <ProfileSkeleton />
        ) : (
          <>
            <section className="my-7" aria-label="Account identity">
              <AvatarLabelGroup
                size="lg"
                title={profile?.fullName ?? "Account"}
                {...(profile?.email === undefined ? {} : { subtitle: profile.email })}
                trailing={
                  <span className="rounded-full bg-primary/10 px-2 py-1 type-meta font-semibold text-primary">
                    {relationshipLabel}
                  </span>
                }
              />
              <p className="ml-[4.75rem] mt-1 type-meta text-muted-foreground/80">
                {workspaceName} workspace
              </p>
            </section>

            <MonitoringSetupCard />

            <label htmlFor="profile-settings-section" className="sr-only">
              Profile settings section
            </label>
            <select
              id="profile-settings-section"
              aria-label="Profile settings"
              value={SECTIONS[activeIndex]?.id ?? SECTIONS[0]!.id}
              onChange={(event) => {
                const index = SECTIONS.findIndex((item) => item.id === event.target.value);
                if (index >= 0) setActiveIndex(index);
              }}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 type-body text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
            >
              {SECTIONS.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>

            <div
              className="hidden grid-cols-4 gap-1 rounded-2xl bg-muted p-1 sm:grid"
              role="tablist"
              aria-label="Profile settings"
            >
              <AnimatedBackground
                defaultValue={SECTIONS[0]!.id}
                className="rounded-xl bg-background shadow-sm"
                transition={{ ease: "easeInOut", duration: 0.2 }}
              >
                {SECTIONS.map((section, index) => (
                  <button
                    key={section.id}
                    data-id={section.id}
                    id={`${section.id}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={activeIndex === index}
                    aria-controls={`${section.id}-panel`}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "relative z-10 flex min-h-11 min-w-0 items-center justify-center rounded-xl px-2 type-meta font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      activeIndex === index ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <span className="truncate">{section.label}</span>
                  </button>
                ))}
              </AnimatedBackground>
            </div>

            <TransitionPanel
              activeIndex={activeIndex}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              variants={{
                enter: { opacity: 0, y: -8 },
                center: { opacity: 1, y: 0 },
                exit: { opacity: 0, y: 8 },
              }}
            >
              <section
                id="profile-panel"
                role="tabpanel"
                aria-labelledby="profile-tab"
                className="mt-3"
              >
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-5">
                    <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm sm:p-7">
                      <PanelHeader
                        title="Edit profile"
                        description="Used on campaigns, shared work and workspace activity."
                      />

                      <div className="flex flex-col items-center gap-4 border-b border-border py-6 text-center sm:flex-row sm:text-left">
                        <Avatar className="size-20 shrink-0 border border-border bg-muted shadow-sm">
                          <AvatarFallback className="type-card bg-positive font-semibold text-navy-foreground">
                            {initialsOf(profile?.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="type-body font-medium">{profile?.fullName ?? "Account"}</p>
                          <p className="mt-1 type-meta text-muted-foreground">
                            Shown using your initials. Photo uploads aren&apos;t available yet.
                          </p>
                        </div>
                      </div>

                      <PanelHeader
                        title="Personal Info"
                        description="Your name and email as they appear across the workspace."
                        className="border-b-0 pb-0 pt-5"
                      />

                      <form className="grid gap-5 pt-5" onSubmit={handleSave}>
                        <div className="grid gap-2">
                          <Label htmlFor="display-name">Full name</Label>
                          <Input
                            id="display-name"
                            value={displayName}
                            disabled={isSaving}
                            aria-invalid={Boolean(displayNameError)}
                            aria-describedby={displayNameError ? "display-name-error" : undefined}
                            onChange={(event) => {
                              setDisplayName(event.target.value);
                              setSaveState("idle");
                              setSaveError("");
                            }}
                            className="h-11 rounded-xl"
                          />
                          {displayNameError ? (
                            <span id="display-name-error" className="type-meta text-destructive">
                              {displayNameError}
                            </span>
                          ) : null}
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="profile-email">Email address</Label>
                          <Input
                            id="profile-email"
                            value={profile?.email ?? ""}
                            readOnly
                            aria-describedby="profile-email-note"
                            className="h-11 rounded-xl bg-muted text-muted-foreground"
                          />
                          <span id="profile-email-note" className="type-meta text-muted-foreground">
                            Managed by workspace authentication.
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-y border-border py-4">
                          <div>
                            <p className="type-meta text-muted-foreground">Workspace</p>
                            <p className="mt-1 type-body font-medium">{workspaceName}</p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 type-meta font-medium text-muted-foreground">
                            <Building2 className="size-3.5" aria-hidden="true" />
                            {relationshipLabel}
                          </span>
                        </div>

                        <div className="flex min-h-11 flex-wrap items-center gap-3">
                          <Button
                            type="submit"
                            disabled={!isDirty || Boolean(displayNameError) || isSaving}
                            className="min-h-11 rounded-xl px-5"
                          >
                            {isSaving ? "Saving..." : "Save changes"}
                          </Button>
                          <span
                            aria-live="polite"
                            className={cn(
                              "type-meta",
                              saveState === "error"
                                ? "text-destructive"
                                : "text-emerald-700 dark:text-emerald-400",
                            )}
                          >
                            {saveState === "success" ? "Changes saved" : saveError}
                          </span>
                        </div>
                      </form>
                    </div>

                    <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm sm:p-7">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="flex items-center gap-2 type-card font-semibold">
                            <MapPin className="size-4 text-primary" aria-hidden="true" />
                            Location
                          </h3>
                          <p className="mt-1 type-meta text-muted-foreground">
                            The organisation address used across campaigns and reports.
                          </p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="shrink-0 rounded-xl">
                          <Link to="/setup" search={{ edit: true }}>
                            Edit
                          </Link>
                        </Button>
                      </div>
                      <p className="mt-4 type-body">
                        {setupStatus.data?.orgAddress || (
                          <span className="text-muted-foreground">Not set yet.</span>
                        )}
                      </p>
                    </div>

                    <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm sm:p-7">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="flex items-center gap-2 type-card font-semibold">
                            <FileText className="size-4 text-primary" aria-hidden="true" />
                            Bio
                          </h3>
                          <p className="mt-1 type-meta text-muted-foreground">
                            A short description of the organisation this workspace represents.
                          </p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="shrink-0 rounded-xl">
                          <Link to="/setup" search={{ edit: true }}>
                            Edit
                          </Link>
                        </Button>
                      </div>
                      <p className="mt-4 type-body text-muted-foreground">
                        {setupStatus.data?.orgDescription || "No bio added yet."}
                      </p>
                    </div>
                  </div>

                  <aside>
                    <ProfileCompletionCard profile={profile} setup={setupStatus.data} />
                  </aside>
                </div>
              </section>

              <section
                id="preferences-panel"
                role="tabpanel"
                aria-labelledby="preferences-tab"
                className="mt-3 rounded-[18px] border border-border bg-card p-5 shadow-sm sm:p-7"
              >
                <PanelHeader
                  title="Preferences"
                  description="Choose how the workspace looks and when guidance appears."
                />

                <div className="divide-y divide-border">
                  <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="type-body font-medium">Appearance</h3>
                      <p className="mt-1 type-meta text-muted-foreground">
                        Light and dark are the only modes this workspace currently supports.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                      <button
                        type="button"
                        aria-pressed={theme === "light"}
                        onClick={() => setTheme("light")}
                        className={cn(
                          "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 type-meta font-medium",
                          theme === "light"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground",
                        )}
                      >
                        <Sun className="size-3.5" aria-hidden="true" /> Light
                      </button>
                      <button
                        type="button"
                        aria-pressed={theme === "dark"}
                        onClick={() => setTheme("dark")}
                        className={cn(
                          "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 type-meta font-medium",
                          theme === "dark"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground",
                        )}
                      >
                        <Moon className="size-3.5" aria-hidden="true" /> Dark
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-5 py-5">
                    <div>
                      <h3 className="type-body font-medium">First analysis guidance</h3>
                      <p className="mt-1 type-meta text-muted-foreground">
                        Show the checklist when analysis is used for the first time.
                      </p>
                    </div>
                    <Switch
                      checked={tipPrefs["first-run-checklist"]}
                      aria-label="First analysis guidance"
                      onCheckedChange={(checked) => setTipEnabled("first-run-checklist", checked)}
                    />
                  </div>

                  <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="type-body font-medium">Reset guidance</h3>
                      <p className="mt-1 type-meta text-muted-foreground">
                        Show first-time guidance again on this device.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={resetState === "loading"}
                      onClick={handleResetTips}
                      className="min-h-11 rounded-xl"
                    >
                      {resetState === "loading" ? "Resetting..." : "Reset tips"}
                    </Button>
                  </div>
                </div>

                <p className="type-meta text-muted-foreground" aria-live="polite">
                  {resetState === "success"
                    ? "Guidance has been reset."
                    : resetState === "error"
                      ? "Guidance could not be reset."
                      : ""}
                </p>
              </section>

              <section
                id="plan-panel"
                role="tabpanel"
                aria-labelledby="plan-tab"
                className="mt-3 rounded-[18px] border border-border bg-card p-5 shadow-sm sm:p-7"
              >
                <PanelHeader
                  title="Plan & usage"
                  description="Your workspace plan determines the tools and capacity available to this account."
                />

                {workspaceOverview.isLoading ? (
                  <div
                    className="mt-5 h-40 animate-pulse rounded-2xl bg-muted"
                    aria-hidden="true"
                  />
                ) : workspaceOverview.data ? (
                  <>
                    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
                      <GlowBorderCard
                        width="100%"
                        aspectRatio="auto"
                        borderRadius="1rem"
                        animationDuration={8}
                      >
                        <article className="rounded-2xl p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="type-meta font-semibold uppercase tracking-[0.08em] text-primary">
                                Current plan
                              </p>
                              <h3 className="mt-1 type-card font-semibold capitalize">
                                {workspaceOverview.data.limits.label}
                                <span className="ml-2 type-meta font-normal normal-case text-muted-foreground">
                                  {workspaceOverview.data.limits.monthlyPriceUsd === null
                                    ? "Custom pricing"
                                    : workspaceOverview.data.limits.monthlyPriceUsd === 0
                                      ? "Free"
                                      : `$${workspaceOverview.data.limits.monthlyPriceUsd}/mo`}
                                </span>
                              </h3>
                              <p className="mt-1 type-meta text-muted-foreground">
                                {workspaceOverview.data.name}
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 type-meta font-semibold capitalize text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <BadgeCheck className="size-3.5" aria-hidden="true" />
                              {workspaceOverview.data.status}
                            </span>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <UsageStat
                              icon={<UserPlus className="size-4" />}
                              label="Seats"
                              used={workspaceOverview.data.usage.seats}
                              limit={workspaceOverview.data.limits.maxSeats}
                            />
                            <UsageStat
                              icon={<Building2 className="size-4" />}
                              label="Linked accounts"
                              used={workspaceOverview.data.usage.accounts}
                              limit={workspaceOverview.data.limits.maxAccounts}
                            />
                            <UsageStat
                              icon={<Sparkles className="size-4" />}
                              label="Monitored keywords"
                              used={workspaceOverview.data.usage.keywords}
                              limit={workspaceOverview.data.limits.maxKeywords}
                            />
                            <UsageStat
                              icon={<Megaphone className="size-4" />}
                              label="AI calls this month"
                              used={workspaceOverview.data.usage.aiCallsThisMonth}
                              limit={workspaceOverview.data.limits.maxAiCallsMonth}
                            />
                          </div>
                        </article>
                      </GlowBorderCard>

                      <article className="rounded-2xl border border-border p-5">
                        <div className="flex items-center gap-2">
                          <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
                          <h3 className="type-body font-medium">Plan management</h3>
                        </div>
                        <p className="mt-3 type-meta leading-relaxed text-muted-foreground">
                          There is no self-serve upgrade yet — plan changes are made by the platform
                          administrator. Contact support to change tiers.
                        </p>
                        <ContactSupportButton
                          context="Plan and billing support"
                          className="mt-5 min-h-11 w-full rounded-xl"
                        />
                      </article>

                      <AiBudgetCard />
                    </div>

                    <div className="mt-5 rounded-2xl border border-border p-5">
                      <h3 className="type-body font-medium">Team</h3>
                      <p className="mt-1 type-meta text-muted-foreground">
                        Everyone with access to this workspace.
                      </p>

                      <ul className="mt-4 divide-y divide-border">
                        {workspaceOverview.data.members.map((member) => (
                          <li
                            key={member.userId}
                            className="flex items-center justify-between gap-3 py-3"
                          >
                            <div className="min-w-0">
                              <AnimatedTooltip
                                variant="sadoc"
                                className="block max-w-full truncate type-body font-medium"
                                content={
                                  <span className="capitalize">
                                    {member.role} · joined{" "}
                                    {new Date(member.joinedAt).toLocaleDateString("en-KE", {
                                      dateStyle: "medium",
                                    })}
                                  </span>
                                }
                              >
                                {member.fullName || member.email}
                              </AnimatedTooltip>
                              <p className="truncate type-meta text-muted-foreground">
                                {member.email}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="rounded-full bg-muted px-2.5 py-1 type-meta font-medium capitalize text-muted-foreground">
                                {member.role}
                              </span>
                              {workspaceOverview.data?.callerRole === "owner" &&
                              member.userId !== profile?.id ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  aria-label={`Remove ${member.email}`}
                                  disabled={removeMutation.isPending}
                                  onClick={() => removeMutation.mutate(member.userId)}
                                >
                                  <UserMinus className="size-4" />
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>

                      {workspaceOverview.data.callerRole === "owner" ||
                      workspaceOverview.data.callerRole === "admin" ? (
                        <form
                          className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!inviteEmail.trim()) return;
                            inviteMutation.mutate();
                          }}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <Label htmlFor="invite-email">Add a member by email</Label>
                            <Input
                              id="invite-email"
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="teammate@example.com"
                              className="h-11 rounded-xl"
                            />
                            <p className="type-meta text-muted-foreground">
                              They need an existing account. There is no email invite yet.
                            </p>
                          </div>
                          <select
                            aria-label="Role"
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                            className="h-11 rounded-xl border border-input bg-background px-3 type-meta capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                          <RadialGlowButton
                            type="submit"
                            disabled={inviteMutation.isPending || !inviteEmail.trim()}
                          >
                            {inviteMutation.isPending ? "Adding…" : "Add"}
                          </RadialGlowButton>
                        </form>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="mt-5 type-body text-muted-foreground">
                    Plan and usage details could not be loaded.
                  </p>
                )}
              </section>

              <section
                id="security-panel"
                role="tabpanel"
                aria-labelledby="security-tab"
                className="mt-3 rounded-[18px] border border-border bg-card p-5 shadow-sm sm:p-7"
              >
                <PanelHeader
                  title="Access & security"
                  description="Your sign-in method and workspace access are managed centrally."
                />

                <div className="mt-5 flex gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="type-body font-medium">Workspace-managed account</h3>
                    <p className="mt-1 type-meta leading-relaxed opacity-80">
                      Contact the {workspaceName} workspace administrator to change your email,
                      password or access level.
                    </p>
                  </div>
                </div>

                <div className="mt-5 divide-y divide-border">
                  <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="type-body font-medium">Help Centre</h3>
                      <p className="mt-1 type-meta text-muted-foreground">
                        Find answers about access and workspace permissions, or contact support.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" className="min-h-11 gap-2 rounded-xl">
                        <a href="/help">
                          <CircleHelp className="size-4" aria-hidden="true" />
                          Open help
                        </a>
                      </Button>
                      <ContactSupportButton
                        context="Profile support"
                        className="min-h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="type-body font-medium">Sign out</h3>
                      <p className="mt-1 type-meta text-muted-foreground">
                        End this session on the current device.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSignOut}
                      className="min-h-11 gap-2 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                      Log out
                    </Button>
                  </div>
                </div>
              </section>
            </TransitionPanel>
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

/**
 * Shows what this workspace is set up to listen for, and lets anyone finish
 * or change it without hunting for the one-time guided flow.
 */
function MonitoringSetupCard() {
  const fetchStatus = useServerFn(getSetupStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => fetchStatus(),
  });

  if (isLoading || !data) return null;

  const keywords = data.keywords ?? [];
  const incomplete = data.needsSetup || keywords.length === 0 || !data.brandName;

  return (
    <section
      aria-label="Monitoring setup"
      className="mb-5 rounded-[18px] border border-border bg-card p-5 shadow-sm sm:p-7"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 type-card font-semibold">
            <Target className="size-4 text-primary" aria-hidden="true" /> Workspace &amp; monitoring
          </h2>
          <p className="mt-1 type-body text-muted-foreground">
            {incomplete
              ? "Tell us who you speak for and which words to watch so mentions and alerts are relevant."
              : "What this workspace listens for. You can change this at any time."}
          </p>
        </div>
        <Button asChild className="min-h-11 shrink-0 rounded-xl px-5">
          <Link to="/setup" search={{ edit: true }}>
            {incomplete ? "Set up monitoring" : "Edit setup"}
          </Link>
        </Button>
      </div>

      {incomplete ? null : (
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="type-meta text-muted-foreground">Organisation</dt>
            <dd className="mt-1 type-body font-medium">
              {data.brandName || "Not set"}
              {data.brandHandle ? (
                <span className="text-muted-foreground"> @{data.brandHandle}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="type-meta text-muted-foreground">People tracked</dt>
            <dd className="mt-1 type-body font-medium">
              {data.keyFigures.length ? data.keyFigures.join(", ") : "None"}
            </dd>
          </div>
          <div>
            <dt className="type-meta text-muted-foreground">Words watched</dt>
            <dd className="mt-1 type-body font-medium">{keywords.length}</dd>
          </div>
          {keywords.length ? (
            <div className="sm:col-span-3">
              <dt className="sr-only">Keywords</dt>
              <dd className="flex flex-wrap gap-1.5">
                {keywords.slice(0, 12).map((term) => (
                  <span
                    key={term}
                    className="rounded-full bg-muted px-2.5 py-1 type-meta text-muted-foreground"
                  >
                    {term}
                  </span>
                ))}
                {keywords.length > 12 ? (
                  <span className="type-meta text-muted-foreground">
                    +{keywords.length - 12} more
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}

function PanelHeader({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-border pb-5", className)}>
      <h2 className="type-card font-semibold">{title}</h2>
      <p className="mt-1 type-body text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * Real completion score for the signed-in person's profile + workspace
 * setup, built from the same fields already shown on this page (own name,
 * and the setup answers `MonitoringSetupCard` displays) — no fabricated
 * fields. Weights sum to 100.
 */
const COMPLETION_WEIGHTS = [
  { key: "fullName", label: "Display name", weight: 15 },
  { key: "jobTitle", label: "Job title", weight: 15 },
  { key: "phone", label: "Phone number", weight: 15 },
  { key: "team", label: "Team", weight: 10 },
  { key: "brandName", label: "Organisation name", weight: 15 },
  { key: "keyFigures", label: "Key people tracked", weight: 15 },
  { key: "keywords", label: "Keywords tracked", weight: 15 },
] as const;

function ProfileCompletionCard({
  profile,
  setup,
}: {
  profile: { fullName: string } | undefined;
  setup: SetupStatus | undefined;
}) {
  if (!setup) {
    return (
      <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="h-56 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
      </div>
    );
  }

  const items = COMPLETION_WEIGHTS.map((item) => {
    const done =
      item.key === "fullName"
        ? Boolean(profile?.fullName?.trim())
        : item.key === "keyFigures"
          ? setup.keyFigures.length > 0
          : item.key === "keywords"
            ? setup.keywords.length > 0
            : Boolean(
                String(setup[item.key as "jobTitle" | "phone" | "team" | "brandName"] ?? "").trim(),
              );
    return { ...item, done };
  });

  const percent = items.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0);
  const size = 104;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="type-card font-semibold">Complete your profile</h2>
      <p className="mt-1 type-meta text-muted-foreground">
        Based on the details you&apos;ve added to your account and workspace setup.
      </p>

      <div className="mt-5 flex justify-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={stroke}
              className="fill-none stroke-muted"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="fill-none stroke-primary transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="type-card font-semibold">{percent}%</span>
          </div>
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 type-meta text-foreground">
              {item.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-positive" aria-hidden="true" />
              ) : (
                <XCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 type-meta font-medium text-muted-foreground">
              +{item.weight}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UsageStat({
  icon,
  label,
  used,
  limit,
}: {
  icon: ReactNode;
  label: string;
  used: number;
  limit: number;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const near = pct >= 90;
  return (
    <div className="rounded-xl border border-border/70 bg-background p-3">
      <div className="flex items-center gap-2">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
          aria-hidden
        >
          {icon}
        </span>
        <p className="min-w-0 truncate type-meta font-semibold text-foreground">{label}</p>
      </div>
      <p className="mt-2 type-body font-semibold">
        {used.toLocaleString()}
        <span className="type-meta font-normal text-muted-foreground">
          {" "}
          / {limit.toLocaleString()}
        </span>
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", near ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="my-7 animate-pulse space-y-6" aria-hidden="true">
      <div className="flex items-center gap-4">
        <div className="size-16 shrink-0 rounded-full bg-muted" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-3 w-56 rounded bg-muted" />
          <div className="h-3 w-32 rounded bg-muted" />
        </div>
      </div>
      <div className="h-11 rounded-2xl bg-muted" />
      <div className="h-64 rounded-[18px] bg-muted" />
    </div>
  );
}
