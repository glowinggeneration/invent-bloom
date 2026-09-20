import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import confetti from "canvas-confetti";
import type { CreateTypes, Options as ConfettiOptions } from "canvas-confetti";

import { cn } from "@/lib/utils";

/**
 * Apple's own system-color set (systemBlue, systemGreen, systemOrange,
 * systemPurple) — canvas-confetti can't read CSS custom properties, so
 * these are the literal hex values rather than a reference to
 * src/styles.css's oklch tokens.
 */
const SMAIT_CONFETTI_COLORS = ["#0A84FF", "#30D158", "#FF9F0A", "#BF5AF2"];

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
