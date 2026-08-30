import { Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Heart, MessageCircle, Send, type LucideIcon } from "lucide-react";

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
  /** FKF brand: federation red, pitch green, black. */
  tone: "red" | "green" | "black";
  /** URL segment under /campaign. */
  action: string;
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
    suggested: true,
  },
  {
    key: "engage",
    title: "Boost a post",
    description:
      "Selected personas like, repost and bookmark one post, paced across a chosen window.",
    icon: Heart,
    tone: "green",
    action: "engage",
  },
];

const TONES: Record<Goal["tone"], string> = {
  red: "bg-primary/10 text-primary",
  green: "bg-fkf-green/10 text-fkf-green",
  black: "bg-foreground/10 text-foreground",
};

/** Meta-style "choose a goal" grid. Each card routes to the matching tool. */
export function PublishGoalGrid({
  onPick,
}: {
  /** Called with the goal title so the caller can show a branded loading screen. */
  onPick?: (title: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PUBLISH_GOALS.map((goal, i) => (
        <Link
          key={goal.key}
          to="/campaign/$action"
          params={{ action: goal.action }}
          onClick={() => onPick?.(goal.title)}
          style={{ animationDelay: `${i * 60}ms` }}
          className="group flex animate-in fade-in-0 slide-in-from-bottom-2 flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none"
        >
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110",
              TONES[goal.tone],
            )}
          >
            <goal.icon className="size-5" aria-hidden="true" />
          </span>

          <span className="type-card">{goal.title}</span>
          <span className="type-meta text-muted-foreground">{goal.description}</span>
          {goal.suggested && (
            <span className="mt-1 rounded-full bg-muted px-2 py-0.5 type-meta text-muted-foreground">
              Suggested
            </span>
          )}
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
