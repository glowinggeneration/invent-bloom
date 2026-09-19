import { cn } from "@/lib/utils";

const GRADIENT_ANGLES = { top: 0, right: 90, bottom: 180, left: 270 };

interface ProgressiveBlurProps {
  className?: string;
  position?: "top" | "right" | "bottom" | "left";
  height?: string;
  width?: string;
  blurLevels?: number[];
}

/**
 * Stacked, increasingly-blurred layers that fade toward one edge, so
 * scrollable content reads as trailing off under a soft blur rather than
 * being hard-clipped.
 */
export function ProgressiveBlur({
  className,
  position = "bottom",
  height = "30%",
  width,
  blurLevels = [0.5, 1, 2, 4, 8, 16],
}: ProgressiveBlurProps) {
  const angle = GRADIENT_ANGLES[position];
  const isVertical = position === "top" || position === "bottom";

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0",
        isVertical ? "inset-x-0" : "inset-y-0",
        className,
      )}
      style={{
        ...(isVertical
          ? { height, top: position === "top" ? 0 : undefined, bottom: position === "bottom" ? 0 : undefined }
          : { width, left: position === "left" ? 0 : undefined, right: position === "right" ? 0 : undefined }),
      }}
      aria-hidden="true"
    >
      {blurLevels.map((blur, index) => {
        const start = (index / blurLevels.length) * 100;
        const end = ((index + 2) / blurLevels.length) * 100;
        return (
          <div
            key={index}
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage: `linear-gradient(${angle}deg, transparent ${start}%, black ${Math.min(end, 100)}%)`,
              WebkitMaskImage: `linear-gradient(${angle}deg, transparent ${start}%, black ${Math.min(end, 100)}%)`,
            }}
          />
        );
      })}
    </div>
  );
}
