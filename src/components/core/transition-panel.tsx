"use client";
/** Animated panel switcher — renders one child at a time with enter/exit motion. */
import { AnimatePresence, motion, type Transition, type Variant } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TransitionPanelProps = {
  children: ReactNode[];
  className?: string;
  transition?: Transition;
  activeIndex: number;
  variants?: { enter: Variant; center: Variant; exit: Variant };
  custom?: number;
};

export function TransitionPanel({
  children,
  className,
  transition,
  activeIndex,
  variants,
  custom,
}: TransitionPanelProps) {
  return (
    <div className={cn("relative", className)}>
      <AnimatePresence initial={false} mode="popLayout" custom={custom}>
        <motion.div
          key={activeIndex}
          variants={variants}
          transition={transition}
          initial="enter"
          animate="center"
          exit="exit"
          custom={custom}
        >
          {children[activeIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
