import { forwardRef } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

interface AnimatedThemeTogglerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isDark: boolean;
  toggle: () => void;
}

/**
 * Theme toggle with a circular reveal expanding from the button, via the
 * View Transitions API. Wraps this app's own useTheme() (persisted, synced
 * with the pre-hydration script in __root.tsx) rather than owning its own
 * dark-mode state. Falls back to a plain instant toggle when the browser
 * lacks View Transitions or the visitor prefers reduced motion.
 */
export const AnimatedThemeToggler = forwardRef<HTMLButtonElement, AnimatedThemeTogglerProps>(
  function AnimatedThemeToggler({ isDark, toggle, className, ...props }, ref) {
    const prefersReducedMotion = useReducedMotion();

    async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
      const button = event.currentTarget;
      const doc = document as ViewTransitionDocument;

      if (prefersReducedMotion || typeof doc.startViewTransition !== "function") {
        toggle();
        return;
      }

      const transition = doc.startViewTransition(() => {
        flushSync(() => toggle());
      });

      try {
        await transition.ready;
      } catch {
        return;
      }

      const { top, left, width, height } = button.getBoundingClientRect();
      const x = left + width / 2;
      const y = top + height / 2;
      const maxRad = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRad}px at ${x}px ${y}px)`] },
        { duration: 600, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" },
      );
    }

    return (
      <button ref={ref} type="button" onClick={handleClick} className={cn(className)} {...props}>
        {isDark ? (
          <Sun className="size-[18px]" aria-hidden="true" />
        ) : (
          <Moon className="size-[18px]" aria-hidden="true" />
        )}
      </button>
    );
  },
);
