/**
 * Example wiring for the tri-state Checkbox: starts indeterminate, resolves
 * to checked/unchecked on first interaction. Reusable pattern for "select
 * all" controls over a partially-selected list.
 */
import { useId, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type IndeterminateCheckboxProps = {
  label?: string;
  description?: string;
  className?: string;
};

export function IndeterminateCheckbox({
  label = "Enable beta features",
  description = "This state is useful when only part of a selection is complete.",
  className,
}: IndeterminateCheckboxProps) {
  const id = useId();
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(true);

  const handleCheckedChange = (value: boolean | "indeterminate") => {
    setChecked(value === true);
    setIndeterminate(false);
  };

  return (
    <div className={cn("flex max-w-sm items-start gap-3", className)}>
      <Checkbox
        id={id}
        checked={indeterminate ? "indeterminate" : checked}
        onCheckedChange={handleCheckedChange}
        className="mt-0.5"
      />
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
