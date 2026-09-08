import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { friendlyError } from "@/lib/friendly-errors";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui-kit";

/**
 * TOTP enrollment lives entirely in Supabase Auth's own MFA API - this
 * component only calls it, it never sees or stores a secret itself. Losing
 * the authenticator device means recovering access from the Supabase
 * dashboard directly (removing the factor there), not through this app -
 * there is no in-app recovery-code flow.
 */
export function AdminMfaCard() {
  const queryClient = useQueryClient();
  const [enrolling, setEnrolling] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");

  const factors = useQuery({
    queryKey: ["admin", "mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.totp;
    },
  });

  const startEnroll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const confirmEnroll = useMutation({
    mutationFn: async () => {
      if (!enrolling) throw new Error("Start enrollment first.");
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrolling.factorId,
      });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw verifyError;
    },
    onSuccess: () => {
      toast.success("Two-factor authentication is on.");
      setEnrolling(null);
      setCode("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "mfa-factors"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const cancelEnroll = useMutation({
    mutationFn: async () => {
      if (!enrolling) return;
      const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
      if (error) throw error;
    },
    onSuccess: () => {
      setEnrolling(null);
      setCode("");
    },
  });

  const disable = useMutation({
    mutationFn: async (factorId: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Two-factor authentication is off.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "mfa-factors"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const verifiedFactor = factors.data?.[0] ?? null;

  return (
    <Card>
      <h2 className="flex items-center gap-2 type-card font-semibold">
        <ShieldCheck className="size-4 text-primary" /> Two-factor authentication
      </h2>
      <p className="mt-2 type-meta text-muted-foreground">
        Require a code from an authenticator app on top of your password when signing in.
      </p>

      {!factors.isLoading && verifiedFactor && !enrolling ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-positive/30 bg-positive/5 p-3">
          <span className="flex items-center gap-2 type-meta font-semibold text-positive">
            <ShieldCheck className="size-4" /> Enabled
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => disable.mutate(verifiedFactor.id)}
            disabled={disable.isPending}
          >
            <ShieldOff className="size-4" /> Turn off
          </Button>
        </div>
      ) : null}

      {!factors.isLoading && !verifiedFactor && !enrolling ? (
        <div className="mt-4">
          <Button onClick={() => startEnroll.mutate()} disabled={startEnroll.isPending}>
            Turn on two-factor authentication
          </Button>
        </div>
      ) : null}

      {enrolling ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
          <p className="type-meta">
            Scan this code with your authenticator app, then enter the 6-digit code it shows.
          </p>
          <img
            src={enrolling.qrCode}
            alt="Two-factor authentication QR code"
            className="h-40 w-40 rounded-md border border-border bg-white p-2"
          />
          <p className="type-meta text-muted-foreground">
            Can't scan it? Enter this key manually:{" "}
            <code className="rounded bg-muted px-1 py-0.5">{enrolling.secret}</code>
          </p>
          <div>
            <Label htmlFor="mfa-code">6-digit code</Label>
            <Input
              id="mfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => confirmEnroll.mutate()}
              disabled={code.trim().length !== 6 || confirmEnroll.isPending}
            >
              Verify & enable
            </Button>
            <Button
              variant="outline"
              onClick={() => cancelEnroll.mutate()}
              disabled={cancelEnroll.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <p className="mt-4 type-meta text-muted-foreground">
        Lost your authenticator? Two-factor authentication can only be removed from the Supabase
        dashboard for this project, not from within SMAIT.
      </p>
    </Card>
  );
}
