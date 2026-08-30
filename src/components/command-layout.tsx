import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Three-column executive intelligence layout:
 * narrow left context rail · dominant centre workspace · narrow right decision rail.
 * Rails stack under the centre column on small screens.
 */
export function CommandGrid({
  left,
  right,
  children,
  className,
}: {
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const columns =
    left && right
      ? "xl:grid-cols-[15rem_minmax(0,1fr)_19rem]"
      : left
        ? "xl:grid-cols-[15rem_minmax(0,1fr)]"
        : right
          ? "xl:grid-cols-[minmax(0,1fr)_19rem]"
          : "";
  return (
    <div className={cn("grid items-start gap-5", columns, className)}>
      {left ? <div className="stagger-reveal grid min-w-0 gap-5 xl:order-1">{left}</div> : null}
      <div className="stagger-reveal grid min-w-0 gap-5 xl:order-2">{children}</div>
      {right ? <div className="stagger-reveal grid min-w-0 gap-5 xl:order-3">{right}</div> : null}
    </div>
  );
}

/** Compact rail card: small title, optional icon, dense body. */
export function RailCard({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-surface p-5", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {Icon ? (
          <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : null}
        <h2 className="type-meta min-w-0 flex-1 truncate font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  );
}

/** Single label/value line inside a rail card. */
export function RailStat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : tone === "neutral"
          ? "text-neutral"
          : "text-foreground";
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="type-meta truncate text-muted-foreground">{label}</p>
        {hint ? <p className="type-meta truncate text-muted-foreground/70">{hint}</p> : null}
      </div>
      <p className={cn("shrink-0 text-sm font-semibold tabular-nums", toneClass)}>{value}</p>
    </div>
  );
}

/** Divided list of rail stats. */
export function RailStatList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border">{children}</div>;
}

/** Horizontal share bar used for mix / distribution rails. */
export function RailBar({
  label,
  value,
  total,
  valueLabel,
}: {
  label: string;
  value: number;
  total: number;
  valueLabel?: ReactNode;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="min-w-0 py-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="type-meta min-w-0 truncate text-muted-foreground">{label}</p>
        <p className="type-meta shrink-0 font-semibold tabular-nums text-foreground">
          {valueLabel ?? `${pct}%`}
        </p>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Quiet navigation / action item for the decision rail. */
export function RailAction({
  to,
  onClick,
  icon: Icon,
  title,
  description,
}: {
  to?: string;
  onClick?: () => void;
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  const inner = (
    <>
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
      <span className="min-w-0">
        <span className="type-body block truncate font-semibold">{title}</span>
        {description ? (
          <span className="type-meta mt-0.5 block text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </>
  );
  const classes =
    "press-scale flex w-full min-w-0 items-start gap-2.5 rounded-xl border border-border bg-background p-3.5 text-left transition-colors hover:bg-muted";
  if (to) {
    return (
      <Link to={to} className={classes}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {inner}
    </button>
  );
}
