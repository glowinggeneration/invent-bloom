import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  ChevronDown,
  FileText,
  Radar,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, PageTitle, SectionTitle } from "@/components/ui-kit";

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
  const [expanded, setExpanded] = useState<number[]>([0]);

  function toggle(index: number) {
    setExpanded((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  }

  return (
    <WorkspaceShell title="Changelog" wide>
      <PageTitle description="A concise internal record of material product changes. Minor fixes and maintenance are intentionally omitted.">
        Changelog
      </PageTitle>

      <Card className="mt-6 p-5">
        <div className="flex items-start gap-3">
          <Wrench className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <SectionTitle>How to read this page</SectionTitle>
            <p className="type-body mt-2 max-w-4xl leading-7 text-muted-foreground">
              This is a user-facing product summary, not a technical deployment log. It describes
              changes that affect how teams monitor, decide, test, execute or report without
              exposing internal architecture, credentials or proprietary implementation details.
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-4">
        {ENTRIES.map((entry, index) => {
          const Icon = entry.icon;
          return (
            <Card key={`${entry.title}-${index}`} className="p-0">
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-expanded={expanded.includes(index)}
                className="flex w-full items-start gap-3 p-5 text-left sm:p-6"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10">
                  <Icon className="size-5 text-primary" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block type-meta font-semibold text-muted-foreground">
                    {entry.date}
                  </span>
                  <span className="mt-1 block type-section">{entry.title}</span>
                  <span className="mt-1 block type-meta text-muted-foreground">
                    {entry.items.length} updates
                  </span>
                </span>
                <ChevronDown
                  className={`mt-1 size-5 shrink-0 text-muted-foreground transition-transform ${expanded.includes(index) ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {expanded.includes(index) ? (
                <ul className="border-t border-border px-6 pb-6 pt-4 list-disc space-y-2 pl-11 type-body leading-7 text-muted-foreground">
                  {entry.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </Card>
          );
        })}
      </div>
    </WorkspaceShell>
  );
}
