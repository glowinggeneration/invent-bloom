import type { TooltipProps } from "recharts";

type Payload = { name?: string; value?: number | string; payload?: Record<string, unknown> };

/**
 * Shared recharts tooltip that pairs the number with a plain-language
 * explanation of what the metric means for the results.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  suffix = "",
  valueLabel,
  help,
}: TooltipProps<number, string> & {
  suffix?: string;
  /** Word used for the value, e.g. "personas". */
  valueLabel?: string;
  /** Lookup by label, or a single explanation for the whole chart. */
  help: Record<string, string> | string;
}) {
  if (!active || !payload?.length) return null;
  const first = payload[0] as Payload;
  const title = String(label ?? first.name ?? "");
  const explanation = typeof help === "string" ? help : help[title];
  const full = (first.payload?.["full"] as string | undefined) ?? title;

  return (
    <div className="max-w-[15rem] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
      <p className="type-card">{full}</p>
      <p className="mt-0.5 type-body font-semibold">
        {first.value}
        {suffix}
        {valueLabel ? ` ${valueLabel}` : ""}
      </p>
      {explanation && <p className="mt-1.5 type-meta text-muted-foreground">{explanation}</p>}
    </div>
  );
}
