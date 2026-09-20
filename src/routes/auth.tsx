import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in - SMAIT" },
      {
        name: "description",
        content:
          "Sign in to SMAIT, the workspace for testing messages against 100 Kenyan personas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Sign in - SMAIT" },
      {
        property: "og:description",
        content: "SMAIT message-testing workspace.",
      },
    ],
    links: [{ rel: "canonical", href: "https://smait.lovable.app/auth" }],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const raw = s["next"];
    const safe =
      typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;
    return safe ? { next: safe } : {};
  },
  component: AuthPage,
});

const SOFTWARE_APPLICATION_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SMAIT",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Test messages against personas with AI analysis, visualize reactions, and get personalized recommendations.",
  url: "https://smait.lovable.app/auth",
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [resetSent, setResetSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  // Phone-only entry gate: a full "Welcome to SMAIT" screen before the form,
  // matching the reference's onboarding flow. Irrelevant at lg+, where the
  // split-screen layout always shows the form directly.
  const [mobileStep, setMobileStep] = useState<"welcome" | "form">("welcome");

  function proceed() {
    if (next) window.location.replace(next);
    else navigate({ to: "/setup", replace: true });
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      // A session can exist at aal1 while MFA is still outstanding - only
      // navigate away once the session has actually cleared that step.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const factor = factors?.totp[0];
        if (factor) setMfaFactorId(factor.id);
        return;
      }
      proceed();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saved =
      window.localStorage.getItem("smait-email") ??
      window.localStorage.getItem("fkf-commsiq-email");
    if (saved) setEmail(saved);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) {
      setBusy(false);
      toast.error("Those sign-in details didn't match. Check them and try again.");
      return;
    }
    if (remember) window.localStorage.setItem("smait-email", cleanEmail);
    else window.localStorage.removeItem("smait-email");

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setBusy(false);
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp[0];
      if (factor) {
        setMfaFactorId(factor.id);
        return;
      }
    }
    proceed();
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Those two passwords don't match. Please retype them.");
      return;
    }
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("already registered") ||
          error.message.toLowerCase().includes("already exists")
          ? "An account with that email already exists. Try signing in instead."
          : "Could not create your account. Check your details and try again.",
      );
      return;
    }
    window.localStorage.setItem("smait-email", cleanEmail);
    if (data.session) {
      proceed();
      return;
    }
    // Email confirmation is required before a session exists.
    setAwaitingConfirmation(true);
  }

  async function onRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error("We couldn't send that reset link just now. Try again in a moment.");
      return;
    }
    setResetSent(true);
  }

  async function onVerifyMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId) return;
    setBusy(true);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: mfaFactorId,
    });
    if (challengeError) {
      setBusy(false);
      toast.error("Could not start the verification check. Try again.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    });
    setBusy(false);
    if (verifyError) {
      toast.error("That code didn't match. Check your authenticator app and try again.");
      setMfaCode("");
      return;
    }
    proceed();
  }

  async function onCancelMfa() {
    await supabase.auth.signOut();
    setMfaFactorId(null);
    setMfaCode("");
    setPassword("");
  }

  const cardCopy = mfaFactorId
    ? { title: "Verify it's you", subtitle: "Enter the code from your authenticator app." }
    : awaitingConfirmation
      ? { title: "Check your inbox", subtitle: "Confirm your address to finish setting up." }
      : mode === "forgot"
        ? { title: "Reset your password", subtitle: "We'll email you a link to choose a new one." }
        : mode === "signup"
          ? { title: "Create your workspace", subtitle: "Set up SMAIT for your team in a minute." }
          : { title: "Welcome back", subtitle: "Sign in to your SMAIT workspace." };

  return (
    <div className="flex min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: SOFTWARE_APPLICATION_JSON_LD }}
      />

      {/* Decorative brand panel - hidden below lg, where the card carries the branding instead. */}
      <div className="relative hidden w-full max-w-xl shrink-0 overflow-hidden bg-gradient-to-br from-primary via-primary to-brand-navy p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-brand-navy/40 blur-3xl"
        />

        <Link to="/" className="relative block" aria-label="SMAIT home">
          <img src="/smait-logo.svg" alt="SMAIT" className="h-7 w-auto brightness-0 invert" />
        </Link>

        <div className="relative max-w-md">
          <h1 className="type-title text-4xl leading-tight text-white lg:text-5xl">
            Stay ahead of the conversation.
          </h1>
          <p className="mt-4 type-body text-primary-foreground/85">
            Monitoring, message testing and campaign operations for your organisation, all in one
            authenticated workspace.
          </p>
        </div>

        <p className="relative type-meta text-primary-foreground/60">
          Communications Intelligence Platform
        </p>
      </div>

      {/* Phone-only welcome gate: shown before the form, matching the reference's onboarding flow. */}
      {mobileStep === "welcome" ? (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-8 py-10 text-center lg:hidden">
          <img src="/smait-logo.svg" alt="SMAIT" className="h-10 w-auto" />
          <h1 className="type-title mt-8 text-3xl">
            Welcome to <span className="text-primary">SMAIT</span>
          </h1>
          <p className="mt-3 max-w-xs type-body text-muted-foreground">
            Communications intelligence and campaign operations for your organisation.
          </p>
          <Button
            className="mt-10 h-12 w-full max-w-xs rounded-full"
            onClick={() => setMobileStep("form")}
          >
            Get started
          </Button>
        </div>
      ) : null}

      {/* Form panel - the card overlaps the boundary on large screens, echoing the reference. */}
      <div
        className={`flex-1 items-center justify-center px-4 py-10 lg:-ml-14 lg:flex ${
          mobileStep === "welcome" ? "hidden" : "flex"
        }`}
      >
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-xl lg:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]">
          <div className="flex justify-center lg:hidden">
            <img src="/smait-logo.svg" alt="SMAIT" className="h-9 w-auto" />
          </div>

          <div className="text-center lg:text-left">
            <p className="type-section mt-6 lg:mt-0">{cardCopy.title}</p>
            <p className="type-meta mt-1 text-muted-foreground">{cardCopy.subtitle}</p>
          </div>

          {mfaFactorId ? (
            <form onSubmit={onVerifyMfa} className="mt-8 space-y-4">
              <div className="space-y-1">
                <Label htmlFor="mfa-code">Authentication code</Label>
                <Input
                  id="mfa-code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  className="h-11"
                />
                <p className="type-meta text-muted-foreground">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>
              <Button
                type="submit"
                className="h-11 w-full"
                disabled={busy || mfaCode.trim().length !== 6}
              >
                Verify
              </Button>
              <button
                type="button"
                onClick={onCancelMfa}
                className="w-full type-meta font-medium text-muted-foreground hover:underline"
              >
                Use a different account
              </button>
            </form>
          ) : awaitingConfirmation ? (
            <div className="mt-8 space-y-4 text-center">
              <p className="type-meta text-foreground">
                We sent a confirmation link to <span className="font-medium">{email}</span>.
              </p>
              <p className="type-meta text-muted-foreground">
                Open it to finish creating your workspace, then come back and sign in.
              </p>
              <button
                type="button"
                onClick={() => {
                  setAwaitingConfirmation(false);
                  setMode("signin");
                  setPassword("");
                }}
                className="type-meta font-medium text-primary hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : mode === "forgot" ? (
            <form onSubmit={onRequestReset} className="mt-8 space-y-4">
              {resetSent ? (
                <div className="space-y-4 text-center">
                  <p className="type-meta text-foreground">
                    If an account exists for <span className="font-medium">{email}</span>, a reset
                    link is on its way.
                  </p>
                  <p className="type-meta text-muted-foreground">
                    Open the link to choose a new password. It expires after a short while.
                  </p>
                </div>
              ) : (
                <>
                  <p className="type-meta text-muted-foreground">
                    Enter your email address and we'll send you a link to set a new password.
                  </p>
                  <div className="space-y-1">
                    <Label htmlFor="reset-email">Email address</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@yourorganisation.org"
                        className="h-11 pl-9"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="h-11 w-full" disabled={busy}>
                    Send reset link
                  </Button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setResetSent(false);
                }}
                className="w-full type-meta font-medium text-primary hover:underline"
              >
                Back to sign in
              </button>
            </form>
          ) : mode === "signup" ? (
            <form onSubmit={onSignUp} className="mt-8 space-y-4">
              <div className="space-y-1">
                <Label htmlFor="full-name">Full name</Label>
                <Input
                  id="full-name"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="h-11"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="signup-email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourorganisation.org"
                    className="h-11 pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 px-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="type-meta text-muted-foreground">At least 8 characters.</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 px-9"
                  />
                </div>
                {confirmPassword.length > 0 && confirmPassword !== password ? (
                  <p className="type-meta text-destructive">Both passwords must match.</p>
                ) : null}
              </div>

              <Button type="submit" className="h-11 w-full" disabled={busy}>
                Create your workspace
              </Button>

              <p className="text-center type-meta text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@yourorganisation.org"
                    className="h-11 pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 px-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 type-meta text-muted-foreground">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(v) => setRemember(v === true)}
                    aria-label="Remember me"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="type-meta font-medium text-primary hover:underline"
                  onClick={() => {
                    setResetSent(false);
                    setMode("forgot");
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" className="h-11 w-full" disabled={busy}>
                Sign in
              </Button>

              <p className="text-center type-meta text-muted-foreground">
                New here?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-medium text-primary hover:underline"
                >
                  Create your workspace
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
