/**
 * Animated launch control: post immediately, or open a date + time picker and
 * schedule the campaign start. Tokenised so it follows the workspace theme.
 */
import { CalendarClock, Loader2, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

import { TimeMaskInput } from "@/components/core/time-mask-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const spring = { type: "spring", stiffness: 400, damping: 32 } as const;

function todayISO() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function nextHour() {
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);
  return `${String(now.getHours()).padStart(2, "0")}:00:00`;
}

export function ScheduleLauncher({
  busy,
  disabled,
  launchLabel,
  onLaunch,
  onSchedule,
  className,
}: {
  busy: boolean;
  disabled: boolean;
  launchLabel: string;
  onLaunch: () => void;
  onSchedule: (at: Date) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nextHour());

  const at = useMemo(() => {
    const parsed = new Date(`${date}T${time}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [date, time]);

  const valid = at !== null && at.getTime() > Date.now() - 60_000;

  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={disabled || busy} onClick={onLaunch}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {launchLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-4" /> : <CalendarClock className="size-4" />}
          {open ? "Cancel schedule" : "Schedule for later"}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="schedule"
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" htmlFor="schedule-date">
                    Start date
                  </label>
                  <input
                    id="schedule-date"
                    type="date"
                    value={date}
                    min={todayISO()}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <TimeMaskInput
                  label="Start time"
                  value={time}
                  onChange={(next) => setTime(next)}
                  className="max-w-none space-y-1.5"
                />
              </div>

              <Button
                className="w-full"
                disabled={disabled || busy || !valid}
                onClick={() => at && onSchedule(at)}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarClock className="size-4" />
                )}
                Schedule campaign
              </Button>

              <p className="text-[11px] text-muted-foreground">
                {valid && at
                  ? `Will start on ${at.toLocaleDateString()} at ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
                  : "Pick a date and time in the future."}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
