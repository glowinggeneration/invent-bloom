/**
 * Overview state gate.
 *
 * Overview is an evidence screen: render the analytical dashboard only when
 * there is evidence to support it. This module derives one of six explicit
 * states from the real query results already used by the Overview page —
 * it does not add a backend, invent metrics, or guess at data that isn't
 * actually returned.
 */
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, PlugZap, Radar, RefreshCw } from "lucide-react";
import { AnimatedBackground } from "@/components/core/animated-background";
import { cn } from "@/lib/utils";
import { OVERVIEW_WINDOWS, type OverviewWindow } from "@/lib/overview";

export type OverviewMode =
  "loading" | "ready" | "empty-window" | "no-sources" | "connection-error" | "partial";

export type SourceHealth = {
  id: string;
  label: string;
  status: "ready" | "error" | "pending";
};

export type OverviewStateInput = {
  loading: boolean;
  fatalQueryError: boolean;
  /** True when we have real source-connection data for the current viewer (currently: admins only). */
  sourcesKnown: boolean;
  sources: SourceHealth[];
  /** True once the request for the selected window succeeded and returned zero qualifying mentions. */
  empty: boolean;
};

/**
 * Deterministic state derivation. A failed request is never treated as an
 * empty result, and zero configured sources is never conflated with a
 * connection failure.
 */
export function deriveOverviewMode({
  loading,
  fatalQueryError,
  sourcesKnown,
  sources,
  empty,
}: OverviewStateInput): OverviewMode {
  if (loading) return "loading";
  if (fatalQueryError) return "connection-error";

  if (sourcesKnown) {
    if (sources.length === 0) return "no-sources";

    const readySources = sources.filter((source) => source.status === "ready");
    const failedSources = sources.filter((source) => source.status === "error");

    if (readySources.length === 0 && failedSources.length > 0) return "connection-error";
    if (empty) return "empty-window";
    if (failedSources.length > 0) return "partial";
    return "ready";
  }

  // Source-connection health isn't visible to this viewer (matches the
  // existing permission boundary on Linked Accounts), so only the main
  // query result decides between empty and ready.
  return empty ? "empty-window" : "ready";
}

export function getNextOverviewWindow(range: OverviewWindow): OverviewWindow | null {
  const currentIndex = OVERVIEW_WINDOWS.findIndex((option) => option.value === range);
  return OVERVIEW_WINDOWS[currentIndex + 1]?.value ?? null;
}

type OverviewStateGateProps = OverviewStateInput & {
  range: OverviewWindow;
  lastCheckedLabel?: string | undefined;
  isAdmin: boolean;
  onRangeChange: (range: OverviewWindow) => void;
  onViewMentions: () => void;
  onOpenConnections: () => void;
  onRefresh: () => void;
  children: ReactNode;
};

export function OverviewStateGate({
  loading,
  fatalQueryError,
  sourcesKnown,
  sources,
  empty,
  range,
  lastCheckedLabel,
  isAdmin,
  onRangeChange,
  onViewMentions,
  onOpenConnections,
  onRefresh,
  children,
}: OverviewStateGateProps) {
  const mode = deriveOverviewMode({ loading, fatalQueryError, sourcesKnown, sources, empty });
  const failedSources = sources.filter((source) => source.status === "error");
  const isFocusedState =
    mode === "empty-window" || mode === "no-sources" || mode === "connection-error";

  return (
    <div className={cn(isFocusedState && "mx-auto w-full max-w-6xl")}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="type-title">Overview</h1>
        <RangeSelector value={range} onChange={onRangeChange} />
      </header>

      <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 type-meta text-muted-foreground">
          <CheckCircle2
            className={cn(
              "size-4",
              mode === "connection-error" ? "text-muted-foreground" : "text-positive",
            )}
            aria-hidden="true"
          />
          <span>{mode === "connection-error" ? "Listening interrupted" : "Listening active"}</span>
        </div>

        <div className="flex items-center gap-3" aria-live="polite">
          {lastCheckedLabel ? (
            <span className="type-meta text-muted-foreground">{lastCheckedLabel}</span>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh Overview"
            className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="mt-4"
        >
          {mode === "loading" ? <OverviewSkeleton /> : null}

          {mode === "empty-window" ? (
            <OverviewEmptyWindow
              range={range}
              onRangeChange={onRangeChange}
              onViewMentions={onViewMentions}
            />
          ) : null}

          {mode === "no-sources" ? (
            <OverviewNoSources isAdmin={isAdmin} onOpenConnections={onOpenConnections} />
          ) : null}

          {mode === "connection-error" ? (
            <OverviewConnectionError
              isAdmin={isAdmin}
              onOpenConnections={onOpenConnections}
              onRefresh={onRefresh}
            />
          ) : null}

          {mode === "ready" || mode === "partial" ? (
            <div>
              {mode === "partial" ? (
                <SourceHealthNotice
                  failedSources={failedSources}
                  isAdmin={isAdmin}
                  onOpenConnections={onOpenConnections}
                />
              ) : null}
              {children}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function RangeSelector({
  value,
  onChange,
}: {
  value: OverviewWindow;
  onChange: (range: OverviewWindow) => void;
}) {
  return (
    <div
      className="inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-card p-1"
      role="group"
      aria-label="Overview time range"
    >
      <AnimatedBackground
        defaultValue={value}
        onValueChange={(nextValue) => {
          if (nextValue) onChange(nextValue as OverviewWindow);
        }}
        className="rounded-full bg-primary"
        transition={{ ease: "easeInOut", duration: 0.2 }}
      >
        {OVERVIEW_WINDOWS.map((option) => (
          <button
            key={option.value}
            type="button"
            data-id={option.value}
            aria-pressed={value === option.value}
            className={cn(
              "relative z-10 inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 type-meta font-medium transition-colors",
              value === option.value
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </AnimatedBackground>
    </div>
  );
}

function StateSurface({
  icon,
  title,
  description,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actions: ReactNode;
}) {
  return (
    <section
      className="flex min-h-[320px] items-center justify-center rounded-[18px] border border-border bg-card px-5 py-10 text-center shadow-sm sm:min-h-[340px]"
      aria-live="polite"
    >
      <div className="max-w-xl">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="mt-5 type-section">{title}</h2>
        <p className="mt-3 type-body text-muted-foreground">{description}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">{actions}</div>
      </div>
    </section>
  );
}

function OverviewEmptyWindow({
  range,
  onRangeChange,
  onViewMentions,
}: {
  range: OverviewWindow;
  onRangeChange: (range: OverviewWindow) => void;
  onViewMentions: () => void;
}) {
  const nextRangeValue = getNextOverviewWindow(range);
  const nextRange = OVERVIEW_WINDOWS.find((option) => option.value === nextRangeValue);
  const rangeLabel = OVERVIEW_WINDOWS.find((option) => option.value === range)?.label ?? range;

  return (
    <StateSurface
      icon={<Radar className="size-6" aria-hidden="true" />}
      title={`No conversation data in the last ${rangeLabel}`}
      description="SMAIT is listening, but no qualifying mentions were collected for this period."
      actions={
        <>
          {nextRange ? (
            <button
              type="button"
              onClick={() => onRangeChange(nextRange.value)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 type-body font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try {nextRange.label}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onViewMentions}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-xl px-5 type-body font-medium transition-colors",
              nextRange
                ? "border border-border bg-card text-foreground hover:bg-muted"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            View mentions
          </button>
        </>
      }
    />
  );
}

function OverviewNoSources({
  isAdmin,
  onOpenConnections,
}: {
  isAdmin: boolean;
  onOpenConnections: () => void;
}) {
  return (
    <StateSurface
      icon={<PlugZap className="size-6" aria-hidden="true" />}
      title="Connect a source to start listening"
      description="Overview will appear after SMAIT can collect qualifying mentions from at least one connected source."
      actions={
        isAdmin ? (
          <button
            type="button"
            onClick={onOpenConnections}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 type-body font-medium text-primary-foreground hover:bg-primary/90"
          >
            Connect a source
          </button>
        ) : (
          <p className="rounded-xl bg-muted px-4 py-3 type-body text-muted-foreground">
            Ask your workspace administrator to connect a listening source.
          </p>
        )
      }
    />
  );
}

function OverviewConnectionError({
  isAdmin,
  onOpenConnections,
  onRefresh,
}: {
  isAdmin: boolean;
  onOpenConnections: () => void;
  onRefresh: () => void;
}) {
  return (
    <StateSurface
      icon={<AlertCircle className="size-6" aria-hidden="true" />}
      title="A source connection needs attention"
      description="SMAIT could not check the connected sources. Your existing data is safe."
      actions={
        <>
          {isAdmin ? (
            <button
              type="button"
              onClick={onOpenConnections}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 type-body font-medium text-primary-foreground hover:bg-primary/90"
            >
              Review connections
            </button>
          ) : (
            <p className="self-center type-body text-muted-foreground">
              Ask your workspace administrator to review the source connection.
            </p>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-5 type-body font-medium text-foreground hover:bg-muted"
          >
            Try again
          </button>
        </>
      }
    />
  );
}

function SourceHealthNotice({
  failedSources,
  isAdmin,
  onOpenConnections,
}: {
  failedSources: SourceHealth[];
  isAdmin: boolean;
  onOpenConnections: () => void;
}) {
  const firstSource = failedSources[0];
  const countLabel =
    failedSources.length === 1
      ? "One source needs attention."
      : `${failedSources.length} sources need attention.`;

  return (
    <aside className="mb-5 flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-4 text-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="type-body font-medium">{countLabel}</p>
        <p className="mt-1 type-meta text-muted-foreground">
          {firstSource?.label
            ? `${firstSource.label} could not be checked. Other collected data remains available.`
            : "A connected source could not be checked. Other collected data remains available."}
        </p>
      </div>
      {isAdmin ? (
        <button
          type="button"
          onClick={onOpenConnections}
          className="min-h-11 shrink-0 rounded-xl px-3 type-body font-medium hover:bg-warning/15"
        >
          Review connection
        </button>
      ) : (
        <span className="type-meta">Contact your workspace administrator.</span>
      )}
    </aside>
  );
}

function OverviewSkeleton() {
  return (
    <section className="animate-pulse space-y-5" aria-label="Loading Overview">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <div className="h-3 w-2/5 rounded bg-muted" />
            <div className="mt-3 h-7 w-1/3 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
        <div className="grid gap-4 xl:order-1">
          <div className="h-40 rounded-2xl bg-muted" />
          <div className="h-40 rounded-2xl bg-muted" />
          <div className="h-28 rounded-2xl bg-muted" />
        </div>
        <div className="grid min-w-0 gap-4 xl:order-2">
          <div className="h-48 rounded-2xl bg-muted" />
          <div className="h-32 rounded-2xl bg-muted" />
        </div>
        <div className="grid gap-4 xl:order-3">
          <div className="h-56 rounded-2xl bg-muted" />
          <div className="h-32 rounded-2xl bg-muted" />
        </div>
      </div>
    </section>
  );
}
