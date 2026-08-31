"use client";
/** Compact "Create New" style trigger that expands in place into a grid of options. */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DisclosureItem = {
  icon: ReactNode;
  label: string;
  onSelect?: () => void;
};

export function Disclosure({
  items,
  triggerLabel = "Create New",
  className,
}: {
  items: DisclosureItem[];
  triggerLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, bounce: 0.1, duration: 0.4 };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {!open ? (
        <motion.button
          key="collapsed"
          layoutId="disclosure-shared"
          type="button"
          onClick={() => setOpen(true)}
          exit={{ opacity: 0 }}
          transition={transition}
          className={cn(
            "flex items-center gap-2 rounded-full bg-muted px-6 py-3.5 text-base font-medium text-muted-foreground whitespace-nowrap hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Plus className="size-5" aria-hidden="true" />
          {triggerLabel}
        </motion.button>
      ) : (
        <motion.div
          key="expanded"
          layoutId="disclosure-shared"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          role="menu"
          aria-label={triggerLabel}
          className={cn("w-full max-w-sm rounded-3xl bg-muted p-1", className)}
        >
          <div className="flex items-center justify-between px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">{triggerLabel}</p>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="flex size-6 items-center justify-center rounded-full bg-border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-background p-3 shadow-sm">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
                className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-4 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="[&>svg]:size-6" aria-hidden="true">
                  {item.icon}
                </div>
                <span className="text-xs font-medium tracking-tight">{item.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
