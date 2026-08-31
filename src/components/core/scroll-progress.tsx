"use client";
/** Horizontal reading-progress bar driven by page or container scroll. */
import { motion, useScroll, useSpring, type SpringOptions } from "motion/react";
import type { RefObject } from "react";

import { cn } from "@/lib/utils";

export type ScrollProgressProps = {
  className?: string;
  springOptions?: SpringOptions;
  containerRef?: RefObject<HTMLDivElement | null>;
};

const DEFAULT_SPRING: SpringOptions = { stiffness: 200, damping: 50, restDelta: 0.001 };

export function ScrollProgress({ className, springOptions, containerRef }: ScrollProgressProps) {
  const { scrollYProgress } = useScroll(
    containerRef ? { container: containerRef as RefObject<HTMLElement> } : undefined,
  );
  const scaleX = useSpring(scrollYProgress, { ...DEFAULT_SPRING, ...(springOptions ?? {}) });

  return (
    <motion.div
      role="presentation"
      className={cn("inset-x-0 top-0 h-1 origin-left bg-primary", className)}
      style={{ scaleX }}
    />
  );
}
