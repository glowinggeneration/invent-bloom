import { Children, memo, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export function AnimatedListItem({ children }: { children: ReactNode }) {
  const animations = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1, originY: 0 },
    exit: { scale: 0, opacity: 0 },
    transition: { type: "spring" as const, stiffness: 350, damping: 40 },
  };

  return (
    <motion.div {...animations} layout className="mx-auto w-full">
      {children}
    </motion.div>
  );
}

export const AnimatedList = memo(function AnimatedList({
  children,
  className,
  delay = 1000,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const [index, setIndex] = useState(0);
  const childrenArray = useMemo(() => Children.toArray(children), [children]);

  useEffect(() => {
    if (index >= childrenArray.length - 1) return;
    const timeout = setTimeout(() => setIndex((prev) => prev + 1), delay);
    return () => clearTimeout(timeout);
  }, [index, delay, childrenArray.length]);

  const itemsToShow = useMemo(() => childrenArray.slice(0, index + 1).reverse(), [
    index,
    childrenArray,
  ]);

  return (
    <div className={cn("flex flex-col items-center gap-2.5", className)}>
      <AnimatePresence>
        {itemsToShow.map((item) => (
          <AnimatedListItem key={(item as { key: string }).key}>{item}</AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  );
});
