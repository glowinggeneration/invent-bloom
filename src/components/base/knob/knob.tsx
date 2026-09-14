import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A rotary dial control - the portable rebuild of a Framer marketplace
 * "IOKnob" component (Framer's own component code isn't accessible outside
 * its runtime). Matches Slider's prop contract exactly
 * (src/components/base/slider/slider.tsx) so it's a drop-in swap anywhere
 * a single bounded numeric value is picked.
 *
 * Interaction: click-and-drag vertically to change the value (the common
 * web "knob" convention - dragging in a circle is unreliable with a mouse),
 * plus arrow-key support for accessibility. Exposes role="slider" with the
 * standard aria-value* triad.
 */

export type KnobProps = {
  id?: string;
  label?: string;
  "aria-label"?: string;
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  /** Diameter in px. @default 64 */
  size?: number;
};

const SWEEP_START = -135; // degrees, pointing down-left
const SWEEP_END = 135; // degrees, pointing down-right
const SWEEP_RANGE = SWEEP_END - SWEEP_START;
const PIXELS_PER_STEP_RANGE = 120; // full drag distance (px) to sweep min..max

export function Knob({
  id,
  label,
  "aria-label": ariaLabel,
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue = min,
  onValueChange,
  formatValue = String,
  disabled,
  className,
  size = 64,
}: KnobProps) {
  const generatedId = useId();
  const knobId = id ?? generatedId;
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const dragState = useRef<{ startY: number; startValue: number } | null>(null);

  useEffect(() => {
    if (value !== undefined) setInternalValue(value);
  }, [value]);

  const currentValue = value ?? internalValue;

  const commit = useCallback(
    (next: number) => {
      const clamped = Math.min(max, Math.max(min, Math.round(next / step) * step));
      if (value === undefined) setInternalValue(clamped);
      if (clamped !== currentValue) onValueChange?.(clamped);
    },
    [currentValue, max, min, onValueChange, step, value],
  );

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    dragState.current = { startY: event.clientY, startValue: currentValue };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return;
    const deltaY = dragState.current.startY - event.clientY;
    const range = max - min;
    const next = dragState.current.startValue + (deltaY / PIXELS_PER_STEP_RANGE) * range;
    commit(next);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current) (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    dragState.current = null;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      commit(currentValue + step);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      commit(currentValue - step);
    } else if (event.key === "Home") {
      event.preventDefault();
      commit(min);
    } else if (event.key === "End") {
      event.preventDefault();
      commit(max);
    }
  }

  const percent = max === min ? 0 : (currentValue - min) / (max - min);
  const angle = SWEEP_START + percent * SWEEP_RANGE;
  const displayValue = formatValue(currentValue);

  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const arcStart = polarPoint(cx, cy, r, SWEEP_START);
  const arcEnd = polarPoint(cx, cy, r, angle);
  const largeArc = angle - SWEEP_START > 180 ? 1 : 0;

  return (
    <div className={cn("inline-flex flex-col items-center gap-1.5", className)}>
      <div
        id={knobId}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel ?? label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={currentValue}
        aria-valuetext={displayValue}
        aria-disabled={disabled}
        aria-orientation="vertical"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative touch-none select-none rounded-full outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-ns-resize",
        )}
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="pointer-events-none"
        >
          <path
            d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 1 1 ${polarPoint(cx, cy, r, SWEEP_END).x} ${polarPoint(cx, cy, r, SWEEP_END).y}`}
            fill="none"
            stroke="var(--border)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <path
            d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <circle
            cx={cx}
            cy={cy}
            r={r - 8}
            fill="var(--card)"
            stroke="var(--border)"
            strokeWidth={1}
          />
          <line
            x1={cx}
            y1={cy}
            x2={polarPoint(cx, cy, r - 12, angle).x}
            y2={polarPoint(cx, cy, r - 12, angle).y}
            stroke="var(--primary)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </svg>
      </div>
      {label ? <span className="type-meta font-medium text-muted-foreground">{label}</span> : null}
      <span className="type-meta font-semibold text-foreground">{displayValue}</span>
    </div>
  );
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
