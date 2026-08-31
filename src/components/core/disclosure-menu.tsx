"use client";
/** Icon trigger that discloses a centered action menu, with a two-step delete confirmation. */
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { MoreVertical } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/utils";

export type DisclosureMenuItem = {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
};

export function DisclosureMenu({
  menuItems,
  showDelete = true,
  onDelete,
  className,
}: {
  menuItems: DisclosureMenuItem[];
  showDelete?: boolean;
  onDelete?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useClickOutside(ref, () => {
    setOpen(false);
    setConfirm(false);
  });

  const menuVariants: Variants = reduceMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : { hidden: { opacity: 0, scale: 0.94 }, visible: { opacity: 1, scale: 1 } };

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-2xl border-2 border-border bg-card text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreVertical className="size-5" aria-hidden="true" />
        <span className="sr-only">More options</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            role="menu"
            className="absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border-2 border-border bg-popover text-popover-foreground shadow-xl"
          >
            <div className="border-b-2 border-border bg-muted px-4 py-2">
              <span className="text-xs font-medium text-muted-foreground">More options</span>
            </div>

            <div className="flex flex-col gap-1 p-2">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={item.onClick}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-muted-foreground" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>

            {showDelete ? (
              <div className="relative h-14 overflow-hidden border-t-2 border-border">
                {!confirm ? (
                  <div className="absolute inset-0 flex items-center px-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setConfirm(true)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center gap-2 px-2">
                    <button
                      type="button"
                      onClick={onDelete}
                      className="h-10 flex-1 rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm(false)}
                      className="h-10 flex-1 rounded-xl border border-border text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
