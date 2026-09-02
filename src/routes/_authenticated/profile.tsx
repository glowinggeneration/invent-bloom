import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Building2,
  CircleHelp,
  CreditCard,
  FileDown,
  LogOut,
  Megaphone,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";

import { AvatarLabelGroup } from "@/components/base/avatar/avatar-label-group";
import { AnimatedBackground } from "@/components/core/animated-background";
import { TransitionPanel } from "@/components/core/transition-panel";
import { ContactSupportButton } from "@/components/contact-support";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { friendlyError } from "@/lib/friendly-errors";
import { resetFirstRun } from "@/lib/first-run";
import { recordTipReset, setTipEnabled, useTipPrefs } from "@/lib/tip-prefs";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { updateProfileName } from "@/lib/smait.functions";
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
      { title: "Profile & settings - CommsIQ" },
      { name: "description", content: "Manage how you appear and work across Persona_Voices." },
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

  const relationshipLabel = profile?.org === "fkf" ? "FKF workspace" : "External collaborator";
  const workspaceName = profile?.org === "fkf" ? "Football Kenya Federation" : "External";

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
                className="mt-3 rounded-[18px] border border-border bg-card p-5 shadow-sm sm:p-7"
              >
                <PanelHeader
                  title="Personal information"
                  description="Used on campaigns, shared work and workspace activity."
                />

                <form className="grid gap-5 pt-5" onSubmit={handleSave}>
                  <div className="grid gap-2">
                    <Label htmlFor="display-name">Display name</Label>
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

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
                  <article className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="type-meta font-semibold uppercase tracking-[0.08em] text-primary">
                          Current plan
                        </p>
                        <h3 className="mt-1 type-card font-semibold">Workspace</h3>
                        <p className="mt-1 type-meta text-muted-foreground">
                          Managed centrally for the {workspaceName} workspace.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 type-meta font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <BadgeCheck className="size-3.5" aria-hidden="true" /> Active
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <PlanCapability
                        icon={<Sparkles className="size-4" />}
                        title="Intelligence"
                        description="Listening and response tools"
                      />
                      <PlanCapability
                        icon={<Megaphone className="size-4" />}
                        title="Campaigns"
                        description="Guided execution workflows"
                      />
                      <PlanCapability
                        icon={<FileDown className="size-4" />}
                        title="Reporting"
                        description="Reports and exports"
                      />
                    </div>
                  </article>

                  <article className="rounded-2xl border border-border p-5">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
                      <h3 className="type-body font-medium">Plan management</h3>
                    </div>
                    <p className="mt-3 type-meta leading-relaxed text-muted-foreground">
                      Billing, seats and plan changes are controlled by the workspace administrator.
                    </p>
                    <ContactSupportButton
                      context="Plan and billing support"
                      className="mt-5 min-h-11 w-full rounded-xl"
                    />
                  </article>
                </div>
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

function PanelHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-border pb-5">
      <h2 className="type-card font-semibold">{title}</h2>
      <p className="mt-1 type-body text-muted-foreground">{description}</p>
    </div>
  );
}

function PlanCapability({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-3">
      <span
        className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"
        aria-hidden
      >
        {icon}
      </span>
      <p className="mt-3 type-meta font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
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
