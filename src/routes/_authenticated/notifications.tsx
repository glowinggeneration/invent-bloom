import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Clock3,
  ExternalLink,
  Megaphone,
  Radar,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";

import { WorkspaceShell } from "@/components/workspace-shell";
import {
  Card,
  EmptyState,
  PageTabs,
  PageTitle,
  PageToolbar,
  SectionTitle,
  StatCard,
} from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useNotifications } from "@/hooks/use-notifications";
import type { NegativeAlertLevel } from "@/lib/notification-preferences";
import type { AppNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications - SMAIT" },
      {
        name: "description",
        content:
          "Fresh official posts, priority communication risks and campaign updates that need attention.",
      },
    ],
  }),
  component: NotificationsPage,
});

type NotificationView = "all" | "unread" | "action" | "critical";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (!Number.isFinite(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function severityBadge(severity: AppNotification["severity"]) {
  if (severity === "critical") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" /> Critical
      </Badge>
    );
  }
  if (severity === "action") {
    return (
      <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10">
        <Clock3 className="size-3" /> Action needed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Radar className="size-3" /> Update
    </Badge>
  );
}

function actionLabel(notification: AppNotification) {
  if (notification.kind === "official") return "Review opportunity";
  if (notification.kind === "mention") return "Review mention";
  return "Open campaign";
}

const NEGATIVE_LEVELS: { value: NegativeAlertLevel; label: string; description: string }[] = [
  {
    value: "critical",
    label: "Critical only",
    description:
      "Strong criticism or damaging posts with material reach, reply or verified-account signals.",
  },
  {
    value: "important",
    label: "Important + critical",
    description: "Earlier warning for direct, verified or fast-growing negative attention.",
  },
  {
    value: "off",
    label: "Off",
    description: "Keep negative posts in Mentions without adding notification-centre alerts.",
  },
];

function NotificationsPage() {
  const { items, unread, isPending, refresh, markRead, markAllRead, preferences, setPreferences } =
    useNotifications();
  const [view, setView] = useState<NotificationView>("all");
  const [query, setQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const counts = useMemo(
    () => ({
      all: items.length,
      unread,
      action: items.filter((item) => item.severity === "action").length,
      critical: items.filter((item) => item.severity === "critical").length,
    }),
    [items, unread],
  );

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (view === "unread" && item.read) return false;
      if (view === "action" && item.severity !== "action") return false;
      if (view === "critical" && item.severity !== "critical") return false;
      return !term || `${item.title} ${item.body} ${item.kind}`.toLowerCase().includes(term);
    });
  }, [items, query, view]);

  const tabs = [
    { value: "all" as const, label: "All", count: counts.all },
    { value: "unread" as const, label: "Unread", count: counts.unread },
    { value: "action" as const, label: "Action needed", count: counts.action },
    { value: "critical" as const, label: "Critical", count: counts.critical },
  ];

  return (
    <WorkspaceShell title="Notifications">
      <PageTitle
        description="Fresh official posts, priority risks and campaign updates in one action-focused inbox."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
              <RefreshCw className={cn("size-4", isPending && "animate-spin")} /> Refresh
            </Button>
            {unread > 0 ? (
              <Button variant="outline" size="sm" onClick={markAllRead}>
                <CheckCheck className="size-4" /> Mark all read
              </Button>
            ) : null}
          </>
        }
      >
        Notifications
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Unread" value={unread} icon={Bell} />
        <StatCard
          label="Action needed"
          value={counts.action}
          icon={Megaphone}
          tone={counts.action ? "neutral" : "default"}
        />
        <StatCard
          label="Critical risks"
          value={counts.critical}
          icon={AlertTriangle}
          tone={counts.critical ? "negative" : "default"}
        />
      </div>

      <PageTabs
        className="mt-5"
        items={tabs}
        value={view}
        onChange={setView}
        ariaLabel="Notification filters"
      />

      <PageToolbar className="mt-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notifications…"
            className="h-10 bg-background pl-9"
          />
        </div>
        <Button
          variant={showSettings ? "secondary" : "outline"}
          size="sm"
          className="sm:ml-auto"
          aria-expanded={showSettings}
          onClick={() => setShowSettings((current) => !current)}
        >
          <Settings2 className="size-4" /> Alert settings
        </Button>
      </PageToolbar>

      {showSettings ? (
        <Card className="mt-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SectionTitle>Alert settings</SectionTitle>
              <p className="type-meta mt-1 text-muted-foreground">
                These preferences affect this device only. They do not create email, push, Slack or
                external notifications.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
              Done
            </Button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border border-border p-4">
              <Checkbox
                checked={preferences.officialPosts}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, officialPosts: checked === true })
                }
                className="mt-0.5"
              />
              <span>
                <span className="type-body block font-semibold">Fresh official-post alerts</span>
                <span className="type-meta mt-1 block text-muted-foreground">
                  Show the timed popup and inbox alert when a tracked official account publishes a
                  fresh official post.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-border p-4">
              <Checkbox
                checked={preferences.campaignCompletions}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, campaignCompletions: checked === true })
                }
                className="mt-0.5"
              />
              <span>
                <span className="type-body block font-semibold">Campaign completion alerts</span>
                <span className="type-meta mt-1 block text-muted-foreground">
                  Show an update when a current Campaign Manager run reaches completion.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-5">
            <SectionTitle>Negative mention sensitivity</SectionTitle>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {NEGATIVE_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  aria-pressed={preferences.negativeMentions === level.value}
                  onClick={() => setPreferences({ ...preferences, negativeMentions: level.value })}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    preferences.negativeMentions === level.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40",
                  )}
                >
                  <span className="type-body block font-semibold">{level.label}</span>
                  <span className="type-meta mt-1 block text-muted-foreground">
                    {level.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="mt-4">
        {shown.length === 0 ? (
          <EmptyState
            title={
              isPending
                ? "Checking for updates"
                : items.length
                  ? "Nothing matches this view"
                  : "Nothing needs you right now"
            }
            description={
              isPending
                ? "Reading official posts, campaign updates and monitored risk signals."
                : items.length
                  ? "Choose another notification filter or clear the search."
                  : "Fresh official posts, completed campaigns and priority communication risks will appear here."
            }
          />
        ) : (
          <ul className="space-y-3">
            {shown.map((notification) => (
              <li key={notification.id}>
                <Card
                  className={cn(
                    "p-4 transition-opacity sm:p-5",
                    notification.severity === "critical" &&
                      !notification.read &&
                      "border-destructive/40",
                    notification.severity === "action" &&
                      !notification.read &&
                      "border-primary/40 bg-primary/[0.025]",
                    notification.read && "opacity-70",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 grid size-10 shrink-0 place-items-center rounded-full",
                        notification.severity === "critical"
                          ? "bg-destructive/10 text-destructive"
                          : notification.severity === "action"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {notification.severity === "critical" ? (
                        <AlertTriangle className="size-4" />
                      ) : notification.severity === "action" ? (
                        <Megaphone className="size-4" />
                      ) : (
                        <Radar className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start gap-2">
                        <p
                          className={cn(
                            "min-w-0 flex-1 type-card font-semibold",
                            notification.read && "text-muted-foreground",
                          )}
                        >
                          {notification.title}
                        </p>
                        {severityBadge(notification.severity)}
                        {!notification.read ? (
                          <span
                            className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                            aria-label="Unread"
                          />
                        ) : (
                          <Check
                            className="mt-1.5 size-4 text-muted-foreground"
                            aria-label="Read"
                          />
                        )}
                      </div>
                      <p className="type-meta mt-1.5 max-w-3xl text-muted-foreground">
                        {notification.body}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button asChild size="sm" onClick={() => markRead([notification.id])}>
                          <Link to={notification.href}>{actionLabel(notification)}</Link>
                        </Button>
                        {notification.sourceUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={notification.sourceUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-4" /> Source
                            </a>
                          </Button>
                        ) : null}
                        <span className="type-meta text-muted-foreground">
                          {timeAgo(notification.at)}
                        </span>
                        {!notification.read ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="sm:ml-auto"
                            onClick={() => markRead([notification.id])}
                          >
                            <Check className="size-4" /> Mark read
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="type-meta mt-6 flex items-center gap-2 text-muted-foreground">
        <Bell className="size-3.5" /> Read state and alert preferences are kept on this device.
      </p>
    </WorkspaceShell>
  );
}
