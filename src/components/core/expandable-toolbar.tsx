"use client";
/**
 * Floating toolbar that expands in place to reveal a panel for the active item.
 * Supports a simple two-state search toggle (`ExpandableToolbar` with
 * `searchSlot`) as well as a multi-item tab layout (`items`).
 */
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { useRef, useState, type ReactNode } from "react";

import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/utils";

const transition = { type: "spring", bounce: 0.1, duration: 0.25 } as const;

export type ExpandableToolbarItem = {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
};

export function ExpandableToolbar({
  items,
  className,
}: {
  items: ExpandableToolbarItem[];
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useClickOutside(ref, () => setActiveId(null));

  const activeItem = items.find((item) => item.id === activeId) ?? null;

  return (
    <MotionConfig transition={reduceMotion ? { duration: 0 } : transition}>
      <div ref={ref} className={cn("w-fit", className)}>
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-hidden">
            <AnimatePresence initial={false} mode="sync">
              {activeItem ? (
                <motion.div
                  key="content"
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  role="region"
                  aria-label={activeItem.label}
                >
                  <div className="min-w-56 p-3 text-sm text-card-foreground">
                    {activeItem.content}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="flex gap-1 p-1.5" role="tablist" aria-label="Toolbar">
            {items.map((item) => {
              const isSelected = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={item.label}
                  className={cn(
                    "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
                    isSelected && "bg-accent text-accent-foreground",
                  )}
                  onClick={() => setActiveId(isSelected ? null : item.id)}
                >
                  {item.icon}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

/** Two-state dock: collapsed icon row that expands into a search field. */
export function SearchToolbar({
  onSearch,
  placeholder = "Search…",
  className,
}: {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useClickOutside(containerRef, () => setIsOpen(false));

  return (
    <MotionConfig transition={reduceMotion ? { duration: 0 } : transition}>
      <div ref={containerRef} className={cn("w-fit", className)}>
        <div className="rounded-xl border border-border bg-card">
          <motion.div animate={{ width: isOpen ? 260 : 84 }} initial={false}>
            <div className="overflow-hidden p-2">
              {!isOpen ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="Open search"
                    onClick={() => setIsOpen(true)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                  >
                    <SearchIcon />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="Close search"
                    onClick={() => setIsOpen(false)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                  >
                    <BackIcon />
                  </button>
                  <input
                    autoFocus
                    placeholder={placeholder}
                    onChange={(e) => onSearch?.(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-transparent px-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}
