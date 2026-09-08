import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Heart,
  MessageCircle,
  Send,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Goal = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** SMAIT brand accent tone. */
  tone: "red" | "green" | "black";
  /** URL segment under /campaign. */
  action: string;
  category: string;
  cta: string;
  suggested?: boolean;
};

/**
 * Campaign execution intentionally exposes only compliant publishing paths.
 * Monitoring lives in Mentions/Watchlist; automated fleet Likes, proactive
 * follows and keyword-triggered mass replies are not campaign goals.
 */
export const PUBLISH_GOALS: Goal[] = [
  {
    key: "post",
    title: "Post",
    description:
      "Publish distinct original posts from selected authorised accounts with controlled scheduling.",
    icon: Send,
    tone: "black",
    action: "post",
    category: "Original content",
    cta: "Create a post",
    suggested: true,
  },
  {
    key: "reply",
    title: "Reply",
    description:
      "Respond to a specific conversation using one selected linked account after review.",
    icon: MessageCircle,
    tone: "red",
    action: "reply",
    category: "Direct response",
    cta: "Create a reply",
  },
  {
    key: "engage",
    title: "Boost a post",
    description:
      "Selected personas like, repost and bookmark one post, paced across a chosen window.",
    icon: Heart,
    tone: "green",
    action: "engage",
    category: "Amplification",
    cta: "Boost a post",
  },
];

const TONES: Record<Goal["tone"], string> = {
  red: "bg-primary/10 text-primary",
  green: "bg-positive/10 text-positive",
  black: "bg-foreground/10 text-foreground",
};

/** Outcome grid. Each card makes the execution path and next step explicit. */
export function PublishGoalGrid({
  onPick,
}: {
  /** Called with the goal title so the caller can show a branded loading screen. */
  onPick?: (title: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {PUBLISH_GOALS.map((goal, i) => (
        <Link
          key={goal.key}
          to="/campaign/$action"
          params={{ action: goal.action }}
          onClick={() => onPick?.(goal.title)}
          style={{ animationDelay: `${i * 60}ms` }}
          className={cn(
            "group flex min-h-64 animate-in fade-in-0 slide-in-from-bottom-2 flex-col rounded-2xl border bg-card p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none",
            goal.suggested ? "border-primary/35 ring-1 ring-primary/10" : "border-border",
          )}
        >
          <span className="flex w-full items-start justify-between gap-3">
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105",
                TONES[goal.tone],
              )}
            >
              <goal.icon className="size-5" aria-hidden="true" />
            </span>
            {goal.suggested ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                Recommended
              </span>
            ) : null}
          </span>

          <span className="mt-6 type-meta font-semibold uppercase tracking-wide text-muted-foreground">
            {goal.category}
          </span>
          <span className="mt-1 type-card">{goal.title}</span>
          <span className="mt-2 type-meta leading-relaxed text-muted-foreground">
            {goal.description}
          </span>
          <span className="mt-auto flex items-center gap-2 pt-6 type-meta font-semibold text-foreground">
            {goal.cta}
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Dropdown to jump between campaign types without going back to the grid. */
export function GoalSwitcher({ goal }: { goal: string }) {
  const navigate = useNavigate();
  const current = PUBLISH_GOALS.find((g) => g.action === goal || g.key === goal);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {current ? <current.icon className="size-4" aria-hidden="true" /> : null}
          <span className="truncate">{current?.title ?? "Choose a goal"}</span>
          <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Switch campaign type</DropdownMenuLabel>
        {PUBLISH_GOALS.map((g) => (
          <DropdownMenuItem
            key={g.key}
            onSelect={() => navigate({ to: "/campaign/$action", params: { action: g.action } })}
            className="gap-2"
          >
            <g.icon className="size-4" aria-hidden="true" />
            <span className="flex-1 truncate">{g.title}</span>
            {g.key === current?.key ? <Check className="size-4" aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
