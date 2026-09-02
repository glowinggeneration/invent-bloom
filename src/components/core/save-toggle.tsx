"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookmarkCheck, BookmarkPlus, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SaveToggleProps = Omit<ButtonProps, "children" | "onClick"> & {
  saved: boolean;
  onToggle: () => void | Promise<void>;
  saveLabel?: string;
  savedLabel?: string;
};

/** Save control whose visual state is driven by the caller's persisted state. */
export function SaveToggle({
  saved,
  onToggle,
  saveLabel = "Save",
  savedLabel = "Saved",
  className,
  disabled,
  ...props
}: SaveToggleProps) {
  const [pending, setPending] = useState(false);
  const reduceMotion = useReducedMotion();

  const handleToggle = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onToggle();
    } finally {
      setPending(false);
    }
  };

  const Icon = pending ? Loader2 : saved ? BookmarkCheck : BookmarkPlus;
  const label = saved ? savedLabel : saveLabel;

  return (
    <Button
      type="button"
      variant={saved ? "secondary" : "default"}
      aria-pressed={saved}
      disabled={disabled || pending}
      className={cn("min-w-[6.5rem] gap-2 overflow-hidden", className)}
      onClick={handleToggle}
      {...props}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={`${saved}-${pending}`}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          {...(reduceMotion ? {} : { exit: { opacity: 0, scale: 0.7 } })}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 30 }
          }
          className="inline-flex items-center gap-2"
        >
          <Icon className={cn("size-4", pending && "animate-spin")} aria-hidden="true" />
          <span>{pending ? "Saving" : label}</span>
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
