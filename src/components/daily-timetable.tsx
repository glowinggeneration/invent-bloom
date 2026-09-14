import { useMemo } from "react";
import type { AlwaysOnPlanView, AlwaysOnPostView } from "@/lib/always-on-view";
import { STATUS_LABELS } from "@/lib/always-on-view";
import { AnimatedTooltip } from "@/components/vengeance/animated-tooltip";
import { cn } from "@/lib/utils";

/**
 * A visual day-timetable for the always-on posting schedule - the portable
 * rebuild of a Framer marketplace "InteractiveTimetable" component (Framer's
 * own component code isn't accessible outside its runtime). One row per
 * account/persona, posts positioned along a shared hour axis by their
 * actual scheduledAt time and colored by status.
 *
 * Reads AlwaysOnPlanView[] (src/lib/always-on-view.ts), already returned in
 * full by the existing listAlwaysOnPlans() server function - this is purely
 * a new way of displaying data the app already fetches, not a new data path.
 */

const STATUS_STYLE: Record<AlwaysOnPostView["status"], string> = {
  scheduled: "bg-muted-foreground/60",
  held: "bg-amber-500",
  published: "bg-emerald-500",
  failed: "bg-destructive",
  skipped: "bg-muted-foreground/30",
};

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const DAY_SPAN_HOURS = DAY_END_HOUR - DAY_START_HOUR;

function hourFraction(iso: string): number {
  const d = new Date(iso);
  const hours = d.getHours() + d.getMinutes() / 60;
  return Math.min(1, Math.max(0, (hours - DAY_START_HOUR) / DAY_SPAN_HOURS));
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function DailyTimetable({ plans }: { plans: AlwaysOnPlanView[] }) {
  const hourMarks = useMemo(
    () => Array.from({ length: DAY_SPAN_HOURS + 1 }, (_, i) => DAY_START_HOUR + i),
    [],
  );

  if (plans.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="type-card font-semibold">Today's schedule</h2>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {(Object.keys(STATUS_LABELS) as AlwaysOnPostView["status"][]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span
                className={cn("size-2 rounded-full", STATUS_STYLE[status])}
                aria-hidden="true"
              />
              {STATUS_LABELS[status]}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px] px-4 py-3">
          <div className="relative ml-32 h-5 border-b border-border/70 sm:ml-40">
            {hourMarks.map((hour) => (
              <span
                key={hour}
                className="absolute -translate-x-1/2 text-[10px] text-muted-foreground"
                style={{ left: `${((hour - DAY_START_HOUR) / DAY_SPAN_HOURS) * 100}%` }}
              >
                {hour % 12 === 0 ? 12 : hour % 12}
                {hour < 12 ? "am" : "pm"}
              </span>
            ))}
          </div>

          <div className="mt-2 space-y-2">
            {plans.map((plan) => (
              <div key={plan.id} className="flex items-center gap-3">
                <div className="w-32 shrink-0 truncate text-xs font-medium sm:w-40">
                  {plan.personaName || plan.handle}
                  <span className="ml-1 text-muted-foreground">@{plan.handle}</span>
                </div>
                <div className="relative h-8 flex-1 rounded-lg bg-muted/40">
                  {plan.posts.map((post) => (
                    <div
                      key={post.id}
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${hourFraction(post.scheduledAt) * 100}%` }}
                    >
                      <AnimatedTooltip
                        variant="indis"
                        accentColor="var(--primary)"
                        content={
                          <span className="block text-left">
                            <span className="block font-semibold">
                              {STATUS_LABELS[post.status]}
                            </span>
                            <span className="block">{timeLabel(post.scheduledAt)}</span>
                            <span className="mt-1 block line-clamp-3">
                              {post.topic || post.content}
                            </span>
                          </span>
                        }
                      >
                        <span
                          className={cn(
                            "block size-3 rounded-full ring-2 ring-card",
                            STATUS_STYLE[post.status],
                          )}
                          aria-label={`${STATUS_LABELS[post.status]} at ${timeLabel(post.scheduledAt)}: ${post.topic || post.content}`}
                        />
                      </AnimatedTooltip>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
