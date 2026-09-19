import { memo } from "react";
import type { ReactNode } from "react";

interface AuroraTextProps {
  children: ReactNode;
  className?: string;
  colors?: string[];
  speed?: number;
}

/**
 * Animated gradient text. Colors default to this app's own brand tokens
 * (never --brand-pink directly - styles.css marks it decorative/large-scale
 * only, not text-bearing) so the effect reads as SMAIT, not a stock demo.
 */
export const AuroraText = memo(function AuroraText({
  children,
  className = "",
  colors = ["var(--primary)", "var(--x-blue)", "var(--brand-navy)", "var(--primary)"],
  speed = 1,
}: AuroraTextProps) {
  const gradientStyle = {
    backgroundImage: `linear-gradient(135deg, ${colors.join(", ")})`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    animationDuration: `${8 / speed}s`,
  };

  return (
    <span className={`relative inline-block ${className}`}>
      <span className="sr-only">{children}</span>
      <span
        className="relative animate-aurora bg-[length:200%_auto] bg-clip-text text-transparent"
        style={gradientStyle}
        aria-hidden="true"
      >
        {children}
      </span>
    </span>
  );
});
