import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Archive,
  AtSign,
  Bell,
  BarChart3,
  ClipboardCheck,
  Compass,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  Gauge,
  GitCompareArrows,
  HelpCircle,
  History,
  LayoutDashboard,
  ListChecks,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SquarePen,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProgressiveBlur } from "@/components/core/progressive-blur";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";

/**
 * Grouped to match the five sidebar destinations exactly (`group` is a
 * display heading here, not a route) so command search and navigation never
 * disagree about where something lives. "Secondary" mirrors the sidebar's
 * compact "More tools" menu.
 */
const BASE_COMMANDS = [
  {
    label: "Today",
    description: "Start an investigation, a message test or a campaign",
    to: "/today",
    icon: Compass,
    group: "Today",
  },
  {
    label: "Overview",
    description: "Executive brand health and intelligence",
    to: "/overview",
    icon: LayoutDashboard,
    group: "Intelligence",
  },
  {
    label: "Executive Brief",
    description: "Leadership summary of what changed and what to do next",
    to: "/brief",
    icon: FileText,
    group: "Intelligence",
  },
  {
    label: "Crisis Command",
    description: "Fast-moving risks, amplification and response actions",
    to: "/crisis",
    icon: ShieldAlert,
    group: "Intelligence",
  },
  {
    label: "Mentions",
    description: "Investigate monitored posts and articles",
    to: "/mentions",
    icon: AtSign,
    group: "Intelligence",
  },
  {
    label: "Monitoring Watchlist",
    description: "Prioritise sources, people, organisations and keywords",
    to: "/watchlist",
    icon: Eye,
    group: "Intelligence",
  },
  {
    label: "Personas",
    description: "Browse the persona panel",
    to: "/personas",
    icon: BarChart3,
    group: "Intelligence",
  },
  {
    label: "Decision Log",
    description: "Record intelligence decisions, owners and results",
    to: "/decisions",
    icon: ClipboardCheck,
    group: "Intelligence",
  },
  {
    label: "Response Studio",
    description: "Test a message with personas",
    to: "/new",
    icon: SquarePen,
    group: "Studio",
  },
  {
    label: "Compare messages",
    description: "Test two or three variants side by side",
    to: "/compare",
    icon: GitCompareArrows,
    group: "Studio",
  },
  {
    label: "Archive",
    description: "Past message tests",
    to: "/archive",
    icon: Archive,
    group: "Studio",
  },
  {
    label: "Campaign Manager",
    description: "Track running and completed campaigns",
    to: "/campaign-manager",
    icon: Gauge,
    group: "Campaigns",
  },
  {
    label: "Campaign Calendar",
    description: "Plan timing around X's rate limits",
    to: "/campaign-calendar",
    icon: FileCheck2,
    group: "Campaigns",
  },
  {
    label: "Campaign Preflight",
    description: "Check readiness and risk before campaign launch",
    to: "/preflight",
    icon: ShieldCheck,
    group: "Campaigns",
  },
  {
    label: "Campaign Proof",
    description: "Execution and result record for each campaign",
    to: "/campaign-proof",
    icon: FileCheck2,
    group: "Campaigns",
  },
  {
    label: "Campaign History",
    description: "Which posts actually went out, by account and time",
    to: "/campaign-history",
    icon: History,
    group: "Campaigns",
  },
  {
    label: "Reports",
    description: "Automated and managed reports",
    to: "/reports",
    icon: FileText,
    group: "Results",
  },
  {
    label: "Custom Report Builder",
    description: "Choose report sections and generate a PDF",
    to: "/reports/builder",
    icon: FilePlus2,
    group: "Results",
  },
  {
    label: "Notifications",
    description: "Official-post opportunities, campaign updates and priority risks",
    to: "/notifications",
    icon: Bell,
    group: "Secondary",
  },
  {
    label: "Governance & Data",
    description: "Responsible use, privacy and data handling",
    to: "/governance",
    icon: ShieldCheck,
    group: "Secondary",
  },
  {
    label: "Changelog",
    description: "Material product improvements",
    to: "/changelog",
    icon: History,
    group: "Secondary",
  },
  {
    label: "Help Centre",
    description: "Search platform guidance and troubleshooting",
    to: "/help",
    icon: HelpCircle,
    group: "Secondary",
  },
  {
    label: "My Profile",
    description: "Your identity, appearance and personal preferences",
    to: "/profile",
    icon: UserRound,
    group: "Secondary",
  },
] as const;

const GROUP_ORDER = ["Today", "Intelligence", "Studio", "Campaigns", "Results", "Secondary"];

export function GlobalCommandPalette() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commands = useMemo(() => {
    const list = [
      {
        label: "Create campaign",
        description: "Choose Post or Reply",
        to: "/publish",
        search: { choose: true } as Record<string, unknown>,
        icon: Plus,
        group: "Today",
      },
      ...BASE_COMMANDS.map((item) => ({ ...item, search: undefined })),
      ...(isAdmin
        ? [
            {
              label: "Admin Profile",
              description: "Users, integrations and administrative shortcuts",
              to: "/admin/profile",
              search: undefined,
              icon: Settings,
              group: "Secondary",
            },
            {
              label: "Performance",
              description: "Campaign and post-campaign measurement",
              to: "/performance",
              search: undefined,
              icon: Activity,
              group: "Results",
            },
            {
              label: "Performance insights",
              description: "Previous-period comparison, timing and unusual movement",
              to: "/performance/insights",
              search: undefined,
              icon: Sparkles,
              group: "Results",
            },
            {
              label: "Content Planning",
              description: "Always-on editorial plan across linked accounts",
              to: "/always-on",
              search: undefined,
              icon: FileText,
              group: "Campaigns",
            },
            {
              label: "Linked Accounts",
              description: "Account readiness, provider balance and current write costs",
              to: "/linked-accounts",
              search: undefined,
              icon: UsersRound,
              group: "Secondary",
            },
            {
              label: "Manage account connections",
              description: "Import, reconnect and verify authorised X sessions",
              to: "/admin/accounts",
              search: undefined,
              icon: Settings,
              group: "Secondary",
            },
            {
              label: "X Account Health",
              description:
                "Account readiness, recent activity, queue load and protection guardrails",
              to: "/account-health",
              search: undefined,
              icon: Activity,
              group: "Secondary",
            },
            {
              label: "System Health",
              description: "Monitoring, queues, account readiness and delivery",
              to: "/admin/health",
              search: undefined,
              icon: ShieldCheck,
              group: "Secondary",
            },
            {
              label: "Operational Activity",
              description: "Read-only campaign, publishing and test activity",
              to: "/admin/activity",
              search: undefined,
              icon: ListChecks,
              group: "Secondary",
            },
          ]
        : []),
    ];
    const q = query.trim().toLowerCase();
    return q
      ? list.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(q))
      : list;
  }, [isAdmin, query]);

  const groupedCommands = useMemo(() => {
    const byGroup = new Map<string, typeof commands>();
    for (const command of commands) {
      const list = byGroup.get(command.group) ?? [];
      list.push(command);
      byGroup.set(command.group, list);
    }
    return GROUP_ORDER.map((group) => ({ group, items: byGroup.get(group) ?? [] })).filter(
      (section) => section.items.length > 0,
    );
  }, [commands]);

  function run(command: (typeof commands)[number]) {
    setOpen(false);
    setQuery("");
    navigate({ to: command.to, search: command.search } as unknown as Parameters<
      typeof navigate
    >[0]);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open search"
        title="Search"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[220px] sm:justify-start sm:border-border sm:bg-muted sm:px-3"
      >
        <Search aria-hidden="true" className="size-[18px] shrink-0" />
        <span className="hidden flex-1 truncate text-left text-sm font-medium sm:inline">
          Search
        </span>
        <kbd className="hidden h-6 min-w-[34px] items-center justify-center rounded-md border border-border bg-background px-1.5 text-[11px] font-medium text-muted-foreground shadow-sm sm:inline-flex">
          {typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
            ? "⌘K"
            : "Ctrl K"}
        </kbd>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border p-4 pb-3">
            <DialogTitle>Go anywhere</DialogTitle>
          </DialogHeader>
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages and actions…"
                className="border-0 pl-9 shadow-none focus-visible:ring-0"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && commands[0]) run(commands[0]);
                }}
              />
            </div>
          </div>
          <div className="relative min-h-0 overflow-hidden">
            <div className="max-h-[55vh] overflow-y-auto px-2 pb-8 pt-5">
              {groupedCommands.length ? (
                <div className="grid gap-4">
                  {groupedCommands.map((section) => (
                    <div
                      key={section.group}
                      role="group"
                      aria-labelledby={`cmd-group-${section.group}`}
                    >
                      <p
                        id={`cmd-group-${section.group}`}
                        className="px-3 pb-1.5 type-meta font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {section.group}
                      </p>
                      <div className="grid gap-1">
                        {section.items.map((command) => {
                          const Icon = command.icon;
                          return (
                            <button
                              key={command.label}
                              type="button"
                              onClick={() => run(command)}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                                <Icon className="size-4 text-muted-foreground" />
                              </span>
                              <span className="min-w-0">
                                <span className="block type-body font-semibold">
                                  {command.label}
                                </span>
                                <span className="block truncate type-meta text-muted-foreground">
                                  {command.description}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-6 text-center type-meta text-muted-foreground">
                  No matching page or action.
                </p>
              )}
            </div>
            <ProgressiveBlur height="1.5rem" blurAmount="4px" />
            <ProgressiveBlur position="bottom" height="2rem" blurAmount="5px" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
