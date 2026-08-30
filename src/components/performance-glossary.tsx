import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PERFORMANCE_GLOSSARY } from "@/lib/performance-help";

/**
 * Metric glossary shown as a modal. Opens when the header button is clicked,
 * or when an inline `MetricInfo` "See glossary" link dispatches the
 * `open-glossary` event.
 */
export function PerformanceGlossary({ id = "performance-glossary" }: { id?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-glossary", onOpen);
    return () => window.removeEventListener("open-glossary", onOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          id={id}
          className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card p-4 text-left type-card transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
          Glossary: what each metric means
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
            Metric glossary
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {PERFORMANCE_GLOSSARY.map((group) => (
            <div key={group.group}>
              <h4 className="type-meta font-semibold uppercase tracking-wide text-muted-foreground">
                {group.group}
              </h4>
              <dl className="mt-2 space-y-2">
                {group.terms.map((t) => (
                  <div key={t.term} className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
                    <dt className="type-body font-medium text-foreground">{t.term}</dt>
                    <dd className="type-meta text-muted-foreground">{t.definition}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
