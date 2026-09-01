import { useCallback, useEffect, useRef, useState } from "react";
import { focusManager, onlineManager, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { PauseCircle, Play } from "lucide-react";

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
 * Server-side queued campaigns keep running. Only browser polling is paused.
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
    onlineManager.setOnline(navigator.onLine);
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
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md gap-0 overflow-hidden rounded-2xl border-border/80 p-0 shadow-2xl">
        <div className="p-6 sm:p-7">
          <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PauseCircle className="size-5" aria-hidden="true" />
          </div>
          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="type-section">Workspace paused</AlertDialogTitle>
            <AlertDialogDescription className="type-body leading-relaxed">
              Updates paused after 30 minutes of inactivity. Resume to continue receiving new data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="mt-5 rounded-xl bg-muted px-3.5 py-3 type-meta leading-relaxed text-muted-foreground">
            Queued campaigns continue running in the background.
          </p>
        </div>
        <AlertDialogFooter className="gap-2 border-t border-border bg-muted/30 p-4 sm:space-x-0 sm:p-5">
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
          <Button className="gap-2" onClick={resume}>
            <Play className="size-4" aria-hidden="true" /> Resume workspace
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
