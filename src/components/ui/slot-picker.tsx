/**
 * Weekly send-window picker. Each weekday can be switched on and given one or
 * more time ranges; campaigns are queued to start inside the next open window.
 */
import { Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { SendDay } from "@/lib/send-windows";
import { cn } from "@/lib/utils";

const spring = { type: "spring", stiffness: 500, damping: 30, mass: 1 } as const;

const newSlot = (from: string, to: string) => ({
  id: `${from}-${to}-${Math.random().toString(36).slice(2, 8)}`,
  from,
  to,
});

export function SlotPicker({
  days,
  onChange,
  className,
}: {
  days: SendDay[];
  onChange: (next: SendDay[]) => void;
  className?: string;
}) {
  const patch = (dayId: string, fn: (day: SendDay) => SendDay) =>
    onChange(days.map((day) => (day.id === dayId ? fn(day) : day)));

  const toggleDay = (day: SendDay) =>
    patch(day.id, (current) => {
      const enabled = !current.enabled;
      return {
        ...current,
        enabled,
        slots: enabled && current.slots.length === 0 ? [newSlot("09:00", "11:00")] : current.slots,
      };
    });

  const activeDays = days.filter((day) => day.enabled);

  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" aria-label="Preferred send days">
        {days.map((day) => (
          <button
            key={day.id}
            type="button"
            role="switch"
            aria-checked={day.enabled}
            aria-label={`Send on ${day.label}`}
            onClick={() => toggleDay(day)}
            className={cn(
              "min-h-11 rounded-xl border px-2 text-xs font-semibold transition-colors",
              day.enabled
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {day.label.slice(0, 3)}
          </button>
        ))}
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {activeDays.map((day) => (
          <motion.div
            layout
            key={day.id}
            initial={{ opacity: 0, scale: 0.98, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={spring}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{day.label}</span>
              <button
                type="button"
                aria-label={`Remove ${day.label} send windows`}
                onClick={() => toggleDay(day)}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <AnimatePresence mode="popLayout" initial={false}>
                {day.slots.map((slot) => (
                  <motion.div
                    key={slot.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: -6 }}
                    transition={spring}
                    className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-end gap-2"
                  >
                    <label className="space-y-1 text-xs text-muted-foreground">
                      <span className="block">From</span>
                      <input
                        type="time"
                        value={slot.from}
                        aria-label={`${day.label} window start`}
                        onChange={(e) =>
                          patch(day.id, (d) => ({
                            ...d,
                            slots: d.slots.map((s) =>
                              s.id === slot.id ? { ...s, from: e.target.value } : s,
                            ),
                          }))
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <span className="pb-3 text-xs text-muted-foreground">to</span>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      <span className="block">To</span>
                      <input
                        type="time"
                        value={slot.to}
                        aria-label={`${day.label} window end`}
                        onChange={(e) =>
                          patch(day.id, (d) => ({
                            ...d,
                            slots: d.slots.map((s) =>
                              s.id === slot.id ? { ...s, to: e.target.value } : s,
                            ),
                          }))
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <button
                      type="button"
                      aria-label="Remove window"
                      onClick={() =>
                        patch(day.id, (d) => {
                          const slots = d.slots.filter((s) => s.id !== slot.id);
                          return { ...d, slots, enabled: slots.length > 0 };
                        })
                      }
                      className="rounded-md bg-muted p-2.5 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              <motion.button
                layout
                type="button"
                transition={spring}
                onClick={() =>
                  patch(day.id, (d) => ({
                    ...d,
                    slots: [...d.slots, newSlot("14:00", "16:00")],
                  }))
                }
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-muted py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              >
                <Plus className="size-4" /> Add window
              </motion.button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {activeDays.length === 0 ? (
        <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          No preferred days selected. The campaign may start on any day.
        </p>
      ) : null}
    </div>
  );
}
