import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import confetti from "canvas-confetti";
import type { CreateTypes, Options as ConfettiOptions } from "canvas-confetti";

import { cn } from "@/lib/utils";

/**
 * SMAIT brand palette, converted from the app's oklch design tokens
 * (src/styles.css, .dark block) to literal hex — canvas-confetti can't
 * read CSS custom properties.
 *   --brand-pink oklch(0.647 0.241 13.3) -> #fe2762
 *   --primary    oklch(0.595 0.241 13.3) -> #ea0053
 *   --x-blue     oklch(0.68  0.18  245)  -> #009ffe
 *   --brand-navy oklch(0.218 0.054 244)  -> #001c31
 */
const SMAIT_CONFETTI_COLORS = ["#fe2762", "#ea0053", "#009ffe", "#001c31"];

export interface ConfettiRef {
  fire: (options?: ConfettiOptions) => void;
}

export interface ConfettiProps extends React.HTMLAttributes<HTMLCanvasElement> {
  options?: ConfettiOptions;
}

/**
 * Canvas-based confetti burst, scoped to its own canvas element. Render it
 * once, keep a ref to it, and call `.fire()` at the exact moment something
 * worth celebrating happens. Does not fire on mount or on its own — purely
 * imperative.
 */
export const Confetti = forwardRef<ConfettiRef, ConfettiProps>(function Confetti(
  { className, options, ...rest },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<CreateTypes | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    instanceRef.current = confetti.create(canvas, {
      resize: true,
      useWorker: true,
    });
    return () => {
      instanceRef.current?.reset();
      instanceRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      fire: (fireOptions) => {
        void instanceRef.current?.({
          particleCount: 120,
          spread: 90,
          startVelocity: 45,
          origin: { y: 0.6 },
          colors: SMAIT_CONFETTI_COLORS,
          ...options,
          ...fireOptions,
        });
      },
    }),
    [options],
  );

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      {...rest}
    />
  );
});
