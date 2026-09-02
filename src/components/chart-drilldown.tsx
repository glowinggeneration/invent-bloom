import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ProgressiveBlur } from "@/components/core/progressive-blur";
import type { Analysis } from "@/lib/analysis";

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "var(--positive)",
  neutral: "var(--neutral)",
  negative: "var(--negative)",
};

export type Drilldown = {
  title: string;
  subtitle?: string;
  stats: { label: string; value: string }[];
  personas: Analysis["personaReactions"];
};

export function ChartDrilldown({
  drill,
  onOpenChange,
}: {
  drill: Drilldown | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer open={!!drill} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base">{drill?.title}</DrawerTitle>
          {drill?.subtitle && (
            <DrawerDescription className="text-xs">{drill.subtitle}</DrawerDescription>
          )}
        </DrawerHeader>
        <div className="relative min-h-0 overflow-hidden">
          <div className="max-h-[65vh] overflow-y-auto px-4 pb-12 pt-5">
            {drill && drill.stats.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {drill.stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-card p-2.5">
                    <p className="text-lg font-bold leading-tight text-foreground">{s.value}</p>
                    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {drill && drill.personas.length > 0 ? (
              <ul className="mt-3 divide-y divide-border">
                {drill.personas.slice(0, 12).map((r) => (
                  <li key={r.personaId} className="flex items-start gap-2.5 py-2.5">
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ background: SENTIMENT_COLOR[r.sentiment] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                      <p className="text-xs text-muted-foreground">“{r.reaction}”</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{r.score}</span>
                  </li>
                ))}
              </ul>
            ) : (
              drill && (
                <p className="mt-3 text-sm text-muted-foreground">
                  No personas matched this slice.
                </p>
              )
            )}
          </div>
          <ProgressiveBlur height="1.5rem" blurAmount="4px" />
          <ProgressiveBlur position="bottom" height="2.5rem" blurAmount="5px" />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
