import { useId, useState } from "react";
import { Info, Table2 } from "lucide-react";

/**
 * Info affordance that works with hover, keyboard focus and screen readers.
 * The explanation is linked with aria-describedby so it is announced on focus,
 * and Escape dismisses the visible bubble for sighted keyboard users.
 */
export function ChartHelpButton({ title, help }: { title: string; help: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className="group/help relative inline-flex">
      <button
        type="button"
        aria-label={`What ${title} means`}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute left-0 top-7 z-20 w-60 rounded-xl border border-border bg-popover p-3 type-meta text-muted-foreground shadow-lg transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        {help}
      </span>
    </span>
  );
}

export type ChartDatum = {
  /** Row label, e.g. "Clarity" or "Positive". */
  label: string;
  value: number | string;
  /** Plain-language meaning for this row. */
  note?: string | undefined;
};

/**
 * Keyboard and screen-reader equivalent of a chart tooltip: the same numbers
 * and plain-language notes as a real table. Always present in the accessibility
 * tree; sighted users can reveal it with the toggle.
 */
export function ChartDataTable({
  caption,
  rows,
  valueLabel = "Value",
  suffix = "",
}: {
  caption: string;
  rows: ChartDatum[];
  valueLabel?: string;
  suffix?: string;
}) {
  const [shown, setShown] = useState(false);
  const id = useId();

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-expanded={shown}
        aria-controls={id}
        className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 type-meta text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Table2 className="size-3.5" aria-hidden="true" />
        {shown ? "Hide data table" : "Show data table"}
      </button>
      <div id={id} className={shown ? "mt-2 overflow-x-auto" : "sr-only"}>
        <table className="w-full border-collapse type-meta">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-left text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">
                Metric
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                {valueLabel}
              </th>
              <th scope="col" className="py-1 font-medium">
                What it means
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border align-top">
                <th scope="row" className="py-1 pr-3 text-left font-medium text-foreground">
                  {row.label}
                </th>
                <td className="py-1 pr-3 tabular-nums text-foreground">
                  {row.value}
                  {suffix}
                </td>
                <td className="py-1 text-muted-foreground">{row.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
