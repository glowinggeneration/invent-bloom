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
      { title: "Sign in - FKF CommsIQ" },
      {
        name: "description",
        content:
          "Sign in to FKF CommsIQ, the Football Kenya Federation workspace for testing messages against 100 Kenyan personas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Sign in - FKF CommsIQ" },
      {
        property: "og:description",
        content: "Football Kenya Federation message-testing workspace.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const raw = s["next"];
    const safe =
      typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;
    return safe ? { next: safe } : {};
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      if (next) window.location.replace(next);
      else navigate({ to: "/mentions", replace: true });
    });
  }, [navigate, next]);

  useEffect(() => {
    const saved = window.localStorage.getItem("fkf-commsiq-email");
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
    setBusy(false);
    if (error) {
      toast.error("Those sign-in details didn't match. Check them and try again.");
      return;
    }
    if (remember) window.localStorage.setItem("fkf-commsiq-email", cleanEmail);
    else window.localStorage.removeItem("fkf-commsiq-email");
    if (next) window.location.replace(next);
    else navigate({ to: "/mentions", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <img src="/smait-logo.svg" alt="SMAIT logo" className="h-10 w-auto" />
          <p className="type-section mt-4">
            FKF <span className="text-primary">CommsIQ</span>
          </p>
          <p className="type-meta mt-1 text-muted-foreground">
            Communications Intelligence Platform
          </p>
        </div>

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
                placeholder="name@footballkenya.org"
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
              className="type-meta font-medium text-fkf-green hover:underline"
              onClick={() =>
                toast.info("Password resets are issued by the FKF communications administrator.")
              }
            >
              Forgot password?
            </button>
          </div>

          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center type-meta text-muted-foreground">
          Powered by <span className="font-medium text-primary">Persona_Voices</span>
        </p>
      </div>
    </div>
  );
}
