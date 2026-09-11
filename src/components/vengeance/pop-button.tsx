/**
 * Ported from Vengeance UI (MIT) - https://www.vengenceui.com/components,
 * source https://github.com/Ashutoshx7/VengeanceUI. Retinted from the
 * original's pink/cream palette to this app's brand tokens
 * (--primary/--brand-pink from src/styles.css); mechanics unchanged.
 */
import React from "react";
import { cn } from "@/lib/utils";

export type PopButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function PopButton({ className, children = "Learn More", ...props }: PopButtonProps) {
  return (
    <button
      className={cn(
        "group relative inline-flex items-center justify-center font-semibold text-foreground",
        "px-6 py-3 rounded-xl bg-primary/10 border-2 border-primary/40",
        "transition-all duration-150 ease-[cubic-bezier(0,0,0.58,1)]",
        "shadow-[0_8px_0_-2px_var(--brand-pink),0_8px_0_0_var(--primary),0_14px_0_0_color-mix(in_oklch,var(--brand-pink)_50%,transparent)]",
        "hover:bg-primary/15 hover:translate-y-1 hover:shadow-[0_5px_0_-2px_var(--brand-pink),0_5px_0_0_var(--primary),0_10px_0_0_color-mix(in_oklch,var(--brand-pink)_50%,transparent)]",
        "active:bg-primary/20 active:translate-y-2 active:shadow-[0_0px_0_-2px_var(--brand-pink),0_0px_0_0_var(--primary),0_0px_0_0_transparent]",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export default PopButton;
