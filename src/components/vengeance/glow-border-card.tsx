/**
 * Ported from Vengeance UI (MIT) - https://www.vengenceui.com/components,
 * source https://github.com/Ashutoshx7/VengeanceUI. Two changes from the
 * original:
 *  1. The exported source referenced a `.glow-conic` CSS class (the
 *     rotating conic-gradient itself) that was never defined anywhere in
 *     the "free components" export - it must have lived in that project's
 *     global stylesheet, which wasn't included. Reconstructed below as a
 *     scoped <style> block, built from the same --glow-color-1..10 /
 *     --glow-animation-duration variables the component already sets up.
 *  2. Default `colorPreset` swapped from the original's rainbow presets to
 *     a `brand` preset built from this app's --primary/--brand-pink tokens,
 *     and width/aspectRatio defaults changed to fit arbitrary content
 *     instead of a fixed square showcase tile.
 */
import React from "react";
import { cn } from "@/lib/utils";

export interface GlowBorderCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /** Width of the card (CSS value). @default "100%" */
  width?: string;
  /** Height of the card (CSS value). If not provided, uses aspect-ratio. */
  height?: string;
  /** Aspect ratio of the card. Set to "auto" to size to content. @default "auto" */
  aspectRatio?: string;
  /** Corner radius of the card. @default "0.75rem" */
  borderRadius?: string;
  /** Animation duration in seconds. @default 6 */
  animationDuration?: number;
  /** Gradient colors array (up to 10 colors). */
  gradientColors?: string[];
  /** Border width for the glow effect. @default "1.25em" */
  borderWidth?: string;
  /** Blur amount for the glow effect. @default "0.75em" */
  blurAmount?: string;
  /** Inset distance (negative values push the border outside). @default "-1em" */
  inset?: string;
  /** Preset color themes. */
  colorPreset?: "nature" | "ocean" | "sunset" | "aurora" | "brand";
  /** Whether animation is paused. @default false */
  paused?: boolean;
}

const colorPresets: Record<string, string[]> = {
  nature: [
    "#669900",
    "#88bb22",
    "#99cc33",
    "#aaddaa",
    "#ccee66",
    "#006699",
    "#228888",
    "#3399cc",
    "#55aacc",
    "#669900",
  ],
  ocean: [
    "#006699",
    "#1177aa",
    "#2288bb",
    "#3399cc",
    "#44aadd",
    "#55bbee",
    "#66ccff",
    "#44bbee",
    "#2299cc",
    "#006699",
  ],
  sunset: [
    "#ff6600",
    "#ff7711",
    "#ff8822",
    "#ff9900",
    "#ffaa22",
    "#ffbb44",
    "#ffcc00",
    "#ff9933",
    "#ff7722",
    "#ff6600",
  ],
  aurora: [
    "#00ff87",
    "#22ffaa",
    "#44ffcc",
    "#60efff",
    "#88ddff",
    "#bb99ff",
    "#dd77ee",
    "#ff68f0",
    "#ff55cc",
    "#00ff87",
  ],
  brand: [
    "var(--primary)",
    "var(--brand-pink)",
    "color-mix(in oklch, var(--primary) 60%, white)",
    "var(--brand-pink)",
    "var(--primary)",
    "color-mix(in oklch, var(--brand-navy) 70%, var(--primary))",
    "var(--brand-pink)",
    "var(--primary)",
    "color-mix(in oklch, var(--primary) 60%, white)",
    "var(--primary)",
  ],
};

/**
 * GlowBorderCard - a CSS-only animated glowing border card.
 * A rotating conic gradient creates a glow effect around the card edges.
 */
export const GlowBorderCard = React.forwardRef<HTMLDivElement, GlowBorderCardProps>(
  (
    {
      children,
      className,
      width = "100%",
      height,
      aspectRatio = "auto",
      borderRadius = "0.75rem",
      animationDuration = 6,
      gradientColors,
      borderWidth = "1.25em",
      blurAmount = "0.75em",
      inset = "-1em",
      colorPreset = "brand",
      paused = false,
      style,
      ...props
    },
    ref,
  ) => {
    const colors = gradientColors || colorPresets[colorPreset] || colorPresets["brand"];

    const colorVars: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      colorVars[`--glow-color-${i + 1}`] = colors![i % colors!.length]!;
    }

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden isolate",
          "bg-zinc-50/50 dark:bg-neutral-900/60 backdrop-blur-md",
          className,
        )}
        style={
          {
            width,
            height: height || "auto",
            aspectRatio: height ? "unset" : aspectRatio,
            borderRadius,
            "--glow-animation-duration": `${animationDuration}s`,
            ...colorVars,
            ...style,
          } as React.CSSProperties
        }
        {...props}
      >
        <style>{`
          @property --glow-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
          @keyframes glow-spin { to { --glow-angle: 360deg; } }
        `}</style>

        <div
          className={cn(
            "absolute -z-10 rounded-[inherit]",
            !paused && "[animation:glow-spin_var(--glow-animation-duration)_linear_infinite]",
          )}
          style={{
            inset,
            borderWidth,
            filter: `blur(${blurAmount})`,
            background: `conic-gradient(from var(--glow-angle), var(--glow-color-1), var(--glow-color-2), var(--glow-color-3), var(--glow-color-4), var(--glow-color-5), var(--glow-color-6), var(--glow-color-7), var(--glow-color-8), var(--glow-color-9), var(--glow-color-10))`,
          }}
        />

        <div className="relative z-10 w-full h-full bg-transparent">{children}</div>
      </div>
    );
  },
);

GlowBorderCard.displayName = "GlowBorderCard";

export default GlowBorderCard;
