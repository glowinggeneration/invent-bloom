/**
 * A live-feeling feed of persona reactions shown during the "Collecting
 * persona reactions" loading stage of the message-testing flow. Draws on
 * the real PERSONAS dataset and shows only neutral, in-progress status
 * lines ("reviewing your message") — the real analysis hasn't run yet at
 * this point, so no opinions or verdicts are fabricated here.
 */
import { useMemo } from "react";

import { AnimatedList } from "@/registry/magicui/animated-list";
import { PERSONAS } from "@/lib/personas";

const STATUS_LINES = [
  "reviewing your message",
  "is weighing in",
  "reading it closely",
  "forming a first impression",
  "taking a look",
];

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = temp;
  }
  return arr;
}

const FEED_SIZE = 18;

export function PersonaReactionFeed() {
  const feed = useMemo(() => {
    const picks = shuffled(PERSONAS).slice(0, FEED_SIZE);
    return picks.map((persona, i) => ({
      persona,
      status: STATUS_LINES[i % STATUS_LINES.length],
    }));
  }, []);

  return (
    <div className="mt-6 w-full max-w-md">
      <AnimatedList delay={800} className="max-h-72 overflow-hidden">
        {feed.map(({ persona, status }) => (
          <div
            key={persona.id}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {persona.name.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {persona.name}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  · {persona.segment}
                </span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">{status}</span>
            </span>
          </div>
        ))}
      </AnimatedList>
    </div>
  );
}
