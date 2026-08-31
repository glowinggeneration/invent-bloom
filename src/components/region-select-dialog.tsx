"use client";
/** Searchable region/country picker in a compact popover-style dialog. */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/utils";
import { useRef } from "react";

export type Region = { code: string; name: string };

export const DEFAULT_REGIONS: Region[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
];

export function RegionSelectDialog({
  value,
  onChange,
  regions = DEFAULT_REGIONS,
  title = "Select your region",
  className,
}: {
  value: Region;
  onChange: (region: Region) => void;
  regions?: Region[];
  title?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  useClickOutside(ref, () => setIsOpen(false));

  const filtered = useMemo(
    () => regions.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [regions, search],
  );

  return (
    <div ref={ref} className={cn("relative w-max", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-medium">{value.code}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/20"
              aria-hidden="true"
            />
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="absolute left-0 top-full z-50 mt-2 flex h-[360px] w-80 flex-col overflow-hidden rounded-3xl border border-border bg-popover text-popover-foreground shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="px-1 text-sm font-medium">{title}</h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setIsOpen(false)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="px-4 pb-3">
                <div className="relative flex items-center">
                  <Search
                    className="absolute left-3.5 size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by country or region"
                    className="w-full rounded-xl border border-border bg-muted py-2.5 pl-10 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pb-4" role="listbox">
                {filtered.length === 0 ? (
                  <div className="flex h-[150px] items-center justify-center text-sm text-muted-foreground">
                    No countries found
                  </div>
                ) : (
                  filtered.map((region) => (
                    <button
                      key={region.code}
                      type="button"
                      role="option"
                      aria-selected={value.code === region.code}
                      onClick={() => {
                        onChange(region);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-accent",
                        value.code === region.code && "bg-accent",
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm font-medium",
                          value.code !== region.code && "text-muted-foreground",
                        )}
                      >
                        {region.name}
                      </span>
                      {value.code === region.code ? (
                        <Check className="size-4" aria-hidden="true" />
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
