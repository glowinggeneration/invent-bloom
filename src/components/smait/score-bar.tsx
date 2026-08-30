import { cn } from "@/lib/utils";

export function ScoreBar({
  label,
  value,
  tone,
  invert,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger" | "neutral";
  invert?: boolean; // when true, higher = worse (confusion/risk)
}) {
  const auto: typeof tone = invert
    ? value >= 40
      ? "danger"
      : value >= 25
        ? "warning"
        : "success"
    : value >= 70
      ? "success"
      : value >= 50
        ? "warning"
        : "danger";
  const resolved = tone ?? auto;
  const barColor = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    neutral: "bg-primary",
  }[resolved];
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-foreground">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
