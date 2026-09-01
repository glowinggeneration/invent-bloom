import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, ChevronDown, FileText, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { PageTitle } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog - CommsIQ" },
      {
        name: "description",
        content: "Internal record of material CommsIQ product improvements.",
      },
    ],
  }),
  component: ChangelogPage,
});

const ENTRIES = [
  {
    date: "August 2026",
    title: "Intelligence and investigation improvements",
    icon: Radar,
    items: [
      "Overview now surfaces What Changed, narrative velocity, lifecycle, risks, opportunities and historical context.",
      "Mentions investigations support topic drill-down, source authority, importance filters and duplicate collapsing.",
      "Conversation context can show the earliest matching monitored item and observed amplification across connected sources.",
    ],
  },
  {
    date: "August 2026",
    title: "Message testing and execution flow",
    icon: Sparkles,
    items: [
      "Response Studio can compare two or three message variants side by side using the existing persona-testing engine.",
      "Recommended wording can move directly into the existing campaign workflow after review or editing.",
      "Reusable message templates can be stored locally in the browser for repeated communications work.",
    ],
  },
  {
    date: "August 2026",
    title: "Reporting and performance",
    icon: FileText,
    items: [
      "Overview can generate an FKF-branded PDF snapshot with Powered by Persona_Voices attribution.",
      "Performance Insights adds recent-vs-previous comparison, historical timing guidance and unusual movement flags.",
      "Reports continue to separate automated platform records from managed Persona_Voices deliverables.",
    ],
  },
  {
    date: "August 2026",
    title: "Reliability and administration",
    icon: Activity,
    items: [
      "Admin System Health shows monitoring freshness, queue backlog, account readiness and recent delivery health.",
      "Global search with Ctrl/⌘ K provides faster access to core pages and admin tools.",
      "Saved Mentions investigations provide reusable filters without creating another monitoring feed or API call.",
    ],
  },
  {
    date: "August 2026",
    title: "Support and governance",
    icon: ShieldCheck,
    items: [
      "The Help Centre now documents the full Monitor → Understand → Decide → Test → Run → Measure workflow.",
      "Governance & Data provides practical guidance on privacy, AI-assisted analysis, persona use, account governance and approval.",
      "WhatsApp support opens a prefilled platform-support message directly to Thabo.",
    ],
  },
] as const;

function ChangelogPage() {
  const [expanded, setExpanded] = useState<string[]>([ENTRIES[0].title]);
  const dates = Array.from(new Set(ENTRIES.map((entry) => entry.date)));

  function toggle(title: string) {
    setExpanded((current) =>
      current.includes(title) ? current.filter((item) => item !== title) : [...current, title],
    );
  }

  return (
    <WorkspaceShell title="Changelog">
      <PageTitle description="Material product changes that affect how teams monitor, decide, test, execute and report.">
        Changelog
      </PageTitle>

      <div className="grid gap-8">
        {dates.map((date) => {
          const entries = ENTRIES.filter((entry) => entry.date === date);
          return (
            <section key={date} aria-labelledby={`changelog-${date.replaceAll(" ", "-")}`}>
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2
                  id={`changelog-${date.replaceAll(" ", "-")}`}
                  className="type-card font-semibold"
                >
                  {date}
                </h2>
                <span className="type-meta text-muted-foreground">
                  {entries.length} product updates
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {entries.map((entry, index) => {
                  const Icon = entry.icon;
                  const isExpanded = expanded.includes(entry.title);
                  const contentId = `changelog-entry-${entry.title
                    .toLowerCase()
                    .replaceAll(/[^a-z0-9]+/g, "-")}`;

                  return (
                    <article
                      key={entry.title}
                      className={cn(index > 0 && "border-t border-border")}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(entry.title)}
                        aria-expanded={isExpanded}
                        aria-controls={contentId}
                        className="flex min-h-20 w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50 sm:px-6"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10">
                          <Icon className="size-5 text-primary" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block type-card font-semibold">{entry.title}</span>
                          <span className="mt-1 block type-meta text-muted-foreground">
                            {entry.items.length} updates
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-5 shrink-0 text-muted-foreground transition-transform",
                            isExpanded && "rotate-180",
                          )}
                          aria-hidden="true"
                        />
                      </button>

                      {isExpanded ? (
                        <div id={contentId} className="border-t border-border px-5 py-5 sm:px-6">
                          <ul className="grid gap-3 pl-14 type-body text-muted-foreground">
                            {entry.items.map((item) => (
                              <li
                                key={item}
                                className="relative pl-4 before:absolute before:left-0 before:top-[0.65em] before:size-1 before:rounded-full before:bg-muted-foreground/60"
                              >
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </WorkspaceShell>
  );
}
