import { useCallback, useEffect, useRef, useState } from "react";
import { focusManager, onlineManager, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const IDLE_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * Pauses all background data fetching (monitoring, refreshes) after 30 minutes of
 * inactivity so the workspace stops spending credits while nobody is using it.
 * Server-side queued campaigns keep running — only browser polling is paused.
 */
export function IdleSessionGuard() {
  const [idle, setIdle] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pause = useCallback(() => {
    setIdle(true);
    focusManager.setFocused(false);
    onlineManager.setOnline(false);
  }, []);

  const resume = useCallback(() => {
    setIdle(false);
    onlineManager.setOnline(true);
    focusManager.setFocused(undefined);
  }, []);

  useEffect(() => {
    if (idle) return;
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(pause, IDLE_MS);
    };
    reset();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, reset);
    };
  }, [idle, pause]);

  async function handleSignOut() {
    resume();
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AlertDialog open={idle}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Still here?</AlertDialogTitle>
          <AlertDialogDescription>
            You've been inactive for a little while. Would you like to keep this session open?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleSignOut}>
            Sign out
          </Button>
          <Button onClick={resume}>Keep working</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
