import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { ComponentType, HTMLAttributes, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shared layout primitives used across the authenticated workspace. */
export function Card({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card-surface p-5 sm:p-6", className)} {...rest}>
      {children}
    </div>
  );
}

export function PageTitle({
  children,
  description,
  actions,
}: {
  children: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 grid grid-cols-1 items-start gap-3 lg:mb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-5">
      <div className="min-w-0">
        <h1 className="type-title max-w-full break-words lg:truncate">{children}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl type-body text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export type PageTab<T extends string = string> = {
  value: T;
  label: string;
  count?: number;
};

/** Familiar business-tool section navigation with touch-friendly horizontal overflow. */
export function PageTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel = "Page sections",
  className,
}: {
  items: PageTab<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0", className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex min-w-max items-end gap-5 border-b border-border"
      >
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.value)}
              className={cn(
                "relative flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-0.5 py-2.5 type-meta font-semibold transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              {typeof item.count === "number" ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {item.count.toLocaleString()}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Filter/action row placed directly above the data it controls. */
export function PageToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center sm:overflow-visible",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("type-section", className)}>{children}</h2>;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "negative" | "neutral";
  className?: string;
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
    <div className={cn("card-surface p-5 sm:p-6", className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icon ? <Icon className="size-4 shrink-0" /> : null}
        <p className="type-meta truncate">{label}</p>
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight sm:mt-3", toneClass)}>{value}</p>
      {hint ? <p className="type-meta mt-1.5 text-muted-foreground sm:mt-2">{hint}</p> : null}
    </div>
  );
}

export function LockScreen({ title = "Admin only" }: { title?: string }) {
  return (
    <div className="mx-auto max-w-md card-surface p-6 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
        <Lock className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="type-section mt-4">{title}</h1>
      <p className="type-meta mt-2 text-muted-foreground">Ask the workspace owner for access.</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/new">Back to Test</Link>
      </Button>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card-surface border-dashed p-5 text-center shadow-none sm:p-6">
      <p className="type-card">{title}</p>
      {description ? <p className="type-meta mt-2 text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
