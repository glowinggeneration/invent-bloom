"use client";
/** macOS-style magnifying dock. */
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
  type SpringOptions,
} from "motion/react";
import {
  Children,
  cloneElement,
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

const DOCK_HEIGHT = 128;
const DEFAULT_MAGNIFICATION = 80;
const DEFAULT_DISTANCE = 150;
const DEFAULT_PANEL_HEIGHT = 64;
const SPRING: SpringOptions = { mass: 0.1, stiffness: 150, damping: 12 };

type DockContextValue = {
  mouseX: MotionValue<number>;
  spring: SpringOptions;
  magnification: number;
  distance: number;
};

const DockContext = createContext<DockContextValue | null>(null);

function useDock() {
  const ctx = useContext(DockContext);
  if (!ctx) throw new Error("Dock components must be used inside <Dock>");
  return ctx;
}

const DockItemContext = createContext<{
  width: MotionValue<number>;
  isHovered: MotionValue<number>;
} | null>(null);

export function Dock({
  children,
  className,
  spring = SPRING,
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  panelHeight = DEFAULT_PANEL_HEIGHT,
}: {
  children: ReactNode;
  className?: string;
  spring?: SpringOptions;
  magnification?: number;
  distance?: number;
  panelHeight?: number;
}) {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
  const isHovered = useMotionValue(0);
  const maxHeight = useMemo(
    () => Math.max(DOCK_HEIGHT, magnification + magnification / 2 + 4),
    [magnification],
  );
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div
      style={{ height, scrollbarWidth: "none" }}
      className="mx-2 flex max-w-full items-end overflow-x-auto"
    >
      <motion.div
        onMouseMove={({ pageX }) => {
          isHovered.set(1);
          mouseX.set(pageX);
        }}
        onMouseLeave={() => {
          isHovered.set(0);
          mouseX.set(Number.POSITIVE_INFINITY);
        }}
        className={cn(
          "mx-auto flex w-fit items-end gap-4 rounded-2xl border border-border bg-card px-4 shadow-sm",
          className,
        )}
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label="Application dock"
      >
        <DockContext.Provider value={{ mouseX, spring, distance, magnification }}>
          {children}
        </DockContext.Provider>
      </motion.div>
    </motion.div>
  );
}

export function DockItem({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { distance, magnification, mouseX, spring } = useDock();
  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseX, (val) => {
    const domRect = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - domRect.x - domRect.width / 2;
  });
  const widthTransform = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [40, magnification, 40],
  );
  const width = useSpring(widthTransform, spring);

  return (
    <motion.div
      ref={ref}
      style={{ width }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      className={cn("relative inline-flex items-center justify-center", className)}
      tabIndex={0}
      role="button"
    >
      <DockItemContext.Provider value={{ width, isHovered }}>
        {Children.map(children, (child) => cloneElement(child as never))}
      </DockItemContext.Provider>
    </motion.div>
  );
}

export function DockLabel({ children, className }: { children: ReactNode; className?: string }) {
  const ctx = useContext(DockItemContext);
  const [visible, setVisible] = useState(false);

  if (ctx) {
    ctx.isHovered.on?.("change", (latest: number) => setVisible(latest === 1));
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -10 }}
          exit={{ opacity: 0, y: 0 }}
          className={cn(
            "absolute -top-6 left-1/2 w-fit -translate-x-1/2 whitespace-pre rounded-md border border-border bg-popover px-2 py-0.5 text-xs text-popover-foreground",
            className,
          )}
          role="tooltip"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function DockIcon({ children, className }: { children: ReactNode; className?: string }) {
  const ctx = useContext(DockItemContext);
  const widthTransform = useTransform(ctx?.width ?? useMotionValue(40), (w) => w / 2);
  return (
    <motion.div
      style={{ width: widthTransform }}
      className={cn("flex items-center justify-center", className)}
    >
      {children}
    </motion.div>
  );
}
