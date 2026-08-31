/**
 * Weekly send windows.
 *
 * Operators can restrict a campaign to specific weekday time ranges. The queue
 * start time is moved forward to the next open window; pacing inside the window
 * is still handled by the existing spread/pacing rules.
 */

export type SendSlot = { id: string; from: string; to: string };
export type SendDay = {
  id: string;
  weekday: number;
  label: string;
  enabled: boolean;
  slots: SendSlot[];
};

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function defaultSendDays(): SendDay[] {
  return WEEKDAY_LABELS.map((label, weekday) => ({
    id: `day-${weekday}`,
    weekday,
    label,
    enabled: false,
    slots: [],
  }));
}

function minutesOf(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function hasOpenWindow(days: SendDay[]): boolean {
  return days.some((d) => d.enabled && d.slots.some((s) => minutesOf(s.from) !== null));
}

/**
 * The next moment inside an enabled window, searching up to 7 days ahead.
 * Returns `from` unchanged when no window is configured, or when `from`
 * already falls inside one.
 */
export function nextWindowStart(days: SendDay[], from: Date = new Date()): Date {
  if (!hasOpenWindow(days)) return from;

  for (let offset = 0; offset < 8; offset += 1) {
    const probe = new Date(from);
    probe.setDate(probe.getDate() + offset);
    const day = days.find((d) => d.weekday === probe.getDay());
    if (!day?.enabled) continue;

    const nowMinutes = offset === 0 ? from.getHours() * 60 + from.getMinutes() : 0;
    const candidates = day.slots
      .map((slot) => ({ start: minutesOf(slot.from), end: minutesOf(slot.to) }))
      .filter((s): s is { start: number; end: number } => s.start !== null && s.end !== null)
      .sort((a, b) => a.start - b.start);

    for (const slot of candidates) {
      if (offset === 0 && nowMinutes >= slot.start && nowMinutes < slot.end) return from;
      if (slot.start >= nowMinutes) {
        const at = new Date(probe);
        at.setHours(Math.floor(slot.start / 60), slot.start % 60, 0, 0);
        return at;
      }
    }
  }
  return from;
}

export function sendWindowSummary(days: SendDay[]): string {
  const active = days.filter((d) => d.enabled && d.slots.length > 0);
  if (active.length === 0) return "Any time";
  return active
    .map((d) => `${d.label.slice(0, 3)} ${d.slots.map((s) => `${s.from}–${s.to}`).join(", ")}`)
    .join(" · ");
}
