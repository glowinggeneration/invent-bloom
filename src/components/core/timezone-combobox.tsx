/** Searchable timezone picker, offset-sorted, built on the existing Command + Popover primitives. */
import { useId, useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TimezoneOption = {
  label: string;
  numericOffset: number;
  value: string;
};

export type TimezoneComboboxProps = {
  value?: string;
  onChange?: (timezone: string) => void;
  className?: string;
};

export function TimezoneCombobox({ value, onChange, className }: TimezoneComboboxProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(
    () => value ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const selectedTimezone = value ?? internalValue;

  const formattedTimezones = useMemo<TimezoneOption[]>(() => {
    const supported = Intl.supportedValuesOf("timeZone");
    return supported
      .map((timezone) => {
        const formatter = new Intl.DateTimeFormat("en", {
          timeZone: timezone,
          timeZoneName: "shortOffset",
        });
        const parts = formatter.formatToParts(new Date());
        const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
        const formattedOffset = offset === "GMT" ? "GMT+0" : offset;
        return {
          value: timezone,
          label: `(${formattedOffset}) ${timezone.replace(/_/g, " ")}`,
          numericOffset: Number.parseInt(
            formattedOffset.replace("GMT", "").replace("+", "") || "0",
            10,
          ),
        };
      })
      .sort((a, b) => a.numericOffset - b.numericOffset);
  }, []);

  const selectedLabel = formattedTimezones.find((tz) => tz.value === selectedTimezone)?.label ?? "";

  function select(timezone: string) {
    setInternalValue(timezone);
    onChange?.(timezone);
    setOpen(false);
  }

  return (
    <div className={cn("w-full max-w-xs space-y-2", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        Timezone
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3.5 text-sm shadow-sm outline-none transition-colors hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={cn("truncate", !selectedTimezone && "text-muted-foreground")}>
              {selectedTimezone ? (
                selectedLabel
              ) : (
                <span className="text-muted-foreground">Select timezone</span>
              )}
            </span>
            <ChevronsUpDown
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground/80"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) rounded-xl border-border/60 p-0 shadow-sm">
          <Command>
            <CommandInput placeholder="Search timezone" className="h-9 px-1" />
            <CommandList>
              <CommandEmpty>No timezone found.</CommandEmpty>
              <CommandGroup>
                {formattedTimezones.map((tz) => (
                  <CommandItem
                    key={tz.value}
                    value={tz.value}
                    data-checked={selectedTimezone === tz.value}
                    onSelect={select}
                    className="rounded-md pr-2"
                  >
                    <span className="truncate">{tz.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
