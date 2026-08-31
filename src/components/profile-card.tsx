"use client";
/** Collapsible company/contact summary card — header always visible, detail rows on expand. */
import { AnimatePresence, motion } from "motion/react";
import { ChevronUp, DollarSign, Flag, Globe, MapPin, Tag, Users } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ProfileCardFounder = { name: string; avatarUrl: string };

export type ProfileCardProps = {
  name: string;
  website: string;
  location: string;
  categories: string[];
  employees: string;
  arr: string;
  founders: ProfileCardFounder[];
  extraFounders?: number;
  avatarLetter?: string;
  className?: string;
};

export function ProfileCard({
  name,
  website,
  location,
  categories,
  employees,
  arr,
  founders,
  extraFounders = 0,
  avatarLetter,
  className,
}: ProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        "w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary text-sm font-semibold text-primary-foreground"
            aria-hidden="true"
          >
            {avatarLetter ?? name.charAt(0).toUpperCase()}
          </div>
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 0 : 180 }}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"
        >
          <ChevronUp className="size-5" aria-hidden="true" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border"
          >
            <div className="space-y-4 p-5">
              <DataRow icon={<Globe className="size-4" />} label="Website">
                <span className="truncate text-xs font-medium text-muted-foreground">
                  {website}
                </span>
              </DataRow>
              <DataRow icon={<MapPin className="size-4" />} label="Location">
                <span className="truncate text-sm font-semibold">{location}</span>
              </DataRow>
              <DataRow icon={<Tag className="size-4" />} label="Categories">
                <div className="flex flex-wrap justify-end gap-2">
                  {categories.map((cat) => (
                    <span
                      key={cat}
                      className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </DataRow>
              <DataRow icon={<Users className="size-4" />} label="Employees">
                <span className="text-sm font-semibold">{employees}</span>
              </DataRow>
              <DataRow icon={<DollarSign className="size-4" />} label="Estimated ARR">
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success">
                  {arr}
                </span>
              </DataRow>
              <DataRow icon={<Flag className="size-4" />} label="Founders">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {founders.map((f) => (
                    <div
                      key={f.name}
                      className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted py-1 pl-1 pr-3"
                    >
                      <img src={f.avatarUrl} className="size-5 rounded-full object-cover" alt="" />
                      <span className="text-xs font-medium">{f.name}</span>
                    </div>
                  ))}
                  {extraFounders > 0 ? (
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-bold text-muted-foreground">
                      +{extraFounders}
                    </div>
                  ) : null}
                </div>
              </DataRow>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function DataRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <div className="flex shrink-0 items-center gap-3 text-muted-foreground/70">
        <span aria-hidden="true">{icon}</span>
        <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}
