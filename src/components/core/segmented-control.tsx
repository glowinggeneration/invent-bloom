"use client";
/** Animated pill-style segmented control (e.g. Day / Week / Month / Year). */
import { useId } from "react";

import { AnimatedBackground } from "@/components/core/animated-background";
import { cn } from "@/lib/utils";

export type SegmentedControlProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
};

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel = "Choose an option",
}: SegmentedControlProps) {
  const groupId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex rounded-lg bg-muted p-0.5", className)}
    >
      <AnimatedBackground
        defaultValue={value}
        className="rounded-md bg-background shadow-sm"
        transition={{ ease: "easeInOut", duration: 0.2 }}
        onValueChange={(id) => {
          if (id) onChange(id);
        }}
      >
        {options.map((label) => (
          <button
            key={label}
            data-id={label}
            type="button"
            role="radio"
            aria-checked={value === label}
            id={`${groupId}-${label}`}
            className="inline-flex min-w-16 items-center justify-center rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] data-[checked=true]:text-foreground"
          >
            {label}
          </button>
        ))}
      </AnimatedBackground>
    </div>
  );
}
