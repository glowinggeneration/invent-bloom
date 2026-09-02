import { useEffect, useId, useState } from "react";

import { Slider as SliderPrimitive } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type SliderProps = {
  id?: string;
  label?: string | undefined;
  "aria-label"?: string | undefined;
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  labelPosition?: "top" | "top-floating" | "none";
  formatValue?: (value: number) => string;
  disabled?: boolean | undefined;
  className?: string;
};

export function Slider({
  id,
  label,
  "aria-label": ariaLabel,
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue = min,
  onValueChange,
  labelPosition = "top-floating",
  formatValue = String,
  disabled,
  className,
}: SliderProps) {
  const generatedId = useId();
  const sliderId = id ?? generatedId;
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);

  useEffect(() => {
    if (value !== undefined) setInternalValue(value);
  }, [value]);

  const currentValue = value ?? internalValue;
  const percent = max === min ? 0 : ((currentValue - min) / (max - min)) * 100;
  const displayValue = formatValue(currentValue);

  return (
    <div className={cn("w-full", labelPosition === "top-floating" && "pt-7", className)}>
      {labelPosition === "top" ? (
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          {label ? <label htmlFor={sliderId}>{label}</label> : <span />}
          <span className="font-medium text-muted-foreground">{displayValue}</span>
        </div>
      ) : null}

      <div className="relative">
        {labelPosition === "top-floating" ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-8 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-semibold text-popover-foreground shadow-sm"
            style={{ left: `${Math.min(Math.max(percent, 0), 100)}%` }}
          >
            {displayValue}
          </span>
        ) : null}
        <SliderPrimitive
          id={sliderId}
          min={min}
          max={max}
          step={step}
          value={[currentValue]}
          {...(disabled === undefined ? {} : { disabled })}
          {...((ariaLabel ?? label) ? { "aria-label": ariaLabel ?? label } : {})}
          onValueChange={([next]) => {
            if (next === undefined) return;
            if (value === undefined) setInternalValue(next);
            onValueChange?.(next);
          }}
          className="py-2"
        />
      </div>
    </div>
  );
}
