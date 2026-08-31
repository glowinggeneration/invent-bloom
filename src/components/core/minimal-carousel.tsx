"use client";
/** Grid of cards where selecting one expands it into a detail hero above the rest. */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MoreHorizontal } from "lucide-react";
import { useState, type ElementType } from "react";

import { cn } from "@/lib/utils";

export type MinimalCarouselCard = {
  id: string;
  title: string;
  value: string;
  colorClassName: string;
  icon: ElementType;
};

export function MinimalCarousel({
  cards,
  onCardAction,
  className,
}: {
  cards: MinimalCarouselCard[];
  onCardAction?: (card: MinimalCarouselCard) => void;
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, bounce: 0.2, duration: 0.5 };

  const activeCard = cards.find((c) => c.id === activeId) ?? null;
  const secondaryCards = cards.filter((c) => c.id !== activeId);

  return (
    <div className={cn("w-full max-w-md", className)}>
      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {activeCard ? (
            <motion.div
              key={activeCard.id}
              layoutId={activeCard.id}
              transition={transition}
              className={cn(
                "relative flex min-h-40 w-full flex-col justify-between rounded-3xl p-5 text-white shadow-lg",
                activeCard.colorClassName,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <activeCard.icon className="size-9 shrink-0" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => onCardAction?.(activeCard)}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Action
                </button>
              </div>
              <div className="mt-4 min-w-0">
                <h3 className="truncate text-xl font-semibold leading-tight opacity-90">
                  {activeCard.title}
                </h3>
                <p className="truncate text-lg font-semibold tracking-tight opacity-60">
                  {activeCard.value}
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div layout className={cn("grid gap-2", activeId ? "grid-cols-3" : "grid-cols-2")}>
          {(activeId ? secondaryCards : cards).map((card) => (
            <motion.button
              key={card.id}
              layoutId={card.id}
              type="button"
              onClick={() => setActiveId(card.id)}
              transition={transition}
              aria-pressed={activeId === card.id}
              className={cn(
                "relative flex flex-col justify-between rounded-3xl p-4 text-left text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                card.colorClassName,
                activeId ? "h-24" : "h-28",
              )}
            >
              <div className="flex items-start justify-between">
                <card.icon className={activeId ? "size-5" : "size-7"} aria-hidden="true" />
                <MoreHorizontal
                  className="size-4 rounded-full bg-white/10 p-0.5"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-1 min-w-0">
                <h4
                  className={cn(
                    "truncate font-medium leading-tight opacity-90",
                    activeId ? "text-xs" : "text-sm",
                  )}
                >
                  {card.title}
                </h4>
                <p
                  className={cn(
                    "truncate font-semibold text-white/60",
                    activeId ? "text-xs" : "text-sm",
                  )}
                >
                  {card.value}
                </p>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
