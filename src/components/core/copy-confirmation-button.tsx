"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Copy, Loader2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyConfirmationButtonProps = Omit<ButtonProps, "children" | "onClick"> & {
  copy: () => Promise<void>;
  label?: string;
  copiedLabel?: string;
  icon?: LucideIcon;
  onCopied?: () => void;
  onCopyError?: (error: unknown) => void;
  resetAfterMs?: number;
};

/**
 * Runs a real clipboard action and keeps progress and confirmation inside the control.
 * Callers retain ownership of success/error messaging and any product telemetry.
 */
export function CopyConfirmationButton({
  copy,
  label = "Copy",
  copiedLabel = "Copied",
  icon: IdleIcon = Copy,
  onCopied,
  onCopyError,
  resetAfterMs = 1800,
  className,
  disabled,
  ...props
}: CopyConfirmationButtonProps) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const handleCopy = async () => {
    if (status === "copying") return;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setStatus("copying");
    try {
      await copy();
      setStatus("copied");
      onCopied?.();
      resetTimer.current = setTimeout(() => setStatus("idle"), resetAfterMs);
    } catch (error) {
      setStatus("idle");
      onCopyError?.(error);
    }
  };

  const Icon = status === "copied" ? Check : status === "copying" ? Loader2 : IdleIcon;
  const text = status === "copied" ? copiedLabel : label;

  return (
    <Button
      type="button"
      disabled={disabled || status === "copying"}
      aria-live="polite"
      aria-label={text}
      className={cn("min-w-fit gap-2 overflow-hidden", className)}
      onClick={handleCopy}
      {...props}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={status}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.65, y: 3 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          {...(reduceMotion ? {} : { exit: { opacity: 0, scale: 0.65, y: -3 } })}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 30 }
          }
          className="inline-flex items-center gap-2"
        >
          <Icon
            className={cn("size-4", status === "copying" && "animate-spin")}
            aria-hidden="true"
          />
          <span>{text}</span>
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
