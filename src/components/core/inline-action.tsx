"use client";
/** Pill control with an inline idle → loading → success sequence for a single async action. */
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type InlineActionProps = {
  label: string;
  icon: ReactNode;
  actionText: string;
  onAction: () => Promise<void>;
  className?: string;
};

export function InlineAction({ label, icon, actionText, onAction, className }: InlineActionProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const reduceMotion = useReducedMotion();

  const handleTrigger = async () => {
    if (status !== "idle") return;
    setStatus("loading");
    try {
      await onAction();
      setStatus("success");
    } catch {
      setStatus("idle");
    }
  };

  useEffect(() => {
    if (status !== "success") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  const springTransition: Transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 400, damping: 35, mass: 1 };

  return (
    <div
      className={cn(
        "flex w-full max-w-sm items-center justify-between rounded-full border border-border bg-card p-3 shadow-sm",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex shrink-0 items-center justify-center rounded-full bg-muted p-2.5 text-foreground"
          aria-hidden="true"
        >
          {icon}
        </div>
        <span className="truncate text-sm font-semibold text-foreground">{label}</span>
      </div>
      <MotionConfig transition={springTransition}>
        <motion.div
          className="relative flex h-10 items-center overflow-hidden rounded-full bg-muted px-2"
          animate={{ width: status === "success" ? 40 : 112 }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {status === "idle" ? (
              <motion.button
                key="idle"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleTrigger}
                className="w-full whitespace-nowrap rounded-full text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {actionText}
              </motion.button>
            ) : null}

            {status === "loading" ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full"
                role="status"
                aria-live="polite"
                aria-label={`${actionText} in progress`}
              >
                <div className="relative h-1.5 flex-1 rounded-full bg-border">
                  <motion.div
                    className="absolute inset-y-0 w-[30%] rounded-full bg-primary"
                    initial={{ left: "0%" }}
                    animate={{ left: "70%" }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut",
                    }}
                  />
                </div>
              </motion.div>
            ) : null}

            {status === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full w-full items-center justify-center rounded-full bg-primary"
                role="status"
                aria-live="polite"
              >
                <Check className="size-5 stroke-2 text-primary-foreground" aria-hidden="true" />
                <span className="sr-only">Done</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </MotionConfig>
    </div>
  );
}
