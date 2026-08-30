import { createFileRoute } from "@tanstack/react-router";
import {
  Database,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, PageTitle, SectionTitle } from "@/components/ui-kit";
import { ContactSupportButton } from "@/components/contact-support";

export const Route = createFileRoute("/_authenticated/governance")({
  head: () => ({
    meta: [
      { title: "Governance & Data - FKF CommsIQ" },
      {
        name: "description",
        content:
          "Operational guidance for responsible platform use, privacy, data handling, persona governance and communications approval.",
      },
    ],
  }),
  component: GovernancePage,
});

const SECTIONS = [
  {
    id: "responsible-use",
    icon: ShieldCheck,
    title: "Responsible platform use",
    paragraphs: [
      "CommsIQ is an internal communications-intelligence and campaign-operations platform. Use it to understand monitored public conversation, test proposed messaging, coordinate authorised work and measure outcomes.",
      "Platform recommendations are decision support. A user remains responsible for deciding whether a public response, campaign or publication is appropriate, lawful and aligned with FKF policy.",
    ],
    bullets: [
      "Review the underlying mention or source before acting on an automated insight.",
      "Do not treat persona testing as polling, demographic truth or a guarantee of public behaviour.",
      "Do not use the platform to publish content that is unlawful, deceptive, harassing or outside the organisation's authorised communications mandate.",
      "Use pause, review and account-management controls when an execution pattern looks unusual or an account is unhealthy.",
    ],
  },
  {
    id: "privacy",
    icon: Fingerprint,
    title: "Privacy and data handling",
    paragraphs: [
      "The platform processes account, workspace, campaign, message-test and monitored public-content data needed to provide its functions. Users should only add information that is necessary for legitimate communications work.",
      "Public social posts and news coverage can still contain personal information. Treat the fact that information is publicly visible as different from permission to reuse it for unrelated purposes.",
    ],
    bullets: [
      "Avoid placing unnecessary private personal information in campaign briefs, message tests or report notes.",
      "Do not upload passwords, API keys, authentication cookies or other secrets into ordinary text fields or attachments.",
      "When exporting CSV, JSON or PDF files, store and share them according to the same access expectations as the platform data they contain.",
      "If information must be corrected or removed for a legal or contractual reason, escalate it to an administrator rather than editing unrelated records to hide the issue.",
    ],
  },
  {
    id: "retention",
    icon: Database,
    title: "Retention and data minimisation",
    paragraphs: [
      "Keep operational data only for as long as it remains useful for the organisation's approved purpose and any applicable legal, contractual or reporting obligation. This page does not impose a fixed retention period because the appropriate period depends on the deployed workspace and governing agreement.",
      "Archive and reporting features exist so historical evidence can be retained deliberately. Old operational records should not be kept indefinitely merely because storage is available.",
    ],
    bullets: [
      "Define retention periods with the workspace administrator and the organisation's legal or information-governance function.",
      "Prefer aggregated reporting when detailed account-level records are no longer required.",
      "Before deleting historical records, confirm whether they are needed for an active dispute, audit, investigation or contractual reporting obligation.",
    ],
  },
  {
    id: "residency",
    icon: LockKeyhole,
    title: "Data residency and hosting",
    paragraphs: [
      "The user interface does not independently prove the physical region in which every connected service stores or processes data. Data-residency commitments must therefore be confirmed against the actual deployment configuration, provider settings and applicable contract rather than inferred from this screen.",
      "If a client, regulator or procurement process requires a specific hosting or processing region, obtain written confirmation from the platform administrator before making a representation about residency.",
    ],
  },
  {
    id: "ai",
    icon: Sparkles,
    title: "AI and automated analysis",
    paragraphs: [
      "AI-assisted features can classify sentiment, group narratives, generate recommendations, test wording and summarise monitored information. These outputs can be incomplete or wrong, particularly where context is missing, language is ambiguous or the available dataset is narrow.",
      "The platform deliberately shows user-facing explanations and source links where practical so users can verify material decisions against the underlying evidence.",
    ],
    bullets: [
      "Verify high-impact sentiment, legal-risk and narrative findings before external action.",
      "Treat Likely origin as the earliest matching item visible in monitored data, not proof of the first publication anywhere online.",
      "Treat Source Authority and Mention Importance as prioritisation signals, not permanent judgements about a person or publication.",
      "Do not present persona confidence as scientific polling or statistically representative public opinion.",
    ],
  },
  {
    id: "personas",
    icon: UsersRound,
    title: "Persona and connected-account governance",
    paragraphs: [
      "Personas used for message testing are simulated audience perspectives. Connected accounts used for authorised campaign operations are a separate operational resource and should be governed through the Connected Accounts and campaign-control surfaces.",
      "Administrators should keep a clear record of which accounts are authorised for use, who is responsible for them and whether they are active, suspended or require a new session.",
    ],
    bullets: [
      "Do not describe simulated persona reactions as statements made by real members of the public.",
      "Do not use a connected account when its ownership, authorisation or operational status is unclear.",
      "Accounts that are suspended, inactive or missing a valid session should stay out of execution until restored through the authorised account-management process.",
      "Use campaign pacing and review controls to avoid execution patterns that are inconsistent with the organisation's approved operating policy.",
    ],
  },
  {
    id: "legal",
    icon: Scale,
    title: "Legal and reputational review",
    paragraphs: [
      "Legal-risk indicators and language checks are screening tools. They do not replace advice from qualified counsel or an authorised decision-maker where a matter is sensitive, disputed or legally consequential.",
      "Messages involving allegations, private individuals, active litigation, disciplinary matters, elections or official office-holders should receive the level of human review required by the organisation before publication.",
    ],
    bullets: [
      "Separate verified fact from allegation and opinion.",
      "Avoid unnecessary personal information and avoid presenting disputed claims as established fact.",
      "Preserve the original brief and relevant evidence where sign-off may later need to be demonstrated.",
      "If the legal-risk screen indicates elevated risk, use the organisation's approval process before execution.",
    ],
  },
  {
    id: "approval",
    icon: FileCheck2,
    title: "Approval and accountability",
    paragraphs: [
      "The platform records tests, reports and campaign activity so teams can reconstruct what was proposed, what was approved and what was executed. Users should not rely on informal approval outside the organisation's normal governance when formal sign-off is required.",
      "A final user action such as Run campaign or Publish represents an operational decision. Review the selected message, target, account set, timing and available safety information before confirming execution.",
    ],
  },
] as const;

function GovernancePage() {
  return (
    <WorkspaceShell title="Governance & Data" wide>
      <PageTitle description="Operational rules for responsible use, privacy, data handling, AI-assisted analysis and communications approval.">
        Governance & Data
      </PageTitle>

      <Card className="mt-6 p-5">
        <p className="type-body max-w-4xl leading-7 text-muted-foreground">
          This page is practical internal guidance for using CommsIQ responsibly. It does not
          replace the organisation's contracts, privacy notices, employment policies or legal
          advice. Where those documents impose a stricter rule, follow the stricter rule.
        </p>
        <nav aria-label="Governance sections" className="mt-4 hidden flex-wrap gap-2 xl:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="type-meta rounded-full border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {section.title}
            </a>
          ))}
        </nav>
        <details className="mt-4 rounded-xl border border-border bg-muted/20 p-3 xl:hidden">
          <summary className="cursor-pointer list-none type-meta font-semibold text-foreground">
            Browse governance topics
          </summary>
          <nav aria-label="Governance sections" className="mt-3 grid gap-1">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-lg px-2.5 py-2 type-meta text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </details>
      </Card>

      <div className="mt-6 grid gap-5">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <Card className="p-6">
                <div className="flex items-center gap-2">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <SectionTitle>{section.title}</SectionTitle>
                </div>
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="type-body max-w-5xl leading-7 text-muted-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
                {"bullets" in section && section.bullets?.length ? (
                  <ul className="mt-4 list-disc space-y-2 pl-5 type-body leading-7 text-muted-foreground">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            </section>
          );
        })}
      </div>

      <Card className="mt-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SectionTitle>Need a governance decision?</SectionTitle>
            <p className="type-body mt-1 max-w-3xl text-muted-foreground">
              For a platform-specific question, contact support. For a legal, privacy or contractual
              decision, use the organisation's authorised legal or information-governance process.
            </p>
          </div>
          <ContactSupportButton variant="outline" size="default" />
        </div>
      </Card>
    </WorkspaceShell>
  );
}
