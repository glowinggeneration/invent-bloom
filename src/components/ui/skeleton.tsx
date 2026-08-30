import { cn } from "@/lib/utils";

/**
 * A single placeholder block. Purely decorative - screen readers should
 * skip it and rely on the loading region's `aria-busy` + status text
 * instead, so it's hidden by default. Animation already respects
 * `prefers-reduced-motion` via the global rule in styles.css.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  );
}

/**
 * Wraps a loading region: marks it `aria-busy` and gives assistive tech a
 * single polite status announcement, while the skeleton blocks inside stay
 * hidden from the accessibility tree. Use around any group of Skeleton
 * blocks that stands in for real content while data loads.
 */
function SkeletonRegion({
  label = "Loading",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** A row of skeleton lines shaped like a list item: avatar + two text lines. */
function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 py-3", className)}>
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}

/** A stack of list-item skeletons, sized to match a real list's row count. */
function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-border", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

/** A card-shaped skeleton: title bar, a couple of text lines, and a body block. */
function SkeletonCard({
  className,
  bodyHeight = "h-24",
}: {
  className?: string;
  bodyHeight?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="mt-2 h-3 w-3/5" />
      <Skeleton className={cn("mt-4 w-full rounded-xl", bodyHeight)} />
    </div>
  );
}

/** A table-shaped skeleton: header row plus a fixed number of body rows. */
function SkeletonTable({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border", className)}>
      <div className="flex gap-4 border-b border-border bg-muted/40 px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: columns }, (_, c) => (
              <Skeleton key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export { Skeleton, SkeletonRegion, SkeletonListItem, SkeletonList, SkeletonCard, SkeletonTable };
