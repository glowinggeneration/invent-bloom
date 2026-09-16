import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password - SMAIT" },
      {
        name: "description",
        content: "Choose a new password for your SMAIT workspace account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Set a new password - SMAIT" },
      {
        property: "og:description",
        content: "Choose a new password for your SMAIT workspace account.",
      },
    ],
    links: [{ rel: "canonical", href: "https://smait.lovable.app/reset-password" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let settled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        settled = true;
        setReady(true);
      }
    });
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        settled = true;
        setReady(true);
        return;
      }
      window.setTimeout(() => {
        if (!settled) setInvalid(true);
      }, 1500);
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Those two passwords don't match. Please retype them.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("We couldn't update your password. Request a new link and try again.");
      return;
    }
    setDone(true);
    toast.success("Your password has been updated.");
    window.setTimeout(() => navigate({ to: "/auth", replace: true }), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <img src="/smait-logo.svg" alt="SMAIT logo" className="h-10 w-auto" />
          <h1 className="type-section mt-4">Set a new password</h1>
        </div>

        {done ? (
          <p className="mt-8 text-center type-meta text-muted-foreground">
            Password updated. Taking you back to sign in…
          </p>
        ) : invalid && !ready ? (
          <div className="mt-8 space-y-4 text-center">
            <p className="type-meta text-foreground">
              This reset link is no longer valid or has already been used.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/auth" })}
              className="type-meta font-medium text-positive hover:underline"
            >
              Request a new link
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="new-password"
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
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm-new-password"
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

            <Button type="submit" className="h-11 w-full" disabled={busy || !ready}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
