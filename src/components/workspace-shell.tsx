import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  Archive,
  AtSign,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Compass,
  CreditCard,
  Eye,
  FileCheck2,
  FolderKanban,
  FilePlus2,
  FileText,
  Gauge,
  GitCompareArrows,
  HelpCircle,
  History,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  Moon,
  Plus,
  Settings,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SquarePen,
  UsersRound,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { AvatarLabelGroup } from "@/components/base/avatar/avatar-label-group";
import { AboutPopover } from "@/components/core/about-popover";
import { OfficialPostAlert } from "@/components/official-post-alert";
import { IdleSessionGuard } from "@/components/idle-session-guard";
import { QuickAccessDock } from "@/components/quick-access-dock";
import { ProjectSwitcher } from "@/components/project-switcher";
import { AnimatedThemeToggler } from "@/registry/magicui/animated-theme-toggler";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { isAdminEmail } from "@/lib/access";
import { useNotifications } from "@/hooks/use-notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { GlobalCommandPalette } from "@/components/global-command";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { GROUP_EXTRA_PREFIXES, isSectionActive, type DestinationGroupKey } from "@/lib/navigation";

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }> };

function useNavAreas() {
  const { data: profile } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  return { isAdmin, profile };
}

function NavGroup({
  label,
  items,
  pathname,
  isCompactRail,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  isCompactRail: boolean;
}) {
  return (
    <SidebarGroup>
      {/* The group label is genuinely unmounted in the compact rail, not
          just hidden with opacity/negative-margin — a true label fragment
          must never exist in the layout at 80px width. */}
      {label && !isCompactRail ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu className={cn(isCompactRail && "items-center gap-1")}>
          {items.map((item) => {
            const isActive = pathname.startsWith(item.to);
            return (
              <SidebarMenuItem key={item.to} className={cn(isCompactRail && "w-auto")}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className={cn(
                    "relative overflow-hidden",
                    isCompactRail ? "!size-11 !p-0 justify-center" : "min-h-11",
                    isActive &&
                      "bg-sidebar-primary/10 font-medium text-sidebar-primary hover:bg-sidebar-primary/15 hover:text-sidebar-primary data-[active=true]:bg-sidebar-primary/10 data-[active=true]:text-sidebar-primary",
                  )}
                >
                  <Link
                    to={item.to}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={item.label}
                  >
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-sidebar-primary"
                      />
                    )}
                    <item.icon className={cn("shrink-0", isCompactRail ? "size-5" : "size-4")} />
                    {!isCompactRail && <span>{item.label}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/**
 * The five primary destinations. `Today` is a single hub page; the other four
 * are collapsible groups of existing pages, regrouped by job-to-be-done
 * rather than by when they were built. Secondary/operational tools live in
 * `useSecondaryTools` below, reachable through the compact "More tools" menu
 * instead of the primary rail.
 */
function useDestinations(isAdmin: boolean) {
  const today: NavItem = { to: "/today", label: "Today", icon: Compass };
  const projectsNav: NavItem = { to: "/projects", label: "Projects", icon: FolderKanban };

  const groupsBase: {
    key: DestinationGroupKey;
    label: string;
    icon: ComponentType<{ className?: string }>;
    items: NavItem[];
  }[] = [
    {
      key: "intelligence",
      label: "Intelligence",
      icon: LayoutDashboard,
      items: [
        { to: "/overview", label: "Overview", icon: LayoutDashboard },
        { to: "/mentions", label: "Mentions", icon: AtSign },
        { to: "/watchlist", label: "Watchlist", icon: Eye },
        { to: "/crisis", label: "Crisis Command", icon: ShieldAlert },
        { to: "/brief", label: "Executive Brief", icon: FileText },
        { to: "/personas", label: "Personas", icon: BarChart3 },
        { to: "/decisions", label: "Decision Log", icon: ClipboardCheck },
      ],
    },
    {
      key: "studio",
      label: "Studio",
      icon: SquarePen,
      items: [
        { to: "/new", label: "Response Studio", icon: SquarePen },
        { to: "/compare", label: "Compare Messages", icon: GitCompareArrows },
        { to: "/archive", label: "Test Archive", icon: Archive },
      ],
    },
    {
      key: "campaigns",
      label: "Campaigns",
      icon: Gauge,
      items: [
        { to: "/campaign-manager", label: "Campaign Manager", icon: Gauge },
        { to: "/campaign-calendar", label: "Campaign Calendar", icon: CalendarDays },
        { to: "/preflight", label: "Campaign Preflight", icon: ShieldCheck },
        { to: "/campaign-proof", label: "Campaign Proof", icon: FileCheck2 },
        { to: "/campaign-history", label: "Campaign History", icon: History },
        ...(isAdmin ? [{ to: "/always-on", label: "Content Planning", icon: CalendarClock }] : []),
      ],
    },
    {
      key: "results",
      label: "Results",
      icon: FileText,
      items: [
        ...(isAdmin
          ? [
              { to: "/performance", label: "Performance", icon: Activity },
              { to: "/performance/insights", label: "Performance Insights", icon: Sparkles },
            ]
          : []),
        { to: "/reports", label: "Reports", icon: FileText },
        { to: "/reports/builder", label: "Custom Report Builder", icon: FilePlus2 },
      ],
    },
  ];

  // Nested/detail routes (e.g. /campaign/post, /chat/$threadId) don't share a
  // URL prefix with any member item, so each group's active-matching also
  // checks its extra prefixes - see src/lib/navigation.ts.
  const groups = groupsBase.map((group) => ({
    ...group,
    matchPrefixes: [...group.items.map((item) => item.to), ...GROUP_EXTRA_PREFIXES[group.key]],
  }));

  return { today, projectsNav, groups };
}

/** Secondary/operational tools, reachable through the compact "More tools" menu. */
function useSecondaryTools(isAdmin: boolean) {
  return [
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/governance", label: "Governance & Data", icon: ShieldCheck },
    { to: "/changelog", label: "Changelog", icon: History },
    { to: "/help", label: "Help Centre", icon: HelpCircle },
    ...(isAdmin
      ? [
          { to: "/linked-accounts", label: "Linked Accounts", icon: UsersRound },
          { to: "/account-health", label: "X Account Health", icon: Activity },
          { to: "/admin/accounts", label: "Manage Connections", icon: Settings },
          { to: "/admin/activity", label: "Operational Activity", icon: ListChecks },
          { to: "/admin/health", label: "System Health", icon: ShieldCheck },
          { to: "/admin/workspaces", label: "Workspaces", icon: Building2 },
        ]
      : []),
  ];
}

function CollapsibleNavGroup({
  group,
  pathname,
  isCompactRail,
  open,
  onToggle,
}: {
  group: {
    key: DestinationGroupKey;
    label: string;
    icon: ComponentType<{ className?: string }>;
    items: NavItem[];
    matchPrefixes: string[];
  };
  pathname: string;
  isCompactRail: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const groupActive = isSectionActive(pathname, group.matchPrefixes);
  const isOpen = open || groupActive;
  const panelId = `nav-group-${group.key}`;

  if (isCompactRail) {
    // No room for a group header at 80px width - items render flat with tooltips,
    // same treatment the always-visible groups already use.
    return <NavGroup label="" items={group.items} pathname={pathname} isCompactRail />;
  }

  return (
    <div>
      <SidebarMenu className="px-2">
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls={panelId}
            className={cn(
              "min-h-11",
              groupActive ? "font-medium text-sidebar-primary" : "text-muted-foreground",
            )}
          >
            <group.icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{group.label}</span>
            <ChevronDown
              aria-hidden="true"
              className={cn("size-4 shrink-0 transition-transform", isOpen ? "" : "-rotate-90")}
            />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            initial={reduceMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <NavGroup label="" items={group.items} pathname={pathname} isCompactRail={false} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { isAdmin, profile } = useNavAreas();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profilePath = isAdmin ? "/admin/profile" : "/profile";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const { today, projectsNav, groups } = useDestinations(isAdmin);
  const secondaryTools = useSecondaryTools(isAdmin);
  const secondaryActive = secondaryTools.some((item) => pathname.startsWith(item.to));

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Single source of truth for "is this the 80px icon-only rail" — every
  // child below reads this, never the raw `collapsed`/`state` value, so
  // the mobile drawer (which shares `state="collapsed"` sometimes) never
  // inherits the compact rendering.
  const { state, isMobile } = useSidebar();
  const isCompactRail = state === "collapsed" && !isMobile;
  const todayActive = pathname.startsWith(today.to);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={cn("border-b border-sidebar-border p-3", isCompactRail && "px-3")}>
        <Link
          to="/today"
          aria-label="SMAIT, go to Today"
          className={cn("flex items-center gap-3", isCompactRail && "justify-center")}
        >
          {isCompactRail ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              S
            </span>
          ) : (
            <>
              <img
                src="/smait-logo.svg"
                alt="SMAIT logo"
                className="h-7 w-auto shrink-0 object-contain"
              />
              <span className="min-w-0">
                <span className="block truncate type-card font-semibold">
                  <span className="text-primary">SMAIT</span>
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  Communications workspace
                </span>
              </span>
            </>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className={cn("px-2 pt-2", isCompactRail && "items-center")}>
          <SidebarMenuItem className={cn(isCompactRail && "w-auto")}>
            <SidebarMenuButton
              onClick={() => navigate({ to: "/publish", search: { choose: true } })}
              tooltip="New campaign"
              aria-label="New campaign"
              className={cn(
                "bg-primary text-primary-foreground hover:bg-primary/90",
                isCompactRail ? "!size-12 !p-0 justify-center" : "min-h-11",
              )}
            >
              <Plus className={cn("shrink-0", isCompactRail ? "size-5" : "size-4")} />
              {!isCompactRail && <span>New campaign</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Today: standalone primary destination, always visible, never collapsible. */}
        <SidebarMenu className={cn("px-2 pt-1", isCompactRail && "items-center")}>
          <SidebarMenuItem className={cn(isCompactRail && "w-auto")}>
            <SidebarMenuButton
              asChild
              isActive={todayActive}
              tooltip="Today"
              className={cn(
                "relative overflow-hidden",
                isCompactRail ? "!size-11 !p-0 justify-center" : "min-h-11",
                todayActive &&
                  "bg-sidebar-primary/10 font-medium text-sidebar-primary hover:bg-sidebar-primary/15 hover:text-sidebar-primary data-[active=true]:bg-sidebar-primary/10 data-[active=true]:text-sidebar-primary",
              )}
            >
              <Link
                to={today.to}
                aria-current={todayActive ? "page" : undefined}
                aria-label="Today"
              >
                {todayActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-sidebar-primary"
                  />
                )}
                <today.icon className={cn("shrink-0", isCompactRail ? "size-5" : "size-4")} />
                {!isCompactRail && <span>Today</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Projects: standalone, next to Today - not one of the four
            collapsible groups, and deliberately not a mobile tab either
            (see MobileTabBar) - reachable there via the header switcher
            and command search instead, to keep five tabs, not six. */}
        <NavGroup
          label=""
          items={[{ ...projectsNav, label: "Projects" }]}
          pathname={pathname}
          isCompactRail={isCompactRail}
        />

        <SidebarSeparator className="mx-4 my-1" />

        {groups.map((group) => (
          <CollapsibleNavGroup
            key={group.key}
            group={group}
            pathname={pathname}
            isCompactRail={isCompactRail}
            open={Boolean(openGroups[group.key])}
            onToggle={() =>
              setOpenGroups((current) => ({ ...current, [group.key]: !current[group.key] }))
            }
          />
        ))}

        <SidebarSeparator className="mx-4 my-1" />
        <SidebarMenu className={cn("px-2", isCompactRail && "items-center")}>
          <SidebarMenuItem className={cn(isCompactRail && "w-auto")}>
            <SidebarMenuButton
              onClick={() => setSecondaryOpen((v) => !v)}
              tooltip="More tools"
              aria-label="More tools"
              aria-expanded={secondaryActive || secondaryOpen}
              aria-controls="secondary-tools-navigation"
              className={cn(
                "text-muted-foreground",
                isCompactRail ? "!size-11 !p-0 justify-center" : "min-h-11",
              )}
            >
              <LayoutGrid className={cn("shrink-0", isCompactRail ? "size-5" : "size-4")} />
              {!isCompactRail && <span>More tools</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {isCompactRail ? (
          <NavGroup label="" items={secondaryTools} pathname={pathname} isCompactRail />
        ) : (
          <CollapsibleSecondaryTools
            id="secondary-tools-navigation"
            items={secondaryTools}
            pathname={pathname}
            open={secondaryActive || secondaryOpen}
          />
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-between gap-2 px-2 pt-2 group-data-[collapsible=icon]:hidden">
          <span className="type-meta text-muted-foreground">SMAIT</span>
          <AboutPopover title="SMAIT" />
        </div>
        <SidebarMenu className={cn(isCompactRail && "items-center gap-1")}>
          <SidebarMenuItem className={cn(isCompactRail && "w-auto")}>
            <SidebarMenuButton
              asChild
              isActive={pathname === profilePath}
              tooltip={isAdmin ? "Admin Profile" : "Profile"}
              className={isCompactRail ? "!size-11 !p-0 justify-center" : "min-h-11"}
            >
              <Link
                to={profilePath}
                aria-current={pathname === profilePath ? "page" : undefined}
                aria-label={isAdmin ? "Admin Profile" : "Profile"}
              >
                {isCompactRail ? (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-positive text-[10px] font-semibold text-navy-foreground">
                    {initialsOf(profile?.fullName)}
                  </span>
                ) : (
                  <>
                    <Settings className="size-4 shrink-0" />
                    <span className="min-w-0 truncate">
                      {isAdmin ? "Admin Profile" : "Profile"}
                    </span>
                  </>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className={cn(isCompactRail && "w-auto")}>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip="Log out"
              aria-label="Log out"
              className={cn(
                "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                isCompactRail ? "!size-11 !p-0 justify-center" : "min-h-11",
              )}
            >
              <LogOut className={cn("shrink-0", isCompactRail ? "size-5" : "size-4")} />
              {!isCompactRail && <span>Log out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function CollapsibleSecondaryTools({
  id,
  items,
  pathname,
  open,
}: {
  id: string;
  items: NavItem[];
  pathname: string;
  open: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          id={id}
          initial={reduceMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduceMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <NavGroup label="" items={items} pathname={pathname} isCompactRail={false} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MobileTabBar({ isAdmin, pathname }: { isAdmin: boolean; pathname: string }) {
  const { today, groups } = useDestinations(isAdmin);
  const secondaryTools = useSecondaryTools(isAdmin);

  // Five primary destinations, one tab each. A group's tab links to its
  // first/most-used member page; the tab still lights up for every route
  // inside that group, including nested ones, via the same startsWith check.
  const tabs: (NavItem & { matches: string[] })[] = [
    { ...today, matches: [today.to] },
    ...groups.map((group) => ({
      to: group.items[0]!.to,
      label: group.label,
      icon: group.icon,
      matches: group.matchPrefixes,
    })),
  ];

  const activeSecondary = secondaryTools.find((item) => pathname.startsWith(item.to));

  const itemClass = (active: boolean) =>
    cn(
      "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 type-meta font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      active ? "text-primary" : "text-muted-foreground",
    );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
    >
      {activeSecondary ? (
        <span className="absolute -top-8 left-3 rounded-t-lg border border-b-0 border-border bg-background px-3 py-1 type-meta font-semibold text-foreground shadow-sm">
          More tools · {activeSecondary.label}
        </span>
      ) : null}
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const active = isSectionActive(pathname, tab.matches);
          return (
            <li key={tab.label}>
              <Link
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                <tab.icon className="size-5" aria-hidden="true" />
                <span className="max-w-full truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type NotificationCategoryKey = "all" | "mentions" | "system";

function timeAgoShort(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (!Number.isFinite(mins)) return "";
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function NotificationsBell() {
  const { items, unread, markRead } = useNotifications();
  const [expanded, setExpanded] = useState<NotificationCategoryKey | null>(null);

  const mentions = items.filter((notification) => notification.kind === "mention");
  const system = items.filter(
    (notification) => notification.kind === "official" || notification.kind === "campaign",
  );

  const categories: {
    key: NotificationCategoryKey;
    label: string;
    icon: ComponentType<{ className?: string }>;
    items: typeof items;
  }[] = [
    { key: "all", label: "All", icon: Bell, items },
    { key: "mentions", label: "Mentions", icon: AtSign, items: mentions },
    { key: "system", label: "System", icon: Settings2, items: system },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-10"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          title="Notifications"
        >
          <Bell className="size-[18px]" aria-hidden="true" />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-2 top-2 size-2 rounded-full border-2 border-background bg-primary"
            />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="type-card font-semibold">Notifications</p>
        </div>
        <div className="space-y-1.5 p-1.5">
          {categories.map((category) => {
            const categoryUnread = category.items.filter(
              (notification) => !notification.read,
            ).length;
            const isOpen = expanded === category.key;
            return (
              <Collapsible
                key={category.key}
                open={isOpen}
                onOpenChange={(open) => setExpanded(open ? category.key : null)}
              >
                <div className="rounded-xl border border-border bg-card">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                        <category.icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 type-meta font-semibold">
                        {category.label}
                      </span>
                      {category.items.length > 0 ? (
                        <Badge
                          variant="secondary"
                          className="border-transparent bg-primary/10 text-primary"
                        >
                          {categoryUnread > 0 ? categoryUnread : category.items.length}
                        </Badge>
                      ) : null}
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-180",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-border px-3 py-2">
                    {category.items.length === 0 ? (
                      <p className="py-1.5 type-meta text-muted-foreground">
                        Nothing here right now.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {category.items.slice(0, 3).map((notification) => (
                          <li key={notification.id}>
                            <Link
                              to={notification.href}
                              onClick={() => markRead([notification.id])}
                              className="flex items-start gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted"
                            >
                              {!notification.read ? (
                                <span
                                  aria-hidden="true"
                                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                                />
                              ) : (
                                <span className="mt-1.5 size-1.5 shrink-0" aria-hidden="true" />
                              )}
                              <span className="min-w-0 flex-1">
                                <span
                                  className={cn(
                                    "block truncate type-meta",
                                    notification.read
                                      ? "text-muted-foreground"
                                      : "font-semibold text-foreground",
                                  )}
                                >
                                  {notification.title}
                                </span>
                              </span>
                              <span className="mt-0.5 shrink-0 text-[11px] text-muted-foreground">
                                {timeAgoShort(notification.at)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      to="/notifications"
                      search={category.key === "all" ? {} : { category: category.key }}
                      className="mt-1.5 inline-block type-meta font-semibold text-primary hover:underline"
                    >
                      View all
                    </Link>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WorkspaceShell({
  children,
  title,
  className,
  wide,
  actions,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
  wide?: boolean;
  actions?: ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const { data: profile } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  const profilePath = isAdmin ? "/admin/profile" : "/profile";
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [pinned, setPinned] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider open={pinned || peeking} onOpenChange={setPinned}>
      <div className="flex min-h-screen w-full bg-transparent">
        <a
          href="#main-content"
          className="sr-only rounded-full bg-primary px-4 py-2 type-meta font-semibold text-primary-foreground focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50"
        >
          Skip to main content
        </a>
        <div
          className={pinned ? undefined : "sidebar-peek"}
          onMouseEnter={() => setPeeking(true)}
          onMouseLeave={() => setPeeking(false)}
          // Only keyboard focus re-opens the panel. A mouse click on a nav link
          // leaves focus inside the sidebar, and treating that as a peek left
          // the expanded panel floating over the page, swallowing clicks.
          onFocusCapture={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.matches?.(":focus-visible")) setPeeking(true);
          }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setPeeking(false);
          }}
        >
          <AppSidebar />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            aria-label="Page header"
            className="sticky top-0 z-20 flex h-[68px] items-center gap-2 border-b border-border/80 bg-background px-3 sm:gap-3 sm:px-4 lg:px-5"
          >
            <SidebarTrigger className="size-10" />
            <p className="min-w-0 flex-1 truncate type-card font-semibold">{title ?? "SMAIT"}</p>
            <div
              className="flex items-center gap-1 sm:gap-1.5"
              role="toolbar"
              aria-label="Page actions"
            >
              {actions}
              <ProjectSwitcher />
              <GlobalCommandPalette />
              <Button asChild className="hidden h-10 shrink-0 gap-1.5 lg:inline-flex">
                <Link to="/publish" search={{ choose: true }} title="Create campaign">
                  <Plus className="size-[18px]" aria-hidden="true" />
                  Create campaign
                </Link>
              </Button>
              <Button
                asChild
                size="icon"
                className="size-10 shrink-0 lg:hidden"
                aria-label="Create campaign"
              >
                <Link to="/publish" search={{ choose: true }} title="Create campaign">
                  <Plus className="size-[18px]" aria-hidden="true" />
                </Link>
              </Button>

              <NotificationsBell />
              <AnimatedThemeToggler
                isDark={theme === "dark"}
                toggle={toggle}
                className="hidden size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open profile menu"
                    aria-haspopup="menu"
                    className="ml-0.5 flex h-10 shrink-0 items-center gap-2 rounded-xl px-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pr-2.5"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-positive type-meta font-semibold text-navy-foreground">
                      {initialsOf(profile?.fullName)}
                    </span>
                    <span className="hidden max-w-28 truncate type-meta font-semibold sm:block">
                      {profile?.fullName || (isAdmin ? "Admin" : "Profile")}
                    </span>
                    <ChevronDown
                      className="hidden size-3.5 shrink-0 text-muted-foreground sm:block"
                      aria-hidden="true"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 p-0">
                  <div className="border-b border-border px-4 py-3">
                    <AvatarLabelGroup
                      size="md"
                      title={profile?.fullName || (isAdmin ? "Admin" : "Profile")}
                      {...(profile?.email === undefined ? {} : { subtitle: profile.email })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
                    <div>
                      <p className="type-meta font-semibold text-foreground">Workspace plan</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Managed centrally</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Active
                    </span>
                  </div>
                  <div className="p-1.5">
                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link to={profilePath}>
                        <Settings className="size-4" aria-hidden="true" />
                        {isAdmin ? "Admin profile" : "Profile & settings"}
                      </Link>
                    </DropdownMenuItem>
                    {!isAdmin ? (
                      <DropdownMenuItem asChild>
                        <Link to="/profile" search={{ section: "plan" }}>
                          <CreditCard className="size-4" aria-hidden="true" />
                          Plan & usage
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuCheckboxItem
                      checked={theme === "dark"}
                      onCheckedChange={(checked) => {
                        if (checked !== (theme === "dark")) toggle();
                      }}
                    >
                      <Moon className="mr-2 size-4" aria-hidden="true" />
                      Dark mode
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <HelpCircle className="size-4" aria-hidden="true" />
                        Support
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48">
                        <DropdownMenuItem asChild>
                          <Link to="/help">Help Centre</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/help">Contact support</Link>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                      Log out
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            aria-label={title ?? "SMAIT"}
            className={cn(
              "reveal mx-auto w-full flex-1 px-4 pb-24 pt-5 sm:px-5 sm:pb-12 lg:px-6",
              wide ? "max-w-[1480px]" : "max-w-6xl",
              className,
            )}
          >
            {children}
          </main>
          <MobileTabBar isAdmin={isAdmin} pathname={pathname} />
        </div>
        <OfficialPostAlert />
        <IdleSessionGuard />
        <QuickAccessDock />
      </div>
    </SidebarProvider>
  );
}
