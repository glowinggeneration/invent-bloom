import {
  BarChart3,
  CalendarCheck2,
  FileText,
  FolderOpen,
  Settings2,
  Send,
  UsersRound,
  Zap,
} from "lucide-react";

type WorkflowVisualProps = {
  className?: string;
};

const shell =
  "relative mx-auto h-36 w-full max-w-[280px] overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-primary/[0.08]";

export function PlanPreparationVisual({ className = "" }: WorkflowVisualProps) {
  return (
    <div className={`${shell} ${className}`} aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_34%)]" />
      <div className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/20 bg-background shadow-[0_18px_50px_-28px_var(--primary)]">
        <div className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground">
          <BarChart3 className="size-5" />
        </div>
      </div>
      <svg
        className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 -rotate-90"
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-primary/10"
        />
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="165 290"
          className="animate-pulse text-primary"
        />
      </svg>
    </div>
  );
}

export function ReportLibraryVisual({ className = "" }: WorkflowVisualProps) {
  return (
    <div className={`${shell} ${className}`} aria-hidden="true">
      <div className="absolute left-1/2 top-5 h-20 w-36 -translate-x-1/2 rounded-2xl bg-primary/90 shadow-lg shadow-primary/15" />
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="absolute top-8 h-20 w-20 rounded-xl border border-border bg-card p-3 shadow-sm"
          style={{
            left: `calc(50% - ${48 - item * 18}px)`,
            transform: `rotate(${item * 5 - 6}deg)`,
          }}
        >
          <FileText className="size-4 text-primary" />
          <div className="mt-3 h-1.5 rounded-full bg-muted" />
          <div className="mt-1.5 h-1.5 w-3/4 rounded-full bg-muted" />
        </div>
      ))}
      <div className="absolute bottom-4 left-1/2 flex w-44 -translate-x-1/2 items-center justify-between rounded-2xl border border-primary/20 bg-primary/95 px-4 py-3 text-primary-foreground shadow-lg shadow-primary/20">
        <div>
          <p className="text-xs font-semibold">Reports</p>
          <p className="text-[9px] opacity-75">Daily intelligence</p>
        </div>
        <FolderOpen className="size-4" />
      </div>
    </div>
  );
}

export function ReportDeliveryVisual({ className = "" }: WorkflowVisualProps) {
  return (
    <div className={`${shell} ${className}`} aria-hidden="true">
      <div className="absolute left-5 top-5 w-44 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2 text-[9px] font-semibold text-foreground">
          <Send className="size-3 text-primary" /> Executive report
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-muted" />
        <div className="mt-1.5 h-1.5 w-3/4 rounded-full bg-muted" />
        <div className="mt-3 flex gap-3">
          <span className="text-[9px] text-muted-foreground">Coverage</span>
          <span className="text-[9px] font-semibold text-primary">90.24%</span>
        </div>
      </div>
      <div className="absolute bottom-5 right-6 grid size-20 place-items-center rounded-full border-[10px] border-primary/10 bg-card shadow-sm">
        <span className="text-lg font-semibold text-primary">3×</span>
      </div>
      <div className="absolute right-7 top-5 size-9 rounded-full bg-primary/20" />
    </div>
  );
}

export function AutomationVisual({ className = "" }: WorkflowVisualProps) {
  return (
    <div className={`${shell} ${className}`} aria-hidden="true">
      <div className="absolute left-5 top-5 flex h-10 w-24 items-center justify-between rounded-full border border-primary/20 bg-card px-2 shadow-sm">
        <span className="pl-1 text-[10px] font-semibold text-primary">On</span>
        <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <span className="size-2 rounded-full bg-current" />
        </span>
      </div>
      <div className="absolute bottom-5 left-5 flex h-10 w-24 items-center justify-between rounded-full border border-border bg-card/80 px-2 opacity-60">
        <span className="pl-1 text-[10px] font-medium text-muted-foreground">Off</span>
        <span className="size-7 rounded-full bg-muted" />
      </div>
      <div className="absolute right-7 top-1/2 grid size-24 -translate-y-1/2 place-items-center rounded-full border border-primary/15 bg-card shadow-[0_20px_45px_-28px_var(--primary)]">
        <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Settings2 className="size-6" />
        </div>
      </div>
    </div>
  );
}

export function CampaignMomentumVisual({ className = "" }: WorkflowVisualProps) {
  return (
    <div className={`${shell} ${className}`} aria-hidden="true">
      <svg
        className="absolute inset-x-4 top-4 h-20 w-auto"
        viewBox="0 0 250 80"
        preserveAspectRatio="none"
      >
        <path
          d="M0 62 C28 70 30 28 60 40 S96 54 112 24 S154 2 176 28 S222 50 250 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="text-primary"
        />
        <path
          d="M0 62 C28 70 30 28 60 40 S96 54 112 24 S154 2 176 28 S222 50 250 12 L250 80 L0 80 Z"
          className="fill-primary/5"
        />
      </svg>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center rounded-full border border-border bg-card p-1.5 shadow-md">
        <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
          <CalendarCheck2 className="size-4" />
        </span>
        <span className="-ml-1 grid size-9 place-items-center rounded-full border-2 border-card bg-muted text-muted-foreground">
          <UsersRound className="size-4" />
        </span>
        <span className="-ml-1 grid size-9 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground">
          <Zap className="size-4" />
        </span>
        <span className="px-3 text-xs font-semibold text-primary">+2</span>
      </div>
    </div>
  );
}
