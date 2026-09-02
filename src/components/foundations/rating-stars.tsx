import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-5",
} as const;

export type RatingStarsProps = {
  rating: number;
  max?: number;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  label?: string;
};

export function RatingStars({ rating, max = 5, size = "sm", className, label }: RatingStarsProps) {
  const safeMax = Math.max(1, Math.round(max));
  const safeRating = Math.min(Math.max(rating, 0), safeMax);
  const accessibleLabel = label ?? `${safeRating.toFixed(1)} out of ${safeMax}`;

  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-primary", className)}
      role="img"
      aria-label={accessibleLabel}
    >
      {Array.from({ length: safeMax }, (_, index) => {
        const fill = Math.min(Math.max(safeRating - index, 0), 1) * 100;
        return (
          <span key={index} className={cn("relative inline-flex", SIZE_CLASSES[size])}>
            <Star
              aria-hidden="true"
              className="absolute inset-0 size-full fill-muted text-border"
            />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${fill}%` }}
            >
              <Star className="size-full fill-current" />
            </span>
          </span>
        );
      })}
    </span>
  );
}
