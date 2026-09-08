import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: SOFTWARE_APPLICATION_JSON_LD }}
      />
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <img src="/smait-logo.svg" alt="SMAIT logo" className="h-10 w-auto" />
          <p className="type-section mt-4">
            <span className="text-primary">SMAIT</span>
          </p>
          <p className="type-meta mt-1 text-muted-foreground">
            Communications Intelligence Platform
          </p>
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
              {busy ? "Verifying…" : "Verify"}
            </Button>
            <button
              type="button"
              onClick={onCancelMfa}
              className="w-full type-meta font-medium text-muted-foreground hover:underline"
            >
              Use a different account
            </button>
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
                className="type-meta font-medium text-positive hover:underline"
                onClick={() =>
                  toast.info("Password resets are issued by your workspace administrator.")
                }
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
