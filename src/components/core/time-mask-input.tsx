/**
 * HH:MM:SS time input with input masking, done with plain string formatting
 * (no added dependency — the source used `use-mask-input`, not present in
 * this repo's package.json; lucide's Clock replaces react-icons' HiClock to
 * stay on this repo's single icon set).
 */
import { useId, useState } from "react";
import { Clock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function formatTimeMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].filter(Boolean);
  return parts.join(":");
}

export type TimeMaskInputProps = {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
};

export function TimeMaskInput({ label = "Time", value, onChange, className }: TimeMaskInputProps) {
  const id = useId();
  const [internalValue, setInternalValue] = useState("");
  const shown = value ?? internalValue;

  function handleChange(next: string) {
    const masked = formatTimeMask(next);
    setInternalValue(masked);
    onChange?.(masked);
  }

  return (
    <div className={cn("w-full max-w-xs space-y-3", className)}>
      <Label htmlFor={id} className="flex items-center gap-2">
        {label}
      </Label>
      <div className="group flex items-center gap-2 rounded-md border border-input bg-muted/20 px-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
        <Clock
          aria-hidden="true"
          className="size-4 text-muted-foreground transition-transform duration-200 group-focus-within:scale-110 group-focus-within:text-foreground"
        />
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="HH:MM:SS"
          value={shown}
          onChange={(e) => handleChange(e.target.value)}
          maxLength={8}
          className="border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
      <p className="text-xs text-muted-foreground">Enter time in 24-hour format (e.g. 14:30:00)</p>
    </div>
  );
}
