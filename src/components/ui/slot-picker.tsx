/**
 * Weekly send-window picker. Each weekday can be switched on and given one or
 * more time ranges; campaigns are queued to start inside the next open window.
 */
import { Plus, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";

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

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <LayoutGroup>
        {days.map((day) => (
          <motion.div
            layout
            key={day.id}
            initial={false}
            transition={spring}
            className={cn(
              "overflow-hidden rounded-2xl border transition-colors",
              day.enabled ? "border-border bg-card shadow-sm" : "border-transparent bg-muted/50",
            )}
          >
            <motion.div
              layout
              transition={spring}
              className="flex h-14 items-center justify-between px-4"
            >
              <span className="text-sm font-semibold">{day.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={day.enabled}
                aria-label={`Send on ${day.label}`}
                onClick={() =>
                  patch(day.id, (d) => {
                    const enabled = !d.enabled;
                    return {
                      ...d,
                      enabled,
                      slots:
                        enabled && d.slots.length === 0 ? [newSlot("09:00", "11:00")] : d.slots,
                    };
                  })
                }
                className={cn(
                  "relative h-7 w-12 rounded-full transition-colors",
                  day.enabled ? "bg-primary" : "bg-muted-foreground/25",
                )}
              >
                <motion.span
                  layout
                  className="absolute left-1 top-1 size-5 rounded-full bg-background shadow-sm"
                  animate={{ x: day.enabled ? 20 : 0 }}
                  transition={spring}
                />
              </button>
            </motion.div>

            <AnimatePresence initial={false}>
              {day.enabled ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={spring}
                >
                  <div className="flex flex-col gap-2 px-4 pb-4">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {day.slots.map((slot) => (
                        <motion.div
                          key={slot.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95, y: -8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -8 }}
                          transition={spring}
                          className="flex items-center gap-2"
                        >
                          <span className="w-9 text-xs text-muted-foreground">From</span>
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
                            className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <span className="text-xs text-muted-foreground">To</span>
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
                            className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <button
                            type="button"
                            aria-label="Remove window"
                            onClick={() =>
                              patch(day.id, (d) => {
                                const slots = d.slots.filter((s) => s.id !== slot.id);
                                return { ...d, slots, enabled: slots.length > 0 };
                              })
                            }
                            className="rounded-md bg-muted p-2 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
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
                      className="mt-1 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-muted py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                    >
                      <Plus className="size-4" /> Add window
                    </motion.button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ))}
      </LayoutGroup>
    </div>
  );
}
