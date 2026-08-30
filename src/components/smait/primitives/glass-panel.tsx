import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "primary" | "muted";
  padded?: boolean;
  as?: "div" | "section" | "article" | "aside";
}

/** Frosted-glass surface. Uses Tailwind backdrop utilities (see design rules). */
export function GlassPanel({
  className,
  tone = "default",
  padded = true,
  as: Tag = "div",
  ...rest
}: GlassPanelProps) {
  const toneClass = {
    default: "bg-card/60 border-border/60",
    primary: "bg-primary/10 border-primary/30",
    muted: "bg-muted/40 border-border/40",
  }[tone];
  return (
    <Tag
      className={cn(
        "rounded-2xl border shadow-sm backdrop-blur-xl",
        toneClass,
        padded && "p-5",
        className,
      )}
      {...(rest as HTMLAttributes<HTMLElement>)}
    />
  );
}
