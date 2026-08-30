import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function Shimmer({ className }: { className?: string }) {
  return <Skeleton className={className} />;
}

function LoadingCaption({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden /> {children}
    </p>
  );
}

/** Placeholder for the analysis (thread) view while the saved test loads. */
export function AnalysisSkeleton() {
  return (
    <div className="animate-in fade-in duration-300">
      <LoadingCaption>Getting this test ready…</LoadingCaption>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <div className="flex justify-end">
            <Shimmer className="h-20 w-3/5 rounded-2xl rounded-br-md" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-5">
              <Shimmer className="size-24 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <Shimmer className="h-4 w-2/5" />
                <Shimmer className="h-3 w-4/5" />
                <Shimmer className="h-3 w-3/5" />
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Shimmer key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <Shimmer className="h-4 w-40" />
            <Shimmer className="mt-4 h-56 w-full rounded-2xl" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Shimmer key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <Shimmer className="h-44 rounded-2xl" />
          <Shimmer className="h-64 rounded-2xl" />
        </aside>
      </div>
    </div>
  );
}

/** Placeholder for the recommendations view while suggestions load. */
export function RecommendationsSkeleton() {
  return (
    <div className="animate-in fade-in duration-300">
      <LoadingCaption>Putting together your three recommendations…</LoadingCaption>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Shimmer key={i} className="h-24 rounded-2xl" />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <Shimmer className="h-5 w-24 rounded-full" />
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-24 w-full rounded-xl" />
            <Shimmer className="h-3 w-full" />
            <Shimmer className="h-3 w-2/3" />
            <div className="flex gap-2 pt-1">
              <Shimmer className="h-8 w-24 rounded-full" />
              <Shimmer className="h-8 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
