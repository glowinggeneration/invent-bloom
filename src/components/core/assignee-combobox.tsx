/** Searchable people picker with avatar + presence dot, for assigning an item to a teammate. */
import { useId, useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export type AssigneeStatus = "away" | "busy" | "offline" | "online";

export type AssigneeOption = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status: AssigneeStatus;
};

const statusClassName: Record<AssigneeStatus, string> = {
  online: "bg-emerald-500",
  offline: "bg-slate-400",
  away: "bg-amber-400",
  busy: "bg-destructive",
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export type AssigneeComboboxProps = {
  options: AssigneeOption[];
  value?: string;
  onChange?: (id: string | null) => void;
  label?: string;
  placeholder?: string;
  className?: string;
};

export function AssigneeCombobox({
  options,
  value,
  onChange,
  label = "Assignee",
  placeholder = "Select assignee",
  className,
}: AssigneeComboboxProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [internalId, setInternalId] = useState<string | null>(value ?? null);
  const selectedId = value ?? internalId;
  const selected = options.find((option) => option.id === selectedId);

  function select(nextId: string) {
    const resolved = nextId === selectedId ? null : nextId;
    setInternalId(resolved);
    onChange?.(resolved);
    setOpen(false);
  }

  return (
    <div className={cn("w-full max-w-xs space-y-2", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            className="flex h-10 w-full items-center justify-between rounded-full border border-input bg-background px-3.5 text-sm shadow-sm outline-none transition-colors hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <Avatar className="size-6">
                  {selected.avatarUrl && (
                    <AvatarImage src={selected.avatarUrl} alt={selected.name} />
                  )}
                  <AvatarFallback>{initials(selected.name)}</AvatarFallback>
                </Avatar>
                <span className="truncate font-medium">{selected.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground/80"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-75 overflow-hidden rounded-2xl border border-border/60 p-0 shadow-sm">
          <Command>
            <CommandInput placeholder="Search assignee..." className="h-9 px-1" />
            <CommandList>
              <CommandEmpty>No assignee found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.name}
                    data-checked={selectedId === option.id}
                    onSelect={() => select(option.id)}
                    className="rounded-lg pr-2"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="relative shrink-0">
                        <Avatar className="size-7">
                          {option.avatarUrl && (
                            <AvatarImage src={option.avatarUrl} alt={option.name} />
                          )}
                          <AvatarFallback>{initials(option.name)}</AvatarFallback>
                        </Avatar>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute bottom-0 right-0 size-2 rounded-full ring-2 ring-background",
                            statusClassName[option.status],
                          )}
                        />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{option.name}</span>
                        <span className="truncate text-sm text-muted-foreground">
                          {option.email}
                        </span>
                      </span>
                    </span>
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
