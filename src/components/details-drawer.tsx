import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Rendered inside the sticky header, under the title. */
  actions?: ReactNode;
  children: ReactNode;
};

const DISMISS_PX = 90;

/**
 * Right-side slide-over that goes full-screen on mobile with a sticky header
 * and a drag handle: swipe right (or drag the handle) to close.
 */
export function DetailsDrawer({
  open,
  onOpenChange,
  title,
  description,
  actions,
  children,
}: Props) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = start.current;
    const t = e.touches[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Only treat mostly-horizontal, rightward drags as a dismiss gesture.
    if (dx <= 0 || Math.abs(dx) < Math.abs(dy)) return;
    setDragX(dx);
  }

  function onTouchEnd() {
    if (dragX > DISMISS_PX) onOpenChange(false);
    setDragX(0);
    start.current = null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // Full-screen on phones, panel from md up. Padding lives on the inner
        // sections so the header can sit flush and sticky.
        className="inset-0 flex h-dvh w-full max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:max-w-xl sm:border-l lg:max-w-2xl [&>button]:hidden"
        style={{
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: dragX ? "none" : undefined,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <SheetHeader className="sticky top-0 z-10 space-y-0 border-b border-border bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-left backdrop-blur sm:px-6">
          {/* Grab handle: a visual affordance for the swipe gesture on touch. */}
          <div
            className="mx-auto mb-2 h-1 w-10 rounded-full bg-border sm:hidden"
            aria-hidden="true"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate">{title}</SheetTitle>
              {description ? (
                <SheetDescription className="mt-1">{description}</SheetDescription>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-5" aria-hidden="true" />
              <span className="sr-only">Close details</span>
            </Button>
          </div>
          {actions ? <div className="mt-3">{actions}</div> : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** True from the xl breakpoint up, after hydration. */
export function useWideScreen() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

/**
 * Details surface that is always visible as a sticky right column on wide
 * screens, and falls back to the slide-over on smaller ones.
 */
export function DetailsPanel({ open, onOpenChange, title, description, actions, children }: Props) {
  const wide = useWideScreen();

  if (wide) {
    return (
      <aside className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border border-border/60 bg-card p-4 text-[13px] [&_.card-surface]:border-border/60 [&_h3]:text-sm">
        <header className="mb-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
          ) : null}
          {actions ? <div className="mt-3">{actions}</div> : null}
        </header>
        {children}
      </aside>
    );
  }

  return (
    <DetailsDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      {...(description === undefined ? {} : { description })}
      {...(actions === undefined ? {} : { actions })}
    >
      {children}
    </DetailsDrawer>
  );
}
