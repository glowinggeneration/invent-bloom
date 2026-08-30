import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { GLOSSARY } from "@/lib/chart-help";

/**
 * Collapsed by default. Lists every chart metric with a plain-language
 * definition so the numbers can be read without hovering a chart.
 */
export function MetricGlossary() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-border bg-card">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="metric-glossary"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-2xl p-4 text-left type-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
            Glossary: what each metric means
          </span>
          <ChevronDown
            className={
              open ? "size-4 rotate-180 transition-transform" : "size-4 transition-transform"
            }
            aria-hidden="true"
          />
        </button>
      </h3>
      <div id="metric-glossary" hidden={!open} className="space-y-5 px-4 pb-4">
        {GLOSSARY.map((group) => (
          <div key={group.group}>
            <h4 className="type-meta font-semibold uppercase tracking-wide text-muted-foreground">
              {group.group}
            </h4>
            <dl className="mt-2 space-y-2">
              {group.terms.map((t) => (
                <div key={t.term} className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
                  <dt className="type-body font-medium text-foreground">{t.term}</dt>
                  <dd className="type-meta text-muted-foreground">{t.definition}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
