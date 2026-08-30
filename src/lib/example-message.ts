export const EXAMPLE_CLUSTERS = [
  "Football & Fandom",
  "Youth & Culture",
  "Creative & Media",
] as const;

export const EXAMPLE_MESSAGE_TEXT = `Harambee Stars vs Ivory Coast has moved to Kasarani Stadium this Saturday, kick-off 4pm. Tickets bought for Nyayo remain valid - no need to re-book. Gates open at 1pm and matatu drop-off is at Gate C.

Panel focus: ${EXAMPLE_CLUSTERS.join(", ")} - Nairobi and urban Kenya, 18-40, English and Sheng mix.
Goal: keep ticket holders calm, avoid backlash about the late venue change, and drive attendance.`;

const KEY = "fkf.testing.exampleDraft";

export function stashExampleMessage() {
  try {
    localStorage.setItem(KEY, EXAMPLE_MESSAGE_TEXT);
  } catch {
    /* ignore */
  }
}

export function takeExampleMessage(): string | null {
  try {
    const value = localStorage.getItem(KEY);
    if (value) localStorage.removeItem(KEY);
    return value;
  } catch {
    return null;
  }
}
