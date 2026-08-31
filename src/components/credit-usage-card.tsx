"use client";
/** Usage/billing summary card: consumption meter, recent activity table and quick actions. */
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronDown,
  Download,
  MoreVertical,
  Printer,
  RefreshCw,
  Share2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/utils";

export type UsageHistoryItem = {
  date: string;
  model: string;
  credits: string;
  cost: string;
};

export type CreditUsageCardProps = {
  usedCreditsPercent?: number;
  totalCreditsLabel?: string;
  creditsUsedLabel?: string;
  creditsLeftLabel?: string;
  usageHistory?: UsageHistoryItem[];
  onAutoSwitchChange?: (enabled: boolean) => void;
  onManagePlan?: () => void;
  onViewAll?: () => void;
  className?: string;
};

const PERIOD_OPTIONS = ["7 Days", "14 Days", "30 Days", "90 Days", "12 Months"];
const SEGMENTS = 40;

export function CreditUsageCard({
  usedCreditsPercent = 56.4,
  totalCreditsLabel = "100M credits",
  creditsUsedLabel = "56.4M",
  creditsLeftLabel = "43.6M",
  usageHistory = [],
  onAutoSwitchChange,
  onManagePlan,
  onViewAll,
  className,
}: CreditUsageCardProps) {
  const [autoSwitch, setAutoSwitch] = useState(true);
  const [activePopover, setActivePopover] = useState<"more" | "period" | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("30 Days");
  const [downloadDone, setDownloadDone] = useState(false);

  const moreRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);
  useClickOutside(moreRef, () => setActivePopover((prev) => (prev === "more" ? null : prev)));
  useClickOutside(periodRef, () => setActivePopover((prev) => (prev === "period" ? null : prev)));

  const handleToggleAutoSwitch = (checked: boolean) => {
    setAutoSwitch(checked);
    onAutoSwitchChange?.(checked);
  };

  const handleDownload = () => {
    const headers = ["Date", "Model", "Credits", "Cost"];
    const rows = usageHistory.map((r) => [r.date, r.model, r.credits, r.cost]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "credit-usage.csv";
    a.click();
    URL.revokeObjectURL(url);
    setDownloadDone(true);
    setTimeout(() => setDownloadDone(false), 2000);
  };

  useEffect(() => {
    if (!downloadDone) return;
    const timer = setTimeout(() => setDownloadDone(false), 2000);
    return () => clearTimeout(timer);
  }, [downloadDone]);

  return (
    <div
      className={cn(
        "w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col items-start justify-between gap-4 bg-muted/40 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Credits used
          </h3>
          <span className="text-2xl font-medium text-foreground sm:text-3xl">
            {usedCreditsPercent}%
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="max-w-[150px] text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Auto-switch to cheaper model at limit
          </span>
          <Switch
            checked={autoSwitch}
            onCheckedChange={handleToggleAutoSwitch}
            aria-label="Auto-switch to cheaper model"
          />
        </div>
      </div>

      <div
        className="flex h-3 gap-0.5 bg-muted/40 px-6"
        role="progressbar"
        aria-valuenow={usedCreditsPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const isFilled = i < (usedCreditsPercent / 100) * SEGMENTS;
          return (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-full transition-colors",
                isFilled ? "bg-primary" : "bg-border",
              )}
              aria-hidden="true"
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between bg-muted/40 px-6 py-4 text-[10px] font-bold">
        <span className="text-muted-foreground">
          {creditsUsedLabel} <span className="text-muted-foreground/60">/ {totalCreditsLabel}</span>
        </span>
        <span className="text-muted-foreground">{creditsLeftLabel} credits left</span>
      </div>

      <div className="border-b-2 border-dashed border-border" />

      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-6 py-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-foreground">Usage history</h4>
          <button
            type="button"
            onClick={onViewAll}
            className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View all
          </button>
        </div>

        <div ref={periodRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={activePopover === "period"}
            onClick={() => setActivePopover((prev) => (prev === "period" ? null : "period"))}
            className="flex items-center gap-1 rounded-xl border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {selectedPeriod}
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                activePopover === "period" && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
          <AnimatePresence>
            {activePopover === "period" ? (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-2xl border border-border bg-popover py-1.5 text-popover-foreground shadow-2xl"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selectedPeriod === opt}
                    onClick={() => {
                      setSelectedPeriod(opt);
                      setActivePopover(null);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2 text-left text-xs transition-colors hover:bg-accent",
                      selectedPeriod === opt ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {opt}
                    {selectedPeriod === opt ? (
                      <Check className="size-3" aria-hidden="true" />
                    ) : null}
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="overflow-x-auto bg-muted/40">
        <div className="min-w-[480px] space-y-0.5 border-b border-border px-6 py-2">
          <div className="grid grid-cols-4 px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            <span>Date</span>
            <span>Model</span>
            <span className="text-right">Credits</span>
            <span className="text-right">Cost</span>
          </div>
          {usageHistory.map((row, idx) => (
            <div
              key={idx}
              className="grid grid-cols-4 border-t border-border/60 px-1 py-2 text-[11px] text-muted-foreground"
            >
              <span>{row.date}</span>
              <span className="truncate pr-2 font-medium">{row.model}</span>
              <span className="text-right">{row.credits}</span>
              <span className="text-right font-bold">{row.cost}</span>
            </div>
          ))}
          {usageHistory.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No usage recorded yet.</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 bg-card px-6 py-4 sm:flex-row">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div ref={moreRef} className="relative flex items-center">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={activePopover === "more"}
              onClick={() => setActivePopover((prev) => (prev === "more" ? null : "more"))}
              aria-label="More options"
              className="flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreVertical className="size-4" aria-hidden="true" />
            </button>
            <AnimatePresence>
              {activePopover === "more" ? (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  role="menu"
                  className="absolute bottom-full left-0 z-50 mb-2 w-44 overflow-hidden rounded-2xl border border-border bg-popover py-1.5 text-popover-foreground shadow-2xl"
                >
                  {[
                    {
                      label: "Export CSV",
                      icon: <Download className="size-3" />,
                      action: handleDownload,
                    },
                    {
                      label: "Print",
                      icon: <Printer className="size-3" />,
                      action: () => {
                        window.print();
                        setActivePopover(null);
                      },
                    },
                    {
                      label: "Share report",
                      icon: <Share2 className="size-3" />,
                      action: () => setActivePopover(null),
                    },
                    {
                      label: "Refresh data",
                      icon: <RefreshCw className="size-3" />,
                      action: () => setActivePopover(null),
                    },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      role="menuitem"
                      onClick={opt.action}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent"
                    >
                      <span aria-hidden="true">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="h-4 w-px bg-border" aria-hidden="true" />

          <button
            type="button"
            onClick={handleDownload}
            aria-label="Download CSV"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download
              className={cn("size-4 transition-colors", downloadDone && "text-success")}
              aria-hidden="true"
            />
          </button>
        </div>

        <Button variant="outline" size="sm" onClick={onManagePlan}>
          Manage plan
        </Button>
      </div>
    </div>
  );
}
