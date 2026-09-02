import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
} as const;

export type LoadingIndicatorProps = {
  type?: "dot-circle" | "spinner";
  size?: keyof typeof SIZE_CLASSES;
  label?: string;
  className?: string;
};

/** A compact, accessible loading mark for inline actions and data regions. */
export function LoadingIndicator({
  type = "dot-circle",
  size = "md",
  label = "Loading",
  className,
}: LoadingIndicatorProps) {
  if (type === "spinner") {
    return (
      <span
        role="status"
        aria-label={label}
        className={cn(
          "inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none",
          SIZE_CLASSES[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "relative inline-block shrink-0 animate-spin text-primary motion-reduce:animate-none",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {Array.from({ length: 8 }).map((_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="absolute left-[46%] top-0 h-[28%] w-[12%] origin-[50%_180%] rounded-full bg-current"
          style={{
            opacity: 0.25 + index * 0.095,
            transform: `rotate(${index * 45}deg)`,
          }}
        />
      ))}
    </span>
  );
}
