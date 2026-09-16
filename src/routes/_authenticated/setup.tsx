import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft, ChevronRight, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import AnimatedButton from "@/components/vengeance/animated-button";

import StaggerText from "@/components/vengeance/stagger-text";
import { KineticTextLoader } from "@/components/vengeance/kinetic-text-loader";
import { getSetupStatus, saveSetup, skipSetup } from "@/lib/onboarding.functions";
import { EMPTY_SOCIALS, SOCIAL_FIELDS, cleanHandle, type SetupSocials } from "@/lib/onboarding";
import { friendlyError } from "@/lib/friendly-errors";
import { RequestChannelDialog } from "@/components/setup/request-channel-dialog";

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

const JOB_TITLES = [
  "Communications Manager",
  "Communications Officer",
  "Head of Communications",
  "Press Officer",
  "Social Media Manager",
  "Digital Marketing Manager",
  "Marketing Manager",
  "Public Relations Officer",
  "Brand Manager",
  "Content Producer",
  "Media Analyst",
  "Executive / Director",
];

const TEAMS = [
  "Communications",
  "Marketing",
  "Public Relations",
  "Digital / Social Media",
  "Media Monitoring",
  "Brand",
  "Content",
  "Government Relations",
  "Executive Office",
  "Customer Experience",
];

const OTHER = "__other__";

/** Dial codes offered on the phone field; South Africa (+27) is the default. */
const PHONE_COUNTRIES = [
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "KE", name: "Kenya", dial: "+254" },
  { code: "NA", name: "Namibia", dial: "+264" },
  { code: "BW", name: "Botswana", dial: "+267" },
  { code: "ZW", name: "Zimbabwe", dial: "+263" },
  { code: "ZM", name: "Zambia", dial: "+260" },
  { code: "MZ", name: "Mozambique", dial: "+258" },
  { code: "LS", name: "Lesotho", dial: "+266" },
  { code: "SZ", name: "Eswatini", dial: "+268" },
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "GH", name: "Ghana", dial: "+233" },
  { code: "TZ", name: "Tanzania", dial: "+255" },
  { code: "UG", name: "Uganda", dial: "+256" },
  { code: "RW", name: "Rwanda", dial: "+250" },
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "US", name: "United States", dial: "+1" },
] as const;

const DEFAULT_DIAL = "+27";

/** Splits a stored phone like "+27 82 123 4567" into dial code and national part. */
function parsePhone(raw: string): { dial: string; customDial: string; national: string } {
  const value = raw.trim();
  if (!value) return { dial: DEFAULT_DIAL, customDial: "", national: "" };
  const match = value.match(/^(\+\d{1,4})\s*(.*)$/);
  if (match) {
    const known = PHONE_COUNTRIES.some((c) => c.dial === match[1]);
    return known
      ? { dial: match[1]!, customDial: "", national: match[2]! }
      : { dial: OTHER, customDial: match[1]!, national: match[2]! };
  }
  return { dial: DEFAULT_DIAL, customDial: "", national: value };
}

function SelectWithOther({
  options,
  value,
  onChange,
  placeholder,
  otherPlaceholder,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  otherPlaceholder: string;
}) {
  const isListed = options.includes(value);
  const [custom, setCustom] = useState(!isListed && value.length > 0);

  useEffect(() => {
    if (value.length > 0 && !options.includes(value)) setCustom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="space-y-2">
      <Select
        value={custom ? OTHER : isListed ? value : ""}
        onValueChange={(next) => {
          if (next === OTHER) {
            setCustom(true);
            onChange("");
            return;
          }
          setCustom(false);
          onChange(next);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
          <SelectItem value={OTHER}>Other…</SelectItem>
        </SelectContent>
      </Select>
      {custom && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder}
        />
      )}
    </div>
  );
}

const STEPS = [
  { id: "you", label: "About you", description: "Name and role" },
  { id: "brand", label: "Organisation", description: "Who you speak for" },
  { id: "details", label: "Organisation details", description: "Optional" },
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
  const [phoneDial, setPhoneDial] = useState<string>(DEFAULT_DIAL);
  const [phoneCustomDial, setPhoneCustomDial] = useState("");
  const [phoneNational, setPhoneNational] = useState("");
  const [phoneWhatsapp, setPhoneWhatsapp] = useState(false);
  const phone = ((phoneDial === OTHER ? phoneCustomDial : phoneDial) + phoneNational).trim();
  const [brandName, setBrandName] = useState("");
  const [brandHandle, setBrandHandle] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [orgProfilePath, setOrgProfilePath] = useState("");
  const [orgProfileName, setOrgProfileName] = useState("");
  const [uploading, setUploading] = useState(false);
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
    const parsed = parsePhone(status.phone ?? "");
    setPhoneDial(parsed.dial);
    setPhoneCustomDial(parsed.customDial);
    setPhoneNational(parsed.national);
    setPhoneWhatsapp(status.phoneWhatsapp);
    setBrandName(status.brandName);
    setBrandHandle(status.brandHandle);
    setOrgAddress(status.orgAddress);
    setOrgWebsite(status.orgWebsite);
    setOrgDescription(status.orgDescription);
    setOrgProfilePath(status.orgProfilePath);
    setOrgProfileName(status.orgProfileName);
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
          phoneWhatsapp,
          brandName,
          brandHandle,
          orgAddress,
          orgWebsite,
          orgDescription,
          orgProfilePath,
          orgProfileName,
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
    if (step === 3) return keywords.length > 0;
    return true;
  }, [step, fullName, keywords.length]);

  /** Stores the company profile document in the private organisation folder. */
  async function uploadCompanyProfile(file: File) {
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("org-documents").upload(path, file, {
        upsert: true,
        contentType: file.type || "application/octet-stream",
      });
      if (error) throw new Error(error.message);
      setOrgProfilePath(path);
      setOrgProfileName(file.name);
      toast.success("Company profile uploaded.");
    } catch (e) {
      toast.error(friendlyError(e as Error, { action: "upload the company profile" }));
    } finally {
      setUploading(false);
    }
  }

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

          <div className="mx-auto mt-8 w-full max-w-xl space-y-5 pb-10">
            {step === 0 && (
              <>
                <Field label="Full name" required>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </Field>
                <Field label="Job title" hint="Optional">
                  <SelectWithOther
                    options={JOB_TITLES}
                    value={jobTitle}
                    onChange={setJobTitle}
                    placeholder="Select a job title"
                    otherPlaceholder="Enter your job title"
                  />
                </Field>
                <Field label="Team or department" hint="Optional">
                  <SelectWithOther
                    options={TEAMS}
                    value={team}
                    onChange={setTeam}
                    placeholder="Select a team or department"
                    otherPlaceholder="Enter your team or department"
                  />
                </Field>
                <Field label="Phone" hint="Optional — used for urgent alerts only">
                  <div className="flex gap-2">
                    <Select
                      value={phoneDial === OTHER || PHONE_COUNTRIES.every((c) => c.dial !== phoneDial) ? OTHER : phoneDial}
                      onValueChange={(next) => {
                        if (next === OTHER) {
                          setPhoneDial(OTHER);
                          if (!phoneCustomDial) setPhoneCustomDial("");
                          return;
                        }
                        setPhoneDial(next);
                      }}
                    >
                      <SelectTrigger className="w-[150px] shrink-0" aria-label="Country code">
                        {phoneDial !== OTHER && PHONE_COUNTRIES.some((c) => c.dial === phoneDial) ? (
                          <span>{phoneDial}</span>
                        ) : (
                          <SelectValue placeholder="Code" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {PHONE_COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.dial}>
                            {c.name} ({c.dial})
                          </SelectItem>
                        ))}
                        <SelectItem value={OTHER}>Other…</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={phoneNational}
                      onChange={(e) => setPhoneNational(e.target.value)}
                      placeholder="82 123 4567"
                      inputMode="tel"
                    />
                  </div>
                  {phoneDial === OTHER && (
                    <Input
                      value={phoneCustomDial}
                      onChange={(e) => setPhoneCustomDial(e.target.value)}
                      placeholder="+44"
                      className="mt-2"
                      inputMode="tel"
                    />
                  )}
                  <label className="mt-1 flex cursor-pointer items-center gap-2.5">
                    <Checkbox
                      checked={phoneWhatsapp}
                      onCheckedChange={(checked) => setPhoneWhatsapp(checked === true)}
                      aria-label="This number is on WhatsApp"
                    />
                    <span className="text-sm text-muted-foreground">
                      This number is on WhatsApp
                    </span>
                  </label>
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
                  <Input
                    value={keyFigureDraft}
                    onChange={(e) => setKeyFigureDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addKeyFigure();
                      }
                    }}
                    placeholder="e.g. Jane Doe — press Enter to add"
                    aria-label="Add a key figure"
                  />
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
              <>
                <p className="type-meta text-muted-foreground">
                  Optional. These details appear in reports and help drafted replies sound like your
                  organisation.
                </p>
                <Field label="Website" hint="Optional">
                  <Input
                    value={orgWebsite}
                    onChange={(e) => setOrgWebsite(e.target.value)}
                    placeholder="https://www.yourorganisation.org"
                    inputMode="url"
                  />
                </Field>
                <Field label="Address" hint="Optional">
                  <Textarea
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
                    placeholder="Street, city, country"
                    rows={2}
                  />
                </Field>
                <Field label="About the organisation" hint="Optional — a short description">
                  <Textarea
                    value={orgDescription}
                    onChange={(e) => setOrgDescription(e.target.value)}
                    placeholder="What your organisation does, who it serves and the tone it uses."
                    rows={4}
                  />
                </Field>
                <div className="space-y-1.5">
                  <Label>
                    Company profile <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <p className="type-meta text-muted-foreground">
                    Upload a PDF or document with your full company profile (max 20 MB).
                  </p>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4 hover:bg-muted/50">
                    <Upload className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {uploading
                        ? "Uploading…"
                        : orgProfileName || "Choose a file to upload"}
                    </span>
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadCompanyProfile(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {orgProfileName && !uploading && (
                    <button
                      type="button"
                      className="type-meta text-muted-foreground underline"
                      onClick={() => {
                        setOrgProfileName("");
                        setOrgProfilePath("");
                      }}
                    >
                      Remove file
                    </button>
                  )}
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <div>
                  <Label>Words and phrases to monitor</Label>
                  <p className="type-meta mt-1 text-muted-foreground">
                    Required. These drive every mention we collect — add the organisation name,
                    nicknames, leaders, competitions and issues people talk about.
                  </p>
                </div>
                  <Input
                    value={keywordDraft}
                    onChange={(e) => setKeywordDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                    placeholder="e.g. your product name — press Enter to add"
                    aria-label="Add a monitoring term"
                  />
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

            {step === 4 && (
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
                <div className="mt-2 rounded-xl border border-dashed border-border p-5">
                  <p className="type-meta mb-4 text-muted-foreground">
                    Need somewhere else watched? Ask us to add it.
                  </p>
                  <RequestChannelDialog />
                </div>
              </>
            )}
          </div>

          <div className="mx-auto mt-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border pt-6">
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
