import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  FileClock,
  HelpCircle,
  Keyboard,
  ScrollText,
  Search,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, PageTitle, SectionTitle } from "@/components/ui-kit";
import { ContactSupportButton } from "@/components/contact-support";
import { Input } from "@/components/ui/input";
import { CommandGrid, RailAction, RailCard } from "@/components/command-layout";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Help Centre - CommsIQ" },
      {
        name: "description",
        content:
          "Detailed user guidance for Overview, Mentions, Response Studio, Personas, Campaigns, Performance and Reports in CommsIQ.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Help Centre - CommsIQ" },
      {
        property: "og:description",
        content:
          "Learn how to monitor, understand, test, run and measure communications in CommsIQ.",
      },
    ],
  }),
  component: HelpPage,
});

type HelpBlock = {
  title: string;
  body: string[];
  bullets?: string[];
};

type HelpSection = {
  id: string;
  title: string;
  intro: string;
  blocks: HelpBlock[];
};

const SECTIONS: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    intro:
      "CommsIQ is organised around one working loop: monitor the public conversation, understand what matters, decide what to do, test the message, run the campaign, then measure the result.",
    blocks: [
      {
        title: "The normal workflow",
        body: [
          "Start on Overview for the executive picture. Open Mentions when you need the underlying posts or articles. Use Response Studio before publishing a message when you want the persona panel to test how it may land. Move into Create campaign when you are ready to act, then use Campaign Manager and Performance to follow execution and results.",
        ],
        bullets: [
          "Monitor: Overview and Mentions show the conversation already collected by connected sources.",
          "Understand: sentiment, narratives, importance, source authority and trend signals help separate noise from material conversation.",
          "Decide: recommendations and intelligence cards show where attention may be needed.",
          "Test: Response Studio scores a proposed message against the persona panel and returns recommended versions.",
          "Run: campaign pages use the platform's existing connected-account execution tools.",
          "Measure: Campaign Manager, Performance and Reports record what happened after execution.",
        ],
      },
      {
        title: "Navigation",
        body: [
          "The main navigation contains Overview, Mentions, Response Studio, Personas, Campaign Manager, Reports and Archive. Some operational pages, including Performance, Always-on and Connected Accounts, are shown only to users who have the required access.",
          "The Create campaign button is available from the main navigation and the page header so you do not need to return to a specific screen before starting a campaign.",
        ],
      },
    ],
  },
  {
    id: "overview",
    title: "Overview",
    intro:
      "Overview is the executive screen. It combines current brand health, changes in the conversation, recommendations, official account activity and the strongest signals from monitored sources.",
    blocks: [
      {
        title: "Time window",
        body: [
          "Use 24 hours, 7 days or 30 days at the top of the page. The health and conversation cards update for the selected window. Historical intelligence may also compare recent activity with previous periods or the platform's stored normal baseline.",
        ],
      },
      {
        title: "Brand health and intelligence",
        body: [
          "The top cards summarise the monitored conversation and response performance. Intelligence sections explain what changed, which narratives are gaining weight, where negative conversation needs attention and which positive conversations may be worth reinforcing.",
          "Narrative cards can be opened into Mentions so you can inspect the underlying posts instead of relying only on the summary.",
        ],
        bullets: [
          "What Changed compares recent conversation with an earlier period.",
          "Compared With Normal uses stored history to show whether activity is unusually high or low.",
          "Velocity describes whether a narrative is breaking, fast rising, rising, stable or declining.",
          "Lifecycle describes whether a narrative is emerging, growing, peaking, stable or declining.",
          "Likely origin identifies the earliest matching item visible in the monitored data. It is not presented as proof of the first publication on the internet.",
          "Amplified by highlights sources or accounts that contributed meaningful observed reach, engagement or repeated mentions.",
        ],
      },
      {
        title: "Generate PDF Report",
        body: [
          "Use Generate PDF Report to create an executive snapshot from the current Overview data. The report includes FKF branding, Powered by Persona_Voices, the selected reporting period, key metrics and the charts available to the report generator.",
          "The PDF is generated from data already loaded by the platform. No separate reporting service is required.",
        ],
      },
      {
        title: "Recommended next move",
        body: [
          "Where the platform has enough information, Overview presents a recommended next move and a suggested message. You can send that message to Response Studio for persona testing or take it directly into the existing campaign workflow.",
        ],
      },
      {
        title: "Latest official post",
        body: [
          "The latest official X posts show the post text and the engagement metrics currently available to the platform, including likes, reposts, replies, bookmarks and views. Operational campaign actions shown beside a post use the platform's existing connected accounts and queue.",
        ],
      },
    ],
  },
  {
    id: "mentions",
    title: "Mentions",
    intro:
      "Mentions is the evidence layer. It brings together public posts and press coverage collected from the platform's connected monitoring sources.",
    blocks: [
      {
        title: "Reading a mention",
        body: [
          "A mention card identifies the author or publication, platform or source, publication time, available engagement figures and the current sentiment label. Metrics vary by source because not every platform exposes the same information.",
        ],
        bullets: [
          "X posts can show views, likes and contextual reply information when available.",
          "YouTube posts can show views and subscriber context when the stored official channel profile contains it.",
          "Other social sources can show the views, likes, comments, shares or follower context actually collected for that platform.",
          "News items use the publication name. Article images are displayed when image data has been collected from the news or publisher record.",
        ],
      },
      {
        title: "Filters and investigation views",
        body: [
          "Use source and sentiment filters to narrow the normal feed. When you enter Mentions from a narrative or intelligence card, the page can open a focused investigation for that topic across X, news and connected social sources.",
          "Focused investigations can be narrowed to High impact or Relevant+ content, sorted by Importance or Newest, and can hide near-identical duplicates. Hiding duplicates only collapses repeated material in the view; it does not delete the stored records.",
        ],
      },
      {
        title: "Importance and source authority",
        body: [
          "Importance helps prioritise mentions using observable signals already in the feed. Labels are Critical, High impact, Relevant and Low signal. Source Authority is shown as High, Medium or Standard.",
          "These labels are prioritisation aids. They help decide where to look first, rather than claiming that one source is objectively more important in every situation.",
        ],
      },
      {
        title: "Why a mention may be missing",
        body: [
          "The feed only contains material returned by connected sources and accepted by the current relevance and language filters. A post may also fall outside a source's collection window or be unavailable when the source is refreshed.",
          "The platform excludes monitored items containing Chinese-script content from the supported mention feeds. This is a feed-cleaning rule, not a translation feature.",
        ],
      },
    ],
  },
  {
    id: "sentiment",
    title: "Understanding sentiment",
    intro:
      "Sentiment describes how a post or article reads in relation to FKF, its teams or leadership. It is not simply a count of positive and negative words.",
    blocks: [
      {
        title: "Positive, neutral and negative",
        body: [
          "Positive means the content clearly supports, praises or presents a favourable outcome. Negative means it criticises, mocks, accuses, attacks or presents a damaging outcome. Neutral is used when the content is mainly factual or does not carry a clear favourable or damaging position.",
        ],
      },
      {
        title: "Sarcasm and context",
        body: [
          "Where the sentiment engine has enough context, it considers sarcasm, irony, rhetorical criticism, common Kenyan English patterns and supported Kiswahili or Sheng expressions. Praise words used sarcastically should therefore not automatically become a positive label.",
          "On supported X mention cards, the information control can show a short user-facing reason for the label and the phrases that influenced the classification. This is an explanation of the result, not a disclosure of internal model reasoning or proprietary scoring logic.",
        ],
      },
    ],
  },
  {
    id: "narratives",
    title: "Narratives and trends",
    intro:
      "Narratives group related monitored conversation into practical themes so a user can understand what is driving volume instead of reading every post first.",
    blocks: [
      {
        title: "What the labels mean",
        body: [
          "Narratives can include leadership and governance, national teams, grassroots development, league and club conversation, football facilities and investment, and integrity or dispute-related discussion when the monitored content supports those themes.",
        ],
        bullets: [
          "Growth compares the current narrative volume with a recent comparable period.",
          "Compared With Normal compares current volume with the stored historical baseline when enough history exists.",
          "Velocity describes the current rate of movement.",
          "Lifecycle describes the stage the conversation appears to be in.",
          "Risks and Opportunities are deliberately selective so ordinary fluctuations do not become alerts.",
        ],
      },
      {
        title: "Investigate before acting",
        body: [
          "Use Investigate mentions to open the material behind a narrative. Review the actual posts, sources and sentiment before deciding whether to respond, test a message or start a campaign.",
        ],
      },
    ],
  },
  {
    id: "response-studio",
    title: "Response Studio",
    intro:
      "Response Studio tests proposed messaging against the platform's persona panel before the message moves into execution.",
    blocks: [
      {
        title: "Run a test",
        body: [
          "Open Response Studio, enter the message you want to test and submit it. You can also arrive with prefilled copy from an Overview recommendation. The result page shows an executive summary, confidence, persona reaction information, risks and recommended wording.",
        ],
      },
      {
        title: "Recommended version",
        body: [
          "The strongest recommended version is surfaced as the message that is ready to use. You can edit it directly before taking it into Run campaign. Other recommended versions and the deeper persona analysis remain available for comparison.",
        ],
      },
      {
        title: "Confidence",
        body: [
          "Confidence is a communication-testing signal from the persona panel. Treat it as decision support, not as a guarantee of real-world reach, voting behaviour, media response or public opinion.",
        ],
      },
      {
        title: "Reports and archive",
        body: [
          "A completed test can be exported from its result page and remains available through Archive according to the current workspace permissions. Past results can be reopened for reference or a revised message can be tested again.",
        ],
      },
    ],
  },
  {
    id: "personas",
    title: "Personas",
    intro:
      "Personas are the audience perspectives used by Response Studio to evaluate how a message may be received by different types of people.",
    blocks: [
      {
        title: "Using the persona panel",
        body: [
          "The Personas page lets you browse the audience panel and the information the interface exposes for each persona. Persona reactions on a message test show why different audience segments may receive the same wording differently.",
          "Persona results are simulated research and testing signals. They should be combined with real monitoring data from Mentions and actual campaign results from Performance.",
        ],
      },
    ],
  },
  {
    id: "campaigns",
    title: "Campaigns",
    intro:
      "Create campaign is the execution entry point. The exact form depends on the action you choose and reuses the connected-account and scheduling systems already configured in the platform.",
    blocks: [
      {
        title: "Starting from intelligence",
        body: [
          "A campaign can be started directly from an Overview recommendation, a tested recommended message, a mention or a news story. Where possible, the platform carries the relevant text or link into the campaign form so it does not need to be entered again.",
        ],
      },
      {
        title: "Campaign actions",
        body: [
          "Available campaign pages include the actions currently enabled by the platform, such as posts, replies, engagement, likes, follows, intercept workflows and automated campaign modes. The available controls depend on the selected action and the connected accounts that are ready for use.",
        ],
      },
    ],
  },
  {
    id: "campaign-manager",
    title: "Campaign Manager",
    intro: "Campaign Manager is the live operational list for campaign execution.",
    blocks: [
      {
        title: "Status and progress",
        body: [
          "Use the Running, Scheduled, Paused and Completed filters to see the current state. Each campaign can show overall completion percentage and an action breakdown when execution records are available.",
          "Campaigns use descriptive names rather than a generic Campaign label where the naming service has enough campaign context. You can also rename a campaign manually.",
        ],
      },
      {
        title: "Pause, resume and performance",
        body: [
          "Running campaigns can be paused and paused campaigns can be resumed from the list. Completed campaigns open into the Performance view. Campaigns that are still active can also be opened to inspect the performance information available so far.",
        ],
      },
    ],
  },
  {
    id: "performance",
    title: "Performance",
    intro:
      "Performance is the measurement view for users who have access to it. It combines campaign execution data and the metrics collected after actions or posts are published.",
    blocks: [
      {
        title: "Reading performance",
        body: [
          "Use campaign filters to focus on a specific run. The page displays the campaign, action and audience metrics that are actually available in stored execution and platform records. A metric that was not returned by a source should not be interpreted as zero unless the interface explicitly presents it that way.",
        ],
      },
      {
        title: "From campaign to result",
        body: [
          "Campaign Manager links directly to Performance so the user can move from execution status to post-campaign measurement without searching for the campaign again.",
        ],
      },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    intro:
      "Reports keeps a dated record of monitoring and campaign activity and separates system-generated records from prepared Persona_Voices reports.",
    blocks: [
      {
        title: "Automated Reports",
        body: [
          "Automated Reports records daily or requested reporting periods from data already stored in the platform. You can generate Today, Yesterday, Last 7 days, Last 30 days or a custom date range. Report pages can provide downloadable CSV records for the supported sections.",
        ],
      },
      {
        title: "Report filters",
        body: [
          "Use the report filters to focus on the report types and records you need. The Reports landing page summarises report count, engagement actions, campaigns and mentions from the reports currently loaded.",
        ],
      },
    ],
  },
  {
    id: "managed-reports",
    title: "Managed Reports",
    intro:
      "Managed Reports contains reports prepared and shared by the Persona_Voices team rather than automatically generated system records.",
    blocks: [
      {
        title: "View and download",
        body: [
          "Open the Managed Reports tab and filter by the available report categories. Published reports can be viewed in a new tab or downloaded. The report entry can show its reporting period, description, category, upload date and file size.",
          "Users with administrative access can manage the publication state of prepared reports. Ordinary users see the reports that have been published to their workspace.",
        ],
      },
    ],
  },
  {
    id: "accounts",
    title: "Connected Accounts",
    intro:
      "Connected Accounts is an operational page for authorised administrators. It is separate from the public brand-account cards shown in Overview and Mentions.",
    blocks: [
      {
        title: "Ready-to-use accounts",
        body: [
          "Campaign execution should use accounts that are active and currently ready for the platform to use. Accounts that are unavailable, suspended or require a new sign-in can remain visible to administrators for management while being excluded from execution where the campaign engine marks them unavailable.",
        ],
      },
      {
        title: "If an account needs attention",
        body: [
          "Use the status and account-management controls available on Connected Accounts. If an account cannot be restored from the interface, contact platform support instead of repeatedly running campaigns against the unavailable account.",
        ],
      },
    ],
  },
  {
    id: "metrics",
    title: "Understanding metrics",
    intro:
      "Metrics describe different parts of the communication lifecycle. Similar-looking numbers from different platforms are not always calculated in the same way.",
    blocks: [
      {
        title: "Core metrics",
        body: [],
        bullets: [
          "Mentions: monitored public items that matched the listening brief and were accepted into the feed.",
          "Views or impressions: exposure figures returned or stored for a specific platform or post. Availability depends on the source.",
          "Reach: an audience-exposure measure used where the platform has enough data to calculate or present it. Check the page context because not every source exposes native reach.",
          "Engagements: recorded interaction actions such as likes, replies, reposts, quotes or bookmarks where those metrics are available.",
          "Engagement rate: engagements relative to the relevant exposure denominator on the page that presents it.",
          "Sentiment: the current positive, neutral or negative reading of monitored content.",
          "Confidence: a Response Studio testing signal, not a public polling percentage.",
          "Importance: a prioritisation label for a mention or narrative.",
          "Source Authority: a prioritisation label based on observable source signals available to the platform.",
        ],
      },
    ],
  },
];

const FAQS = [
  [
    "Where should I start each morning?",
    "Start on Overview. Read the health cards, Intelligence Brief, What Changed, risks and opportunities. Open Mentions only for the items that need investigation.",
  ],
  [
    "Why are the numbers on two pages different?",
    "Pages can use different time windows, data sources or metric definitions. Check the selected period and the metric label before comparing values.",
  ],
  [
    "Why is a mention labelled negative when it contains positive words?",
    "The sentiment system can use context, sarcasm and rhetorical criticism. Open the sentiment explanation where it is available to see the short user-facing reason.",
  ],
  [
    "Can I see the posts behind an Overview narrative?",
    "Yes. Use Investigate mentions. The focused Mentions view applies the narrative topic across the monitored sources available to that investigation.",
  ],
  [
    "What does Critical mean?",
    "Critical is the strongest mention-importance label. It tells you to review the item first. It does not automatically mean the platform recommends a public response.",
  ],
  [
    "What does High Source Authority mean?",
    "It means the source has stronger observable authority signals available to the platform, such as publication status or verified/high-attention account signals. It is a prioritisation aid.",
  ],
  [
    "Why does Likely origin say likely?",
    "The platform can identify the earliest matching item in the data it has monitored. It cannot prove that no earlier item existed outside those sources or collection windows.",
  ],
  [
    "Can I test an Overview recommendation?",
    "Yes. Use Test with personas to send the suggested message into Response Studio as prefilled copy.",
  ],
  [
    "Can I edit the recommended message?",
    "Yes. The recommended version on a test result can be edited before it is passed into Run campaign.",
  ],
  [
    "Can I pause a campaign?",
    "Running campaigns that support operational control can be paused in Campaign Manager and resumed later.",
  ],
  [
    "Where do completed campaigns go?",
    "Campaign Manager keeps completed campaigns in the Completed filter and links them to Performance.",
  ],
  [
    "What is the difference between Automated and Managed Reports?",
    "Automated Reports are generated from platform records. Managed Reports are prepared deliverables published by the Persona_Voices team.",
  ],
  [
    "Can I generate a report for my own dates?",
    "Yes. In Automated Reports choose Generate report, select Custom date range, then enter the From and To dates.",
  ],
  [
    "Can I export Overview?",
    "Yes. Use Generate PDF Report on Overview for the executive PDF generated from current platform data.",
  ],
  [
    "Why is a platform metric missing?",
    "The source may not expose that metric, the item may not have been refreshed yet, or the collector may not have received it. Missing data should not be invented.",
  ],
  [
    "Why do I see fewer duplicate posts in an investigation?",
    "Hide duplicates collapses near-identical items in that view. The underlying stored records are not deleted.",
  ],
  [
    "Why can another user see a page that I cannot?",
    "Some operational pages and controls are permission-based. Your navigation only exposes the surfaces available to your account.",
  ],
  [
    "Does Response Studio predict exact real-world results?",
    "No. It is communication decision support based on the persona panel. Use real monitoring and campaign performance alongside it.",
  ],
  [
    "How often does Overview update?",
    "Several Overview datasets refresh on a short interval, while some source feeds have their own collection cadence. The page can therefore contain data with different latest-refresh times.",
  ],
  [
    "How do I get human support?",
    "Use Chat with Thabo on WhatsApp on this page. The message opens with the platform-support context already filled in.",
  ],
] as const;

const TROUBLESHOOTING: HelpBlock[] = [
  {
    title: "Overview is empty",
    body: [
      "Widen the time window first. If the page is still empty, open Mentions and check whether the connected sources have collected anything recently. An empty window is different from a platform error.",
    ],
  },
  {
    title: "A chart or metric is missing",
    body: [
      "Check whether the page has enough data for the selected period. Some charts intentionally wait for more than one data point and some platform metrics only appear when the source returned them.",
    ],
  },
  {
    title: "A campaign is not progressing",
    body: [
      "Open Campaign Manager and check whether the campaign is Scheduled, Paused, Running or Completed. Also check whether the campaign reports execution data and whether the connected accounts required for the action are ready for use.",
    ],
  },
  {
    title: "An expected mention is missing",
    body: [
      "Confirm the source is part of the connected monitoring set, refresh Mentions, then check the source and topic filters. The item may be outside the source collection window, may not match the listening brief, or may have been removed or unavailable when collection ran.",
    ],
  },
  {
    title: "Sentiment looks wrong",
    body: [
      "Read the full post or article and open the sentiment explanation where available. Sarcasm and reply context can change the intended reading. If the label still appears materially wrong, capture the item link and contact support so it can be reviewed.",
    ],
  },
  {
    title: "A report will not open",
    body: [
      "Try the Download action as well as View report. If a managed report still cannot be opened, note the report title and contact support. Prepared report links are permission-aware and may expire or need to be regenerated.",
    ],
  },
  {
    title: "A connected account is not being used",
    body: [
      "The campaign engine can exclude accounts that are unavailable or not ready for execution. Administrators should review the account status on Connected Accounts rather than forcing repeated actions through an unhealthy account.",
    ],
  },
];

function HelpBlockView({ block }: { block: HelpBlock }) {
  return (
    <div>
      <h3 className="type-card font-semibold">{block.title}</h3>
      <div className="mt-2 space-y-2">
        {block.body.map((paragraph) => (
          <p key={paragraph} className="type-body leading-7 text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </div>
      {block.bullets?.length ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 type-body leading-7 text-muted-foreground">
          {block.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function sectionText(section: HelpSection) {
  return [
    section.title,
    section.intro,
    ...section.blocks.flatMap((block) => [block.title, ...block.body, ...(block.bullets ?? [])]),
  ]
    .join(" ")
    .toLowerCase();
}

function HelpPage() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filteredSections = useMemo(
    () => (q ? SECTIONS.filter((section) => sectionText(section).includes(q)) : SECTIONS),
    [q],
  );
  const filteredFaqs = useMemo(
    () =>
      q
        ? FAQS.filter(([question, answer]) => `${question} ${answer}`.toLowerCase().includes(q))
        : FAQS,
    [q],
  );
  const filteredTroubleshooting = useMemo(
    () =>
      q
        ? TROUBLESHOOTING.filter((block) =>
            [block.title, ...block.body].join(" ").toLowerCase().includes(q),
          )
        : TROUBLESHOOTING,
    [q],
  );

  const noResults =
    filteredSections.length === 0 &&
    filteredFaqs.length === 0 &&
    filteredTroubleshooting.length === 0;

  return (
    <WorkspaceShell title="Help" wide>
      <PageTitle description="Detailed guidance for monitoring, testing, campaigns, measurement and reporting.">
        Help Centre
      </PageTitle>

      <CommandGrid
        className="mt-6"
        left={
          <div className="hidden xl:block">
            <RailCard title="Search" icon={Search}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search help…"
                  aria-label="Search Help Centre"
                  className="pl-9"
                />
              </div>
              <p className="type-meta mt-2 text-muted-foreground">
                Runs locally inside this Help Centre.
              </p>
            </RailCard>

            {!q ? (
              <RailCard title="Sections" icon={BookOpen}>
                <nav aria-label="Help Centre sections" className="grid gap-1">
                  {SECTIONS.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="type-meta truncate rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {section.title}
                    </a>
                  ))}
                  <a
                    href="#faq"
                    className="type-meta truncate rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    FAQ
                  </a>
                  <a
                    href="#troubleshooting"
                    className="type-meta truncate rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Troubleshooting
                  </a>
                </nav>
              </RailCard>
            ) : null}
          </div>
        }
        right={
          <>
            <RailCard title="Support" icon={HelpCircle}>
              <p className="type-meta text-muted-foreground">
                If the Help Centre does not resolve the issue, contact Thabo directly for platform
                support.
              </p>
              <p className="type-meta mt-2 font-semibold">Thabo · Platform Support</p>
              <ContactSupportButton variant="default" size="default" className="mt-3 w-full" />
            </RailCard>

            <RailCard title="Shortcuts" icon={Keyboard}>
              <div className="grid gap-2">
                <RailAction
                  to="/changelog"
                  icon={FileClock}
                  title="Changelog"
                  description="Recent platform updates"
                />
                <RailAction
                  to="/governance"
                  icon={ShieldCheck}
                  title="Governance"
                  description="Policies and controls"
                />
                <RailAction
                  onClick={() =>
                    document.getElementById("metrics")?.scrollIntoView({ behavior: "smooth" })
                  }
                  icon={ScrollText}
                  title="Glossary"
                  description="Metric and label definitions"
                />
              </div>
            </RailCard>
          </>
        }
      >
        <details className="rounded-xl border border-border bg-card p-3 xl:hidden">
          <summary className="cursor-pointer list-none type-meta font-semibold text-foreground">
            Search or browse Help Centre
          </summary>
          <div className="mt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search help…"
                aria-label="Search Help Centre"
                className="pl-9"
              />
            </div>
            {!q ? (
              <nav aria-label="Help Centre sections" className="mt-3 grid gap-1">
                {SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="rounded-lg px-2.5 py-2 type-meta text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {section.title}
                  </a>
                ))}
                <a
                  href="#faq"
                  className="rounded-lg px-2.5 py-2 type-meta text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  FAQ
                </a>
                <a
                  href="#troubleshooting"
                  className="rounded-lg px-2.5 py-2 type-meta text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Troubleshooting
                </a>
              </nav>
            ) : null}
          </div>
        </details>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Workflow className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <SectionTitle>The platform workflow</SectionTitle>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {["Monitor", "Understand", "Decide", "Test", "Run", "Measure"].map((step, index) => (
              <div key={step} className="min-w-0 rounded-xl border border-border bg-background p-3">
                <p className="type-meta text-muted-foreground">{index + 1}</p>
                <p className="type-card mt-1 truncate font-semibold">{step}</p>
              </div>
            ))}
          </div>
        </Card>

        {noResults ? (
          <Card className="p-6 text-center">
            <HelpCircle className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
            <p className="type-card mt-3 font-semibold">No matching help article</p>
            <p className="type-meta mt-1 text-muted-foreground">
              Try a page name such as Mentions, Overview, Reports or Campaign Manager.
            </p>
          </Card>
        ) : null}

        {filteredSections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20 min-w-0">
            <Card className="p-6">
              <SectionTitle>{section.title}</SectionTitle>
              <p className="type-body mt-2 max-w-4xl leading-7 text-muted-foreground">
                {section.intro}
              </p>
              <div className="mt-6 grid gap-6">
                {section.blocks.map((block) => (
                  <HelpBlockView key={block.title} block={block} />
                ))}
              </div>
            </Card>
          </section>
        ))}

        {filteredFaqs.length ? (
          <section id="faq" className="scroll-mt-20 min-w-0">
            <Card className="p-6">
              <SectionTitle>Frequently asked questions</SectionTitle>
              <div className="mt-4 divide-y divide-border">
                {filteredFaqs.map(([question, answer]) => (
                  <details key={question} className="group py-3">
                    <summary className="cursor-pointer list-none type-body font-semibold [&::-webkit-details-marker]:hidden">
                      {question}
                    </summary>
                    <p className="type-body mt-2 max-w-4xl leading-7 text-muted-foreground">
                      {answer}
                    </p>
                  </details>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {filteredTroubleshooting.length ? (
          <section id="troubleshooting" className="scroll-mt-20 min-w-0">
            <Card className="p-6">
              <SectionTitle>Troubleshooting</SectionTitle>
              <p className="type-body mt-2 text-muted-foreground">
                Start with the visible status and data on the page. These checks do not require
                backend logs or technical access.
              </p>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {filteredTroubleshooting.map((block) => (
                  <HelpBlockView key={block.title} block={block} />
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <SectionTitle>Still need help?</SectionTitle>
              <p className="type-body mt-1 text-muted-foreground">
                If the Help Centre does not resolve the issue, contact Thabo directly for platform
                support.
              </p>
              <p className="type-meta mt-2 font-semibold">Thabo · Platform Support</p>
            </div>
            <ContactSupportButton variant="default" size="lg" className="shrink-0" />
          </div>
        </Card>
      </CommandGrid>
    </WorkspaceShell>
  );
}
