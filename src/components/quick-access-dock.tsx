import { Link, useRouterState } from "@tanstack/react-router";
import {
  AtSign,
  CalendarDays,
  FileText,
  Gauge,
  History,
  LayoutDashboard,
  SquarePen,
} from "lucide-react";
import type { ComponentType } from "react";

import { Dock, DockIcon } from "@/registry/magicui/dock";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DockShortcut = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const primaryShortcuts: DockShortcut[] = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/mentions", label: "Mentions", icon: AtSign },
  { to: "/campaign-manager", label: "Campaigns", icon: Gauge },
  { to: "/new", label: "Response Studio", icon: SquarePen },
];

const secondaryShortcuts: DockShortcut[] = [
  { to: "/campaign-calendar", label: "Campaign Calendar", icon: CalendarDays },
  { to: "/campaign-history", label: "Campaign History", icon: History },
  { to: "/reports", label: "Reports", icon: FileText },
];

function DockLink({ shortcut, isActive }: { shortcut: DockShortcut; isActive: boolean }) {
  const Icon = shortcut.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DockIcon>
          <Link
            to={shortcut.to}
            aria-label={shortcut.label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex size-full items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
            )}
          >
            <Icon className="size-full" />
          </Link>
        </DockIcon>
      </TooltipTrigger>
      <TooltipContent side="top">{shortcut.label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Floating macOS-style shortcut dock for the authenticated workspace. Surfaces
 * the most-used destinations (workspace overview, mentions, campaigns,
 * response studio, calendar, history, reports) as a magnifying icon bar
 * anchored to the bottom-center of the viewport.
 */
export function QuickAccessDock() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-6 z-40 hidden justify-center px-4 sm:flex",
        )}
        aria-hidden={false}
      >
        <Dock
          direction="middle"
          className="pointer-events-auto"
          aria-label="Quick access shortcuts"
        >
          {primaryShortcuts.map((shortcut) => (
            <DockLink
              key={shortcut.to}
              shortcut={shortcut}
              isActive={pathname.startsWith(shortcut.to)}
            />
          ))}
          <Separator orientation="vertical" className="h-8" />
          {secondaryShortcuts.map((shortcut) => (
            <DockLink
              key={shortcut.to}
              shortcut={shortcut}
              isActive={pathname.startsWith(shortcut.to)}
            />
          ))}
        </Dock>
      </div>
    </TooltipProvider>
  );
}
