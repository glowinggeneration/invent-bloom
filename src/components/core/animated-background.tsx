"use client";
/**
 * Animated background highlight that slides between hoverable/selectable children.
 * Each child must carry a unique `data-id`.
 */
import { AnimatePresence, motion, type Transition } from "motion/react";
import { Children, cloneElement, useEffect, useState, type ReactElement } from "react";

import { cn } from "@/lib/utils";

export type AnimatedBackgroundProps = {
  children: ReactElement<{ "data-id": string; className?: string }>[] | ReactElement<{ "data-id": string; className?: string }>;
  defaultValue?: string;
  onValueChange?: (newActiveId: string | null) => void;
  className?: string;
  transition?: Transition;
  enableHover?: boolean;
};

export function AnimatedBackground({
  children,
  defaultValue,
  onValueChange,
  className,
  transition,
  enableHover = false,
}: AnimatedBackgroundProps) {
  const [activeId, setActiveId] = useState<string | null>(defaultValue ?? null);

  const handleSetActiveId = (id: string | null) => {
    setActiveId(id);
    onValueChange?.(id);
  };

  useEffect(() => {
    if (defaultValue !== undefined) setActiveId(defaultValue);
  }, [defaultValue]);

  return Children.map(children, (child, index) => {
    const id = child.props["data-id"];
    const interactionProps = enableHover
      ? {
          onMouseEnter: () => handleSetActiveId(id),
          onMouseLeave: () => handleSetActiveId(null),
        }
      : { onClick: () => handleSetActiveId(id) };

    return cloneElement(
      child,
      {
        key: index,
        className: cn("relative inline-flex", child.props.className),
        "aria-selected": activeId === id,
        "data-checked": activeId === id ? "true" : "false",
        ...interactionProps,
      } as never,
      <>
        <AnimatePresence initial={false}>
          {activeId === id ? (
            <motion.div
              layoutId={`background-${String(defaultValue ?? "group")}`}
              className={cn("absolute inset-0", className)}
              transition={transition}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          ) : null}
        </AnimatePresence>
        <span className="z-10">{child.props.children as never}</span>
      </>,
    );
  });
}
