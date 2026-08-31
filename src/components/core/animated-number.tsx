"use client";
/** Spring-animated numeric readout. */
import { motion, useSpring, useTransform, type SpringOptions } from "motion/react";
import { useEffect, useMemo } from "react";

import { cn } from "@/lib/utils";

export type AnimatedNumberProps = {
  value: number;
  className?: string;
  springOptions?: SpringOptions;
  as?: "span" | "div" | "p" | "h1" | "h2" | "h3";
};

const MOTION_COMPONENTS = {
  span: motion.span,
  div: motion.div,
  p: motion.p,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
} as const;

export function AnimatedNumber({
  value,
  className,
  springOptions,
  as = "span",
}: AnimatedNumberProps) {
  const MotionComponent = useMemo(() => MOTION_COMPONENTS[as], [as]);
  const spring = useSpring(value, springOptions);
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <MotionComponent className={cn("tabular-nums", className)}>{display}</MotionComponent>;
}
