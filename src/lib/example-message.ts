import { readWithLegacyKey } from "@/lib/legacy-storage";

export const EXAMPLE_CLUSTERS = ["Loyal Fans", "Local Community", "Media & Press"] as const;

export const EXAMPLE_MESSAGE_TEXT = `Saturday's event has moved to the Riverside venue, doors at 4pm. Tickets bought for the original venue remain valid - no need to re-book. Parking opens at 1pm and drop-off is at Gate C.

Panel focus: ${EXAMPLE_CLUSTERS.join(", ")} - urban audience, 18-40, mixed formal and casual tone.
Goal: keep ticket holders calm, avoid backlash about the late venue change, and drive attendance.`;

const KEY = "smait.testing.exampleDraft";
const LEGACY_KEY = "fkf.testing.exampleDraft";

export function stashExampleMessage() {
  try {
    localStorage.setItem(KEY, EXAMPLE_MESSAGE_TEXT);
  } catch {
    /* ignore */
  }
}

export function takeExampleMessage(): string | null {
  try {
    const value = readWithLegacyKey(KEY, LEGACY_KEY);
    if (value) {
      localStorage.removeItem(KEY);
      localStorage.removeItem(LEGACY_KEY);
    }
    return value;
  } catch {
    return null;
  }
}
