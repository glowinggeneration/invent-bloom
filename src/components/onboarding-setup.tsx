"use client";
/**
 * Standalone onboarding step card: a focus-area picker plus revenue/role
 * fields and a step indicator. Not wired into a route — this project's
 * `/setup` flow already has its own bespoke multi-step form
 * (see src/routes/_authenticated/setup.tsx); this is provided as a
 * reusable alternative/building block for a future onboarding surface.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CheckCircle2, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/utils";

export type OnboardingFocusOption = { id: string; label: string };

export type OnboardingSetupProps = {
  title: string;
  subtitle: string;
  focusOptions: OnboardingFocusOption[];
  selectedFocus: string;
  onFocusChange: (id: string) => void;
  revenue: string;
  onRevenueChange: (value: string) => void;
  role: string;
  onRoleChange: (value: string) => void;
  step: number;
  totalSteps: number;
  onContinue: () => void;
  className?: string;
};

const REVENUE_OPTIONS = ["$100k – $200k", "$200k – $500k", "$500k+"];

export function OnboardingSetup({
  title,
  subtitle,
  focusOptions,
  selectedFocus,
  onFocusChange,
  revenue,
  onRevenueChange,
  role,
  onRoleChange,
  step,
  totalSteps,
  onContinue,
  className,
}: OnboardingSetupProps) {
  const [isRevenueOpen, setIsRevenueOpen] = useState(false);
  const revenueRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  useClickOutside(revenueRef, () => setIsRevenueOpen(false));

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "w-full max-w-2xl rounded-3xl border-2 border-border bg-muted p-1.5 shadow-xl",
        className,
      )}
    >
      <div className="flex flex-col rounded-2xl bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-medium text-foreground sm:text-2xl">{title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>

        <div className="my-5 border-t border-dashed border-border" />

        <div className="grow">
          <p className="mb-4 text-sm text-muted-foreground">Your main focus</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Main focus">
            {focusOptions.map((option) => {
              const active = option.id === selectedFocus;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onFocusChange(option.id)}
                  className={cn(
                    "relative flex grow items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grow-0",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/30",
                  )}
                >
                  {active ? <CheckCircle2 className="size-4" aria-hidden="true" /> : null}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="onboarding-revenue">
              Monthly revenue
            </label>
            <div className="relative mt-2" ref={revenueRef}>
              <button
                id="onboarding-revenue"
                type="button"
                onClick={() => setIsRevenueOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={isRevenueOpen}
                className="relative h-10 w-full rounded-full border border-border bg-background pl-6 pr-12 text-left text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block truncate">{revenue || "Select revenue"}</span>
                <ChevronDown
                  className={cn(
                    "absolute right-5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-transform",
                    isRevenueOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
              <AnimatePresence>
                {isRevenueOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    role="listbox"
                    className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-2xl"
                  >
                    {REVENUE_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="option"
                        aria-selected={revenue === option}
                        onClick={() => {
                          onRevenueChange(option);
                          setIsRevenueOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs transition-colors hover:bg-accent"
                      >
                        <span
                          className={
                            revenue === option
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {option}
                        </span>
                        {revenue === option ? (
                          <Check className="size-3.5" aria-hidden="true" />
                        ) : null}
                      </button>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground" htmlFor="onboarding-role">
              Your role
            </label>
            <input
              id="onboarding-role"
              value={role}
              onChange={(e) => onRoleChange(e.target.value)}
              placeholder="e.g. Sales Manager"
              className="mt-2 h-10 w-full rounded-full border border-border bg-background px-6 text-left text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>
              Step {step} / {totalSteps}
            </span>
            <div className="ml-2 flex gap-1" aria-hidden="true">
              {Array.from({ length: totalSteps }, (_, i) => (
                <span
                  key={i}
                  className={cn("h-4 w-1 rounded-full", i < step ? "bg-primary" : "bg-border")}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onContinue}
            className="h-10 w-full rounded-full bg-primary px-8 text-xs font-medium text-primary-foreground shadow-lg transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] sm:w-auto"
          >
            Continue
          </button>
        </div>
      </div>
    </motion.div>
  );
}
