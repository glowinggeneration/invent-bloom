import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Archive,
  AtSign,
  Bell,
  ClipboardCheck,
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

const BASE_COMMANDS = [
  {
    label: "Overview",
    description: "Executive brand health and intelligence",
    to: "/overview",
    icon: LayoutDashboard,
  },
  {
    label: "Executive Brief",
    description: "Leadership summary of what changed and what to do next",
    to: "/brief",
    icon: FileText,
  },
  {
    label: "Crisis Command",
    description: "Fast-moving risks, amplification and response actions",
    to: "/crisis",
    icon: ShieldAlert,
  },
  {
    label: "Mentions",
    description: "Investigate monitored posts and articles",
    to: "/mentions",
    icon: AtSign,
  },
  {
    label: "Monitoring Watchlist",
    description: "Prioritise sources, people, organisations and keywords",
    to: "/watchlist",
    icon: Eye,
  },
  {
    label: "Notifications",
    description: "Official-post opportunities, campaign updates and priority risks",
    to: "/notifications",
    icon: Bell,
  },
  {
    label: "Response Studio",
    description: "Test a message with personas",
    to: "/new",
    icon: SquarePen,
  },
  {
    label: "Compare messages",
    description: "Test two or three variants side by side",
    to: "/compare",
    icon: GitCompareArrows,
  },
  { label: "Personas", description: "Browse the persona panel", to: "/personas", icon: UsersRound },
  {
    label: "Campaign Preflight",
    description: "Check readiness and risk before campaign launch",
    to: "/preflight",
    icon: ShieldCheck,
  },
  {
    label: "Campaigns",
    description: "Track running and completed campaigns",
    to: "/campaign-manager",
    icon: Gauge,
  },
  {
    label: "Campaign Proof",
    description: "Execution and result record for each campaign",
    to: "/campaign-proof",
    icon: FileCheck2,
  },
  {
    label: "Decision Log",
    description: "Record intelligence decisions, owners and results",
    to: "/decisions",
    icon: ClipboardCheck,
  },
  {
    label: "Reports",
    description: "Automated and managed reports",
    to: "/reports",
    icon: FileText,
  },
  {
    label: "Custom Report Builder",
    description: "Choose report sections and generate a PDF",
    to: "/reports/builder",
    icon: FilePlus2,
  },
  { label: "Archive", description: "Past message tests", to: "/archive", icon: Archive },
  {
    label: "Governance & Data",
    description: "Responsible use, privacy and data handling",
    to: "/governance",
    icon: ShieldCheck,
  },
  {
    label: "Changelog",
    description: "Material product improvements",
    to: "/changelog",
    icon: History,
  },
  {
    label: "Help Centre",
    description: "Search platform guidance and troubleshooting",
    to: "/help",
    icon: HelpCircle,
  },
  {
    label: "My Profile",
    description: "Your identity, appearance and personal preferences",
    to: "/profile",
    icon: UserRound,
  },
] as const;

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
            },
            {
              label: "Performance",
              description: "Campaign and post-campaign measurement",
              to: "/performance",
              search: undefined,
              icon: Activity,
            },
            {
              label: "Performance insights",
              description: "Previous-period comparison, timing and unusual movement",
              to: "/performance/insights",
              search: undefined,
              icon: Sparkles,
            },
            {
              label: "Linked Accounts",
              description: "Account readiness, provider balance and current write costs",
              to: "/linked-accounts",
              search: undefined,
              icon: UsersRound,
            },
            {
              label: "Manage account connections",
              description: "Import, reconnect and verify authorised X sessions",
              to: "/admin/accounts",
              search: undefined,
              icon: Settings,
            },
            {
              label: "X Account Health",
              description:
                "Account readiness, recent activity, queue load and protection guardrails",
              to: "/account-health",
              search: undefined,
              icon: Activity,
            },
            {
              label: "System Health",
              description: "Monitoring, queues, account readiness and delivery",
              to: "/admin/health",
              search: undefined,
              icon: ShieldCheck,
            },
            {
              label: "Operational Activity",
              description: "Read-only campaign, publishing and test activity",
              to: "/admin/activity",
              search: undefined,
              icon: ListChecks,
            },
          ]
        : []),
    ];
    const q = query.trim().toLowerCase();
    return q
      ? list.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(q))
      : list;
  }, [isAdmin, query]);

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
              {commands.length ? (
                <div className="grid gap-1">
                  {commands.map((command) => {
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
                          <span className="block type-body font-semibold">{command.label}</span>
                          <span className="block truncate type-meta text-muted-foreground">
                            {command.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
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
