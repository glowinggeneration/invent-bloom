"use client";
/** Spring-animated numeric readout. */
import { motion, useSpring, useTransform, type SpringOptions } from "motion/react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

export type AnimatedNumberProps = {
  value: number;
  className?: string;
  springOptions?: SpringOptions;
  as?: React.ElementType;
};

export function AnimatedNumber({ value, className, springOptions, as = "span" }: AnimatedNumberProps) {
  const MotionComponent = motion.create(as as React.ComponentType<unknown>);
  const spring = useSpring(value, springOptions);
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  const Component = MotionComponent as React.ComponentType<Record<string, unknown>>;
  return <Component className={cn("tabular-nums", className)}>{display}</Component>;
}
