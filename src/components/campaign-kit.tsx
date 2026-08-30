/**
 * Shared building blocks for the dedicated /campaign/* workspaces.
 * Every campaign page uses the same numbered-step layout, persona picker and
 * timing controls so the modules feel like one product.
 */
import { Link, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  Clock,
  Loader2,
  Minus,
  Plus,
  Search,
  Send,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScheduleLauncher } from "@/components/ui/schedule-launcher";
import { SlotPicker } from "@/components/ui/slot-picker";
import { defaultSendDays, sendWindowSummary, type SendDay } from "@/lib/send-windows";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { AccountAvatar } from "@/components/account-identity";
import { useExternalProfiles, VerifiedBadge } from "@/components/external-identity";
import { GoalSwitcher } from "@/components/publish-goals";
import { clusterOf } from "@/lib/insights";
import type { PublishJobResult, XAccount } from "@/lib/publish";
import { SPREAD_OPTIONS, spreadLabel } from "@/lib/spread";

export const ALL_GROUP = "__all__";

export const DELAY_OPTIONS = [0, 30, 60, 180, 300] as const;

export function delayLabel(seconds: number) {
  if (seconds === 0) return "No delay";
  if (seconds < 60) return `${seconds}s between actions`;
  return `${Math.round(seconds / 60)} min between actions`;
}

/** Section shell: numbered heading, one-line description, generous whitespace. */
export function Step({
  index,
  title,
  description,
  children,
  aside,
}: {
  index: number;
  title: string;
  description: string;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">
            {index}. {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {aside}
      </div>
      {children ? <div className="mt-4 space-y-4">{children}</div> : null}
    </section>
  );
}

export function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-right text-xs font-semibold">{value}</span>
    </div>
  );
}

/** Sticky page header shared by every campaign workspace. */
export function CampaignHeader({
  title,
  subtitle,
  goal,
  action,
}: {
  title: string;
  subtitle: string;
  goal: string;
  action?: React.ReactNode;
}) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();

  const goBack = () => {
    if (canGoBack) router.history.back();
    else navigate({ to: "/publish", search: { choose: true } });
  };

  return (
    <header className="relative z-0 -mx-3 mb-5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-background px-3 py-3 sm:-mx-5 sm:px-5 lg:-mx-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:px-6">
      <button
        type="button"
        onClick={goBack}
        aria-label="Go back"
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        <span className="hidden sm:inline">Back</span>
      </button>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 lg:col-span-1 lg:justify-end">
        <GoalSwitcher goal={goal} />
        {action}
      </div>
    </header>
  );
}

/**
 * Primary run control for every campaign workspace.
 * When timing is set the campaign can still be launched immediately; the
 * queue action remains available as the secondary path.
 */
export function LaunchActions({
  scheduled,
  busy,
  disabled,
  onLaunch,
  onQueue,
  onSchedule,
  launchLabel,
  queueLabel,
  size = "sm",
  className,
}: {
  scheduled: boolean;
  busy: boolean;
  disabled: boolean;
  onLaunch: () => void;
  onQueue: () => void;
  /** When provided the operator can also pick an explicit start date/time. */
  onSchedule?: (at: Date) => void;
  launchLabel: string;
  queueLabel: string;
  size?: "sm" | "default";
  className?: string;
}) {
  if (onSchedule) {
    return (
      <ScheduleLauncher
        busy={busy}
        disabled={disabled}
        launchLabel={launchLabel}
        onLaunch={onLaunch}
        onSchedule={onSchedule}
        className={className}
      />
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <Button size={size} disabled={disabled || busy} onClick={onLaunch}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {launchLabel}
      </Button>
      {scheduled ? (
        <Button size={size} variant="outline" disabled={disabled || busy} onClick={onQueue}>
          <CalendarClock className="size-4" />
          {queueLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** Mandatory campaign name so the run is identifiable on Performance. */
export function CampaignNameStep({
  index,
  value,
  onChange,
  placeholder,
}: {
  index: number;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <Step
      index={index}
      title="Campaign name"
      description="Used to find this run again in Campaigns and Performance."
    >
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 80))}
        placeholder={placeholder}
        aria-label="Campaign name"
        className="max-w-md"
      />
      {!value.trim() ? (
        <p className="mt-2 text-xs text-muted-foreground">Give the campaign a name to launch it.</p>
      ) : null}
    </Step>
  );
}

/** Confirmation shown the moment a campaign starts running. */
export function CampaignRunningDialog({
  open,
  onOpenChange,
  name,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-fkf-green" aria-hidden="true" />
            Campaign running
          </DialogTitle>
          <DialogDescription>
            {description ??
              `“${name || "Your campaign"}” is live. Approved actions are queued according to the timing and account safeguards you selected.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Stay here
          </Button>
          <Button asChild>
            <Link to="/campaign-manager">Open Campaigns</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type PersonaSelection = ReturnType<typeof usePersonaSelection>;

export type PersonaMode = "auto" | "manual";

/** Group + count (or hand-picked) selection shared by every campaign builder. */
export function usePersonaSelection(all: XAccount[], initialCount = 10) {
  // Empty list = every group. More than one group can be active at a time.
  const [activeGroups, setActiveGroups] = useState<string[]>([]);
  const [count, setCount] = useState(initialCount);
  const [mode, setMode] = useState<PersonaMode>("auto");
  const [manualIds, setManualIds] = useState<string[]>([]);

  // Suspended personas can't act on X, so they never take part in a campaign.
  const accounts = useMemo(() => all.filter((a) => !a.suspended), [all]);

  // The persona's own words describe who they are, so the bio decides the group.
  const groupFor = (a: XAccount) => clusterOf(`${a.personaLabel} ${a.displayName} ${a.bio ?? ""}`);

  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of accounts) {
      const key = groupFor(a);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [accounts]);

  const groupAccounts = useMemo(
    () =>
      activeGroups.length === 0
        ? accounts
        : accounts.filter((a) => activeGroups.includes(groupFor(a))),
    [accounts, activeGroups],
  );
  const groupTotal = groupAccounts.length;

  useEffect(() => {
    if (groupTotal === 0) return;
    setCount((n) => Math.min(Math.max(1, n), groupTotal));
  }, [groupTotal]);

  const manualAccounts = useMemo(
    () => accounts.filter((a) => manualIds.includes(a.id)),
    [accounts, manualIds],
  );

  const selectedAccounts = useMemo(
    () =>
      mode === "manual" ? manualAccounts : groupAccounts.slice(0, Math.min(count, groupTotal)),
    [mode, manualAccounts, groupAccounts, count, groupTotal],
  );
  const selected = useMemo(() => selectedAccounts.map((a) => a.id), [selectedAccounts]);
  const suspendedTotal = useMemo(() => all.filter((a) => a.suspended).length, [all]);

  const toggleManual = (id: string) =>
    setManualIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const setManual = (ids: string[]) => setManualIds(ids);
  const clearManual = () => setManualIds([]);

  const toggleGroup = (name: string) =>
    setActiveGroups((g) => (g.includes(name) ? g.filter((x) => x !== name) : [...g, name]));
  const clearGroups = () => setActiveGroups([]);

  return {
    activeGroups,
    setActiveGroups,
    toggleGroup,
    clearGroups,
    count,
    setCount,
    mode,
    setMode,
    manualIds,
    toggleManual,
    setManual,
    clearManual,
    groupFor,
    groups,
    groupAccounts,
    groupTotal,
    selected,
    selectedAccounts,
    groupLabel:
      mode === "manual"
        ? "Hand-picked personas"
        : activeGroups.length === 0
          ? "All personas"
          : activeGroups.length === 1
            ? activeGroups[0]!
            : `${activeGroups.length} groups`,
    total: accounts.length,
    suspendedTotal,
    linkedTotal: all.length,
    accounts,
  };
}

export function PersonaPicker({
  id,
  selection,
  loading,
  label = "How many personas should take part?",
}: {
  id: string;
  selection: PersonaSelection;
  loading?: boolean;
  label?: string;
}) {
  const {
    count,
    setCount,
    activeGroups,
    toggleGroup,
    clearGroups,
    groups,
    groupAccounts,
    groupTotal,
    total,
    suspendedTotal,
    selected,
    mode,
    setMode,
    manualIds,
    toggleManual,
    setManual,
    clearManual,
    groupFor,
  } = selection;

  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      term
        ? groupAccounts.filter((a) =>
            `${a.handle} ${a.displayName} ${a.personaLabel}`.toLowerCase().includes(term),
          )
        : groupAccounts,
    [groupAccounts, term],
  );
  const visibleIds = visible.map((a) => a.id);
  const allVisibleChosen = visibleIds.length > 0 && visibleIds.every((i) => manualIds.includes(i));
  const { lookup: profileFor } = useExternalProfiles(
    mode === "manual" ? visible.slice(0, 60).map((a) => a.handle) : [],
  );

  return (
    <>
      <div
        role="tablist"
        aria-label="Persona selection mode"
        className="inline-flex max-w-full overflow-x-auto rounded-full border border-border bg-muted/50 p-1"
      >
        {(
          [
            ["auto", "Automatic"],
            ["manual", "Choose individually"],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium transition ${
              mode === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {mode === "auto" ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor={`${id}-count`}>
              {label}
            </label>
            <div className="flex h-11 items-center justify-between rounded-md border border-input bg-background px-2">
              <button
                type="button"
                aria-label="Fewer personas"
                className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={() => setCount((n) => Math.max(1, n - 1))}
              >
                <Minus className="size-4" />
              </button>
              <input
                id={`${id}-count`}
                type="number"
                min={1}
                max={Math.max(1, groupTotal)}
                value={Math.min(count, Math.max(1, groupTotal))}
                onChange={(e) =>
                  setCount(
                    Math.min(Math.max(1, Number(e.target.value) || 1), Math.max(1, groupTotal)),
                  )
                }
                className="w-16 bg-transparent text-center text-sm font-medium tabular-nums outline-none"
              />
              <button
                type="button"
                aria-label="More personas"
                className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={() => setCount((n) => Math.min(groupTotal || 1, n + 1))}
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <span className="text-xs font-medium" id={`${id}-group`}>
            {mode === "manual" ? "Filter by persona group" : "Which persona groups?"}
          </span>
          <div
            role="group"
            aria-labelledby={`${id}-group`}
            className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-input bg-background p-2"
          >
            <button
              type="button"
              aria-pressed={activeGroups.length === 0}
              onClick={clearGroups}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${activeGroups.length === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              <Users className="size-3.5" /> All ({total})
            </button>
            {groups.map(([name, n]) => {
              const on = activeGroups.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleGroup(name)}
                  className={`min-h-9 rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  {name} ({n})
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {loading
              ? "Loading personas…"
              : `Pick as many groups as you need · ${groupTotal} personas available`}
          </p>
        </div>
      </div>

      {mode === "manual" ? (
        <div className="rounded-xl border border-border">
          <div className="grid gap-2 border-b border-border p-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search personas"
                aria-label="Search personas"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={visibleIds.length === 0}
                onClick={() =>
                  allVisibleChosen
                    ? setManual(manualIds.filter((i) => !visibleIds.includes(i)))
                    : setManual([...new Set([...manualIds, ...visibleIds])])
                }
              >
                {allVisibleChosen ? "Clear these" : "Select all"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={manualIds.length === 0}
                onClick={clearManual}
              >
                Reset
              </Button>
            </div>
          </div>

          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {visible.map((a) => {
              const checked = manualIds.includes(a.id);
              const profile = profileFor(a.handle);
              const verified = a.isVerified || Boolean(profile?.isVerified);
              return (
                <li key={a.id}>
                  <label
                    className={`grid cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 p-3 transition hover:bg-muted/60 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] ${checked ? "bg-primary/5" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleManual(a.id)}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <AccountAvatar
                      handle={a.handle}
                      displayName={a.displayName || a.personaLabel || a.handle}
                      avatarUrl={profile?.avatarUrl ?? a.avatarUrl}
                      className="size-9"
                    />
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-1 text-sm font-medium">
                        <span className="truncate">
                          {a.displayName || a.personaLabel || a.handle}
                        </span>
                        {verified ? <VerifiedBadge className="size-3.5" /> : null}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        @{a.handle}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground sm:hidden">
                        {groupFor(a)}
                      </span>
                    </span>
                    <span className="hidden shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:block">
                      {groupFor(a)}
                    </span>
                  </label>
                </li>
              );
            })}
            {visible.length === 0 ? (
              <li className="p-4 text-xs text-muted-foreground">
                {loading ? "Loading personas…" : "No personas match this search."}
              </li>
            ) : null}
          </ul>

          <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            {manualIds.length} persona{manualIds.length === 1 ? "" : "s"} hand-picked
          </div>
        </div>
      ) : null}

      {!loading && total === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          No persona accounts are linked yet.
        </p>
      ) : null}
      {suspendedTotal > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Unavailable accounts are excluded automatically from selection.
        </p>
      ) : null}
      {selected.length > 0 ? (
        <span className="sr-only">{selected.length} personas selected</span>
      ) : null}
    </>
  );
}

export type Timing = {
  spreadHours: number;
  setSpreadHours: (v: number) => void;
  delaySeconds: number;
  setDelaySeconds: (v: number) => void;
  smartDelay: boolean;
  setSmartDelay: (v: boolean) => void;
  windows: SendDay[];
  setWindows: (v: SendDay[]) => void;
};

export function useTiming(initialDelay = 60): Timing {
  const [spreadHours, setSpreadHours] = useState(0);
  const [delaySeconds, setDelaySeconds] = useState(initialDelay);
  const [smartDelay, setSmartDelay] = useState(true);
  const [windows, setWindows] = useState<SendDay[]>(() => defaultSendDays());
  return {
    windows,
    setWindows,
    spreadHours,
    setSpreadHours,
    delaySeconds,
    setDelaySeconds,
    smartDelay,
    setSmartDelay,
  };
}

export function timingLabel(t: Timing) {
  if (t.spreadHours > 0) return spreadLabel(t.spreadHours);
  if (t.delaySeconds > 0) return delayLabel(t.delaySeconds);
  return "Run now";
}

export function TimingFields({
  id,
  timing,
  showDelay = true,
}: {
  id: string;
  timing: Timing;
  showDelay?: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor={`${id}-spread`}>
            Spread window
          </label>
          <div className="relative">
            <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
              id={`${id}-spread`}
              value={timing.spreadHours}
              onChange={(e) => timing.setSpreadHours(Number(e.target.value))}
              className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SPREAD_OPTIONS.map((hours) => (
                <option key={hours} value={hours}>
                  {spreadLabel(hours)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {showDelay ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor={`${id}-delay`}>
              Spacing between account actions
            </label>
            <div className="relative">
              <Zap className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <select
                id={`${id}-delay`}
                value={timing.delaySeconds}
                onChange={(e) => timing.setDelaySeconds(Number(e.target.value))}
                disabled={timing.spreadHours > 0}
                className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {DELAY_OPTIONS.map((delay) => (
                  <option key={delay} value={delay}>
                    {delayLabel(delay)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {timing.spreadHours > 0
                ? "The spread window already spaces queued actions."
                : timing.delaySeconds === 0
                  ? "Approved actions are queued without an additional spacing delay."
                  : "Approved actions are queued with this minimum gap between them."}
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">Preferred send windows</p>
        <p className="text-[11px] text-muted-foreground">
          Optional. The campaign start moves forward to the next open window — {sendWindowSummary(timing.windows)}.
        </p>
        <SlotPicker days={timing.windows} onChange={timing.setWindows} />
      </div>

      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={timing.smartDelay}
          onChange={(e) => timing.setSmartDelay(e.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          Automatic spacing
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            Add small timing variation inside the selected queue window to avoid accidental
            simultaneous bursts.
          </span>
        </span>
      </label>
    </>
  );
}

/** Result of a campaign run. Every action that produced a post links straight to X. */
export function RunResults({ result }: { result: PublishJobResult }) {
  return (
    <details open className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <summary className="cursor-pointer text-[15px] font-semibold tracking-tight">
        Result · {result.succeeded} delivered
        {result.failed > 0 ? ` · ${result.failed} in progress` : ""}
      </summary>
      <ul className="mt-3 space-y-2">
        {result.actions.map((a) => {
          const url = a.resultTweetId
            ? `https://x.com/${a.accountHandle || "i"}/status/${a.resultTweetId}`
            : null;
          return (
            <li key={a.id} className="flex items-start justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-start gap-2">
                {a.status === "success" ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                ) : a.status === "pending" ? (
                  <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                )}
                <span className="min-w-0">
                  <span className="font-medium">@{a.accountHandle}</span> · {a.actionType}
                  {a.content ? (
                    <span className="block whitespace-pre-wrap text-muted-foreground">
                      {a.content}
                    </span>
                  ) : null}
                  {a.error ? <span className="block text-destructive">{a.error}</span> : null}
                </span>
              </span>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                >
                  View on X <ExternalLink className="size-3" />
                </a>
              ) : null}
            </li>
          );
        })}
        {result.actions.length === 0 ? (
          <li className="text-xs text-muted-foreground">No actions recorded.</li>
        ) : null}
      </ul>
    </details>
  );
}
