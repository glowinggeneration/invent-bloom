import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import AnimatedButton from "@/components/vengeance/animated-button";
import { PopButton } from "@/components/vengeance/pop-button";
import StaggerText from "@/components/vengeance/stagger-text";
import { KineticTextLoader } from "@/components/vengeance/kinetic-text-loader";
import { getSetupStatus, saveSetup, skipSetup } from "@/lib/onboarding.functions";
import { EMPTY_SOCIALS, SOCIAL_FIELDS, cleanHandle, type SetupSocials } from "@/lib/onboarding";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Set up your profile - SMAIT" },
      {
        name: "description",
        content:
          "Tell SMAIT who you are and what to monitor so mentions, alerts and reports are relevant from day one.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Set up your profile - SMAIT" },
      {
        property: "og:description",
        content: "A short guided setup that tells the platform what to listen for.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { edit?: boolean } =>
    s["edit"] ? { edit: true } : {},
  component: SetupPage,
});

const STEPS = [
  { id: "you", label: "About you", description: "Name and role" },
  { id: "brand", label: "Organisation", description: "Who you speak for" },
  { id: "monitor", label: "Monitoring", description: "Required" },
  { id: "channels", label: "Other channels", description: "Optional" },
];

function SetupPage() {
  const navigate = useNavigate();
  const { edit } = Route.useSearch();
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getSetupStatus);
  const save = useServerFn(saveSetup);
  const skip = useServerFn(skipSetup);

  const { data: status, isLoading } = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => fetchStatus(),
    staleTime: 0,
  });

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [team, setTeam] = useState("");
  const [phone, setPhone] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandHandle, setBrandHandle] = useState("");
  const [keyFigures, setKeyFigures] = useState<string[]>([]);
  const [keyFigureDraft, setKeyFigureDraft] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [socials, setSocials] = useState<SetupSocials>(EMPTY_SOCIALS);

  useEffect(() => {
    if (!status) return;
    if (!status.needsSetup && !edit) {
      navigate({ to: "/mentions", replace: true });
      return;
    }
    setFullName(status.fullName);
    setJobTitle(status.jobTitle);
    setTeam(status.team);
    setPhone(status.phone);
    setBrandName(status.brandName);
    setBrandHandle(status.brandHandle);
    setKeyFigures(status.keyFigures);
    setKeywords(status.keywords);
    setSocials(status.socials);
  }, [status, navigate, edit]);

  const finish = useMutation({
    mutationFn: () =>
      save({
        data: {
          fullName,
          jobTitle,
          team,
          phone,
          brandName,
          brandHandle,
          keyFigures,
          keywords,
          socials,
        },
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["setup-status"] });
      toast.success(
        result.keywordsAdded
          ? `Setup saved — ${result.keywordsAdded} new monitoring term${result.keywordsAdded === 1 ? "" : "s"} added.`
          : "Setup saved.",
      );
      navigate({ to: "/mentions", replace: true });
    },
    onError: (e: Error) => toast.error(friendlyError(e, { action: "save your setup" })),
  });

  const skipAll = useMutation({
    mutationFn: () => skip(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["setup-status"] });
      navigate({ to: "/mentions", replace: true });
    },
    onError: (e: Error) => toast.error(friendlyError(e, { action: "skip setup" })),
  });

  function addKeyword(raw?: string) {
    const term = (raw ?? keywordDraft).trim();
    if (term.length < 2) return;
    setKeywords((list) =>
      list.some((k) => k.toLowerCase() === term.toLowerCase()) ? list : [...list, term],
    );
    setKeywordDraft("");
  }

  function addKeyFigure(raw?: string) {
    const name = (raw ?? keyFigureDraft).trim();
    if (name.length < 2 || keyFigures.length >= 10) return;
    setKeyFigures((list) =>
      list.some((k) => k.toLowerCase() === name.toLowerCase()) ? list : [...list, name],
    );
    setKeyFigureDraft("");
  }

  const canContinue = useMemo(() => {
    if (step === 0) return fullName.trim().length > 0;
    if (step === 2) return keywords.length > 0;
    return true;
  }, [step, fullName, keywords.length]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <KineticTextLoader />
      </div>
    );
  }

  const active = STEPS[step]!;

  return (
    <div className="min-h-screen bg-muted/40 p-4 sm:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xl lg:min-h-[calc(100vh-4rem)] lg:flex-row">
        {/* Step rail */}
        <aside className="shrink-0 border-b border-border bg-muted/50 p-6 lg:w-72 lg:border-b-0 lg:border-r">
          <img src="/smait-logo.svg" alt="SMAIT logo" className="h-7 w-auto" />
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Setup steps
          </p>
          <nav className="mt-4">
            <ol className="space-y-1">
              {STEPS.map((s, i) => {
                const done = i < step;
                const current = i === step;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setStep(i)}
                      aria-current={current ? "step" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                        current ? "bg-card shadow-sm" : "hover:bg-card/60",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                          done && "bg-emerald-500 text-white",
                          current && "bg-primary text-primary-foreground",
                          !done && !current && "bg-border/60 text-muted-foreground",
                        )}
                      >
                        {done ? <Check className="size-3.5" /> : i + 1}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 text-sm font-medium",
                          current ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {s.label}
                      </span>
                      {current && (
                        <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>

        {/* Step content */}
        <div className="flex min-w-0 flex-1 flex-col p-6 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <span className="grid size-14 place-items-center rounded-full bg-foreground text-lg font-semibold text-background">
              {step + 1}
            </span>
            <h1 className="type-section mt-4">
              <StaggerText key={active.id}>{active.label}</StaggerText>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{active.description}</p>
          </div>

          <div className="mx-auto mt-8 w-full max-w-xl space-y-4">
            {step === 0 && (
              <>
                <Field label="Full name" required>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </Field>
                <Field label="Job title" hint="Optional">
                  <Input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Communications Manager"
                  />
                </Field>
                <Field label="Team or department" hint="Optional">
                  <Input
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder="Communications"
                  />
                </Field>
                <Field label="Phone" hint="Optional — used for urgent alerts only">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254…"
                  />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <Field label="Organisation or brand name" hint="Optional">
                  <Input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Your organisation's name"
                  />
                </Field>
                <Field
                  label="Main X (Twitter) handle"
                  hint="Recommended — the account whose mentions and replies we track"
                >
                  <Input
                    value={brandHandle}
                    onChange={(e) => setBrandHandle(e.target.value)}
                    placeholder="YourOrganisation"
                  />
                </Field>
                <div className="space-y-1.5">
                  <Label>
                    Key people to track <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <p className="type-meta text-muted-foreground">
                    Leadership or spokespeople whose mentions should be tracked separately from the
                    organisation.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={keyFigureDraft}
                      onChange={(e) => setKeyFigureDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addKeyFigure();
                        }
                      }}
                      placeholder="e.g. Jane Doe"
                      aria-label="Add a key figure"
                    />
                    <PopButton
                      type="button"
                      onClick={() => addKeyFigure()}
                      className="!px-4 !py-2 shrink-0 gap-1 normal-case"
                    >
                      <Plus className="size-4" /> Add
                    </PopButton>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keyFigures.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 type-meta font-medium text-primary"
                      >
                        {name}
                        <button
                          type="button"
                          aria-label={`Remove ${name}`}
                          onClick={() => setKeyFigures((l) => l.filter((k) => k !== name))}
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div>
                  <Label>Words and phrases to monitor</Label>
                  <p className="type-meta mt-1 text-muted-foreground">
                    Required. These drive every mention we collect — add the organisation name,
                    nicknames, leaders, competitions and issues people talk about.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={keywordDraft}
                    onChange={(e) => setKeywordDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                    placeholder="e.g. your product name"
                    aria-label="Add a monitoring term"
                  />
                  <PopButton
                    type="button"
                    onClick={() => addKeyword()}
                    className="!px-4 !py-2 shrink-0 gap-1 normal-case"
                  >
                    <Plus className="size-4" /> Add
                  </PopButton>
                </div>
                <div className="flex flex-wrap gap-2">
                  {keywords.length === 0 && (
                    <p className="type-meta text-muted-foreground">No terms yet.</p>
                  )}
                  {keywords.map((term) => (
                    <span
                      key={term}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 type-meta font-medium text-primary"
                    >
                      {term}
                      <button
                        type="button"
                        aria-label={`Remove ${term}`}
                        onClick={() => setKeywords((l) => l.filter((k) => k !== term))}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <>
                <p className="type-meta text-muted-foreground">
                  Optional. Add any official pages you want watched alongside X.
                </p>
                {SOCIAL_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label} hint="Optional">
                    <Input
                      value={socials[field.key]}
                      onChange={(e) => setSocials((s) => ({ ...s, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      onBlur={(e) =>
                        setSocials((s) => ({ ...s, [field.key]: cleanHandle(e.target.value) }))
                      }
                    />
                  </Field>
                ))}
              </>
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                  <ChevronLeft className="size-4" /> Previous
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => skipAll.mutate()}
                disabled={skipAll.isPending || finish.isPending}
              >
                Skip for now
              </Button>
            </div>

            <p className="type-meta hidden text-muted-foreground sm:block">
              Step {step + 1} of {STEPS.length} · {keywords.length} monitoring term
              {keywords.length === 1 ? "" : "s"}
            </p>

            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
                Next <ChevronRight className="size-4" />
              </Button>
            ) : (
              <AnimatedButton
                type="button"
                onClick={() => finish.mutate()}
                disabled={finish.isPending || !fullName.trim() || keywords.length === 0}
              >
                {finish.isPending ? "Saving…" : "Finish setup"}
              </AnimatedButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </Label>
      {children}
      {hint && <p className="type-meta text-muted-foreground">{hint}</p>}
    </div>
  );
}
