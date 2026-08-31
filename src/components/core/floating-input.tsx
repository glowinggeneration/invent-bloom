"use client";
/** Text input with a label that floats above the border once focused or filled. */
import { useId, useState, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type FloatingInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function FloatingInput({
  label,
  className,
  id,
  defaultValue,
  value,
  ...props
}: FloatingInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [hasValue, setHasValue] = useState(Boolean(defaultValue ?? value ?? ""));

  return (
    <div className="relative">
      <input
        id={inputId}
        className={cn(
          "peer w-full rounded-lg border border-input bg-transparent px-4 py-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        placeholder=" "
        defaultValue={defaultValue}
        value={value}
        onChange={(e) => {
          setHasValue(e.target.value !== "");
          props.onChange?.(e);
        }}
        {...props}
      />
      <label
        htmlFor={inputId}
        className={cn(
          "pointer-events-none absolute left-4 top-3 text-sm text-muted-foreground transition-all duration-200",
          "peer-focus:-top-2.5 peer-focus:left-3 peer-focus:bg-background peer-focus:px-1 peer-focus:text-xs peer-focus:text-primary",
          hasValue && "-top-2.5 left-3 bg-background px-1 text-xs",
        )}
      >
        {label}
      </label>
    </div>
  );
}
