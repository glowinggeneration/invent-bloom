import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type ProgressiveBlurProps = {
  className?: string;
  backgroundColor?: string;
  position?: "top" | "bottom";
  height?: string;
  blurAmount?: string;
};

/** Theme-aware edge treatment for bounded scrolling surfaces. */
export function ProgressiveBlur({
  className,
  backgroundColor = "var(--background)",
  position = "top",
  height = "3rem",
  blurAmount = "6px",
}: ProgressiveBlurProps) {
  const isTop = position === "top";
  const edgePosition: CSSProperties = isTop ? { top: 0 } : { bottom: 0 };
  const mask = isTop
    ? "linear-gradient(to bottom, black 50%, transparent)"
    : "linear-gradient(to top, black 50%, transparent)";

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute left-0 z-10 w-full select-none", className)}
      style={{
        ...edgePosition,
        height,
        background: isTop
          ? `linear-gradient(to top, transparent, ${backgroundColor})`
          : `linear-gradient(to bottom, transparent, ${backgroundColor})`,
        maskImage: mask,
        WebkitMaskImage: mask,
        WebkitBackdropFilter: `blur(${blurAmount})`,
        backdropFilter: `blur(${blurAmount})`,
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    />
  );
}
