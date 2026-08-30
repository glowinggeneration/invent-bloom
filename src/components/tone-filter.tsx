import { detectTone, TONE_STYLE, type ToneLabel } from "@/lib/tone";
import { readablePostText } from "@/lib/tweet-text";
import { X } from "lucide-react";

/** Empty array means "all tones". Multiple tones can be active at once. */
export type ToneFilter = ToneLabel[];

/** True when the text's tone passes the current multi-select filter. */
export function matchesToneFilter(text: string | null | undefined, filter: ToneFilter): boolean {
  return filter.length === 0 || filter.includes(toneOf(text));
}

/** Same tone read the card shows, so chips and badges always agree. */
export function toneOf(text: string | null | undefined): ToneLabel {
  return detectTone(readablePostText(text ?? ""));
}

export function toneCounts(texts: (string | null | undefined)[]): Record<ToneLabel, number> {
  const counts = {
    Celebratory: 0,
    Supportive: 0,
    Urgent: 0,
    Playful: 0,
    Informative: 0,
    Critical: 0,
    Neutral: 0,
  } as Record<ToneLabel, number>;
  for (const t of texts) counts[toneOf(t)] += 1;
  return counts;
}

/** Quiet chip row: only tones actually present are offered. */
export function ToneFilterChips({
  value,
  onChange,
  counts,
  total,
  className = "",
}: {
  value: ToneFilter;
  onChange: (next: ToneFilter) => void;
  counts: Record<ToneLabel, number>;
  total: number;
  className?: string;
}) {
  const present = (Object.keys(counts) as ToneLabel[]).filter((t) => counts[t] > 0);
  if (present.length < 2) return null;

  const allActive = value.length === 0;
  const toggle = (t: ToneLabel) =>
    onChange(value.includes(t) ? value.filter((v) => v !== t) : [...value, t]);

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      role="group"
      aria-label="Filter by tone"
    >
      <button
        type="button"
        onClick={() => onChange([])}
        aria-pressed={allActive}
        className={`rounded-lg px-2.5 py-1 type-meta font-medium transition ${
          allActive
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground hover:text-foreground"
        }`}
      >
        All tones ({total})
      </button>
      {present.map((t) => {
        const active = value.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            aria-pressed={active}
            className={`rounded-lg px-2.5 py-1 type-meta font-medium transition ${TONE_STYLE[t]} ${
              active
                ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                : "opacity-80 hover:opacity-100"
            }`}
          >
            {t} ({counts[t]})
          </button>
        );
      })}
      {!allActive && (
        <button
          type="button"
          onClick={() => onChange([])}
          aria-label="Clear filters"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 type-meta font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
          Clear filters
        </button>
      )}
    </div>
  );
}
