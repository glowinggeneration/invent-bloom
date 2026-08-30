import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PERFORMANCE_HELP } from "@/lib/performance-help";

/**
 * Small (i) button that reveals a plain-language definition in a floating
 * popover, plus a link to the full glossary. Floating keeps narrow columns
 * from reflowing when the definition opens.
 */
export function MetricInfo({
  term,
  definition,
  className,
}: {
  term: string;
  definition?: string;
  className?: string;
  /** Deprecated: glossary now opens as a modal. */
  glossaryTargetId?: string;
}) {
  const text = definition ?? PERFORMANCE_HELP[term];
  if (!text) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What ${term} means`}
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={12}
        className="w-64 rounded-xl p-3"
      >
        <p className="type-meta font-medium text-foreground">{term}</p>
        <p className="mt-1 type-meta leading-relaxed text-muted-foreground">{text}</p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-glossary"))}
          className="mt-2 type-meta font-medium text-foreground underline underline-offset-2 hover:no-underline"
        >
          See glossary
        </button>
      </PopoverContent>
    </Popover>
  );
}

/** Label with an inline info affordance, for stat cards and section headers. */
export function LabelWithInfo({
  label,
  term,
  className,
}: {
  label: string;
  term?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span className="truncate">{label}</span>
      <MetricInfo term={term ?? label} />
    </span>
  );
}
