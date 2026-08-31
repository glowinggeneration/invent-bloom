import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Archive,
  AtSign,
  BarChart3,
  Bell,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FileCheck2,
  FileText,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SquarePen,
  Sun,
  UsersRound,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { OfficialPostAlert } from "@/components/official-post-alert";
import { IdleSessionGuard } from "@/components/idle-session-guard";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { isAdminEmail } from "@/lib/access";
import { useNotifications } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { GlobalCommandPalette } from "@/components/global-command";
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
} from "@/components/ui/sidebar";
import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }> };

function useNavAreas() {
  const { data: profile } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  return { isAdmin, profile };
}

const activeNavClass =
  "data-[active=true]:relative data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1/2 data-[active=true]:before:h-5 data-[active=true]:before:w-[3px] data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:rounded-full data-[active=true]:before:bg-primary";

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className={activeNavClass}
                >
                  <Link to={item.to} aria-current={active ? "page" : undefined} title={item.label}>
                    <item.icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
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

function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { isAdmin, profile } = useNavAreas();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profilePath = isAdmin ? "/admin/profile" : "/profile";
  const [showMore, setShowMore] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const workspaceItems: NavItem[] = [
    { to: "/overview", label: "Overview", icon: LayoutDashboard },
    { to: "/mentions", label: "Mentions", icon: AtSign },
  ];

  const workItems: NavItem[] = [
    { to: "/campaign-manager", label: "Campaigns", icon: Gauge },
    { to: "/new", label: "Response Studio", icon: SquarePen },
    ...(isAdmin ? [{ to: "/performance", label: "Performance", icon: Activity }] : []),
    { to: "/reports", label: "Reports", icon: FileText },
  ];

  const moreItems: NavItem[] = [
    { to: "/personas", label: "Personas", icon: BarChart3 },
    { to: "/brief", label: "Executive Brief", icon: FileText },
    { to: "/watchlist", label: "Watchlist", icon: Eye },
    { to: "/crisis", label: "Crisis Command", icon: ShieldAlert },
    { to: "/decisions", label: "Decision Log", icon: ClipboardCheck },
    { to: "/preflight", label: "Campaign Preflight", icon: ShieldCheck },
    { to: "/campaign-proof", label: "Campaign Proof", icon: FileCheck2 },
    { to: "/archive", label: "Test Archive", icon: Archive },
    ...(isAdmin
      ? [
          { to: "/linked-accounts", label: "Linked Accounts", icon: UsersRound },
          { to: "/account-health", label: "X Account Health", icon: Activity },
          { to: "/always-on", label: "Content Planning", icon: CalendarClock },
          { to: "/admin/health", label: "System Health", icon: ShieldCheck },
        ]
      : []),
  ];

  const moreActive = moreItems.some((item) => pathname.startsWith(item.to));
  const moreOpen = showMore || moreActive;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <Link to="/overview" className="flex items-center gap-3" title="CommsIQ">
          <img
            src="/smait-logo.svg"
            alt="SMAIT logo"
            className="h-7 w-auto shrink-0 object-contain group-data-[collapsible=icon]:h-6"
          />
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate type-card font-semibold">
              <span className="text-primary">CommsIQ</span>
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              Communications workspace
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="px-2 pt-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate({ to: "/publish", search: { choose: true } })}
              tooltip="New campaign"
              title="New campaign"
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            >
              <Plus className="size-4 shrink-0" />
              <span>New campaign</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <NavGroup label="Workspace" items={workspaceItems} pathname={pathname} />
        <NavGroup label="Work" items={workItems} pathname={pathname} />

        <SidebarSeparator className="mx-4 my-1" />
        <SidebarMenu className="px-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setShowMore((v) => !v)}
              tooltip="More"
              title="More"
              aria-expanded={moreOpen}
              className="text-muted-foreground"
            >
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 transition-transform motion-reduce:transition-none",
                  moreOpen ? "" : "-rotate-90",
                )}
              />
              <span>More</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
            moreOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <NavGroup label="" items={moreItems} pathname={pathname} />
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith("/help")}
              tooltip="Help"
              className={activeNavClass}
            >
              <Link to="/help" title="Help">
                <HelpCircle className="size-4 shrink-0" />
                <span>Help</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === profilePath}
              tooltip={isAdmin ? "Admin Profile" : "Profile"}
              className={activeNavClass}
            >
              <Link to={profilePath} title={isAdmin ? "Admin Profile" : "Profile"}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-fkf-green text-[10px] font-semibold text-navy-foreground">
                  {initialsOf(profile?.fullName)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {profile?.fullName || (isAdmin ? "Admin Profile" : "Profile")}
                </span>
                <Settings className="size-4 shrink-0 opacity-60 group-data-[collapsible=icon]:hidden" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Log out" title="Log out">
              <LogOut className="size-4 shrink-0" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function MobileTabBar({ isAdmin, pathname }: { isAdmin: boolean; pathname: string }) {
  const standardItems: NavItem[] = [
    { to: "/overview", label: "Overview", icon: LayoutDashboard },
    { to: "/mentions", label: "Mentions", icon: AtSign },
  ];
  const trailingItems: NavItem[] = [
    { to: "/campaign-manager", label: "Campaigns", icon: Gauge },
    ...(isAdmin
      ? [{ to: "/performance", label: "Performance", icon: Activity }]
      : [{ to: "/reports", label: "Reports", icon: FileText }]),
  ];
  const secondaryItems: NavItem[] = [
    { to: "/new", label: "Response Studio", icon: SquarePen },
    { to: "/reports", label: "Reports", icon: FileText },
    { to: "/personas", label: "Personas", icon: BarChart3 },
    { to: "/brief", label: "Executive Brief", icon: FileText },
    { to: "/watchlist", label: "Watchlist", icon: Eye },
    { to: "/crisis", label: "Crisis Command", icon: ShieldAlert },
    { to: "/decisions", label: "Decision Log", icon: ClipboardCheck },
    { to: "/preflight", label: "Campaign Preflight", icon: ShieldCheck },
    { to: "/campaign-proof", label: "Campaign Proof", icon: FileCheck2 },
    { to: "/archive", label: "Test Archive", icon: Archive },
    { to: "/help", label: "Help Centre", icon: HelpCircle },
    {
      to: isAdmin ? "/admin/profile" : "/profile",
      label: isAdmin ? "Admin Profile" : "Profile",
      icon: Settings,
    },
    ...(isAdmin
      ? [
          { to: "/linked-accounts", label: "Linked Accounts", icon: UsersRound },
          { to: "/account-health", label: "X Account Health", icon: Activity },
          { to: "/always-on", label: "Content Planning", icon: CalendarClock },
          { to: "/admin/health", label: "System Health", icon: ShieldCheck },
        ]
      : []),
  ];
  const activeSecondary = secondaryItems.find((item) => pathname.startsWith(item.to));

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
          More · {activeSecondary.label}
        </span>
      ) : null}
      <ul className="grid grid-cols-5">
        {standardItems.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                <item.icon className="size-5" aria-hidden="true" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}

        <li>
          <Link
            to="/publish"
            search={{ choose: true }}
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 type-meta font-semibold text-foreground"
          >
            <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Plus className="size-5" />
            </span>
            <span>Create</span>
          </Link>
        </li>

        {trailingItems.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                <item.icon className="size-5" aria-hidden="true" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function NotificationsBell() {
  const { unread } = useNotifications();
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative size-9"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Link to="/notifications">
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>
    </Button>
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
          onFocusCapture={() => setPeeking(true)}
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
            className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border/80 bg-background/90 px-3 backdrop-blur-xl sm:gap-3 sm:px-4 lg:px-5"
          >
            <SidebarTrigger className="size-9" />
            <p className="min-w-0 flex-1 truncate type-card font-semibold">
              {title ?? "CommsIQ"}
            </p>
            <div
              className="flex items-center gap-1 sm:gap-2"
              role="toolbar"
              aria-label="Page actions"
            >
              {actions}
              <GlobalCommandPalette />
              <Button asChild size="sm" className="hidden shrink-0 sm:inline-flex">
                <Link to="/publish" search={{ choose: true }}>
                  <Plus className="size-4" />
                  <span className="hidden md:inline">Create</span>
                </Link>
              </Button>
              <NotificationsBell />
              <Button
                variant="ghost"
                size="icon"
                className="hidden size-9 md:inline-flex"
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                onClick={toggle}
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
              <Link
                to={profilePath}
                aria-label={isAdmin ? "Admin profile" : "Profile"}
                className="flex size-8 items-center justify-center rounded-full bg-fkf-green type-meta font-semibold text-navy-foreground sm:size-9"
              >
                {initialsOf(profile?.fullName)}
              </Link>
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            aria-label={title ?? "CommsIQ"}
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
      </div>
    </SidebarProvider>
  );
}
