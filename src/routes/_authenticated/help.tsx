import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronDown,
  FileClock,
  LifeBuoy,
  MessagesSquare,
  RadioTower,
  Search,
  SearchX,
  Send,
  ShieldCheck,
} from "lucide-react";

import { WorkspaceShell } from "@/components/workspace-shell";
import { ContactSupportButton } from "@/components/contact-support";
import { isAdminEmail } from "@/lib/access";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/help")({
  validateSearch: (search: Record<string, unknown>): { article?: string | undefined } => ({
    article:
      typeof search["article"] === "string" && search["article"].trim()
        ? (search["article"] as string)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Help Centre - CommsIQ" },
      {
        name: "description",
        content:
          "Search for an answer or browse Overview, Mentions, Response Studio, Campaigns and Reports guidance in CommsIQ.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Help Centre - CommsIQ" },
      {
        property: "og:description",
        content:
          "Find a direct answer for monitoring, testing, campaigns and reporting in CommsIQ.",
      },
    ],
  }),
  component: HelpPage,
});

// ---------------------------------------------------------------------------
// Canonical article registry — the single dataset behind search, category
// browsing and the accordion. Every paragraph and bullet migrated here was
// present in the previous Help Centre sections, FAQ sheet or troubleshooting
// list; none of the operational detail, warnings or permission limits were
// summarised away.
// ---------------------------------------------------------------------------

type HelpCategory = "signals" | "testing" | "campaigns" | "reporting";

type HelpBlock = {
  title?: string;
  body: string[];
  bullets?: string[];
};

type HelpArticle = {
  id: string;
  /** null keeps the article pinned outside category filtering (Getting started). */
  category: HelpCategory | null;
  title: string;
  summary: string;
  blocks: HelpBlock[];
  keywords: string[];
  /** Article is hidden entirely for users without this access, matching the destination page. */
  requiredAccess?: "admin";
};

const CATEGORIES: {
  id: HelpCategory;
  title: string;
  description: string;
  icon: typeof RadioTower;
}[] = [
  {
    id: "signals",
    title: "Understand signals",
    description: "Mentions, sentiment and narratives",
    icon: RadioTower,
  },
  {
    id: "testing",
    title: "Plan and test",
    description: "Recommendations and Response Studio",
    icon: MessagesSquare,
  },
  {
    id: "campaigns",
    title: "Run campaigns",
    description: "Connected accounts, execution and approvals",
    icon: Send,
  },
  {
    id: "reporting",
    title: "Measure and report",
    description: "Metrics, exports and managed reports",
    icon: ChartNoAxesCombined,
  },
];

const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "getting-started",
    category: null,
    title: "Getting started",
    summary: "CommsIQ is organised around one working loop, from monitoring through measurement.",
    keywords: ["getting started", "workflow", "navigation", "loop", "start"],
    blocks: [
      {
        body: [
          "CommsIQ is organised around one working loop: monitor the public conversation, understand what matters, decide what to do, test the message, run the campaign, then measure the result.",
        ],
      },
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
    category: "signals",
    title: "Overview",
    summary:
      "The executive screen: brand health, conversation change, recommendations and top signals.",
    keywords: [
      "overview",
      "brand health",
      "intelligence",
      "pdf report",
      "recommendation",
      "narrative",
    ],
    blocks: [
      {
        body: [
          "Overview is the executive screen. It combines current brand health, changes in the conversation, recommendations, official account activity and the strongest signals from monitored sources.",
        ],
      },
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
    category: "signals",
    title: "Mentions",
    summary:
      "The evidence layer: public posts and press coverage from connected monitoring sources.",
    keywords: [
      "mentions",
      "feed",
      "filters",
      "importance",
      "source authority",
      "duplicates",
      "investigation",
    ],
    blocks: [
      {
        body: [
          "Mentions is the evidence layer. It brings together public posts and press coverage collected from the platform's connected monitoring sources.",
        ],
      },
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
    category: "signals",
    title: "Understanding sentiment",
    summary:
      "How positive, neutral and negative readings are decided, including sarcasm and context.",
    keywords: [
      "sentiment",
      "positive",
      "negative",
      "neutral",
      "sarcasm",
      "context",
      "kiswahili",
      "sheng",
    ],
    blocks: [
      {
        body: [
          "Sentiment describes how a post or article reads in relation to FKF, its teams or leadership. It is not simply a count of positive and negative words.",
        ],
      },
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
    category: "signals",
    title: "Narratives and trends",
    summary:
      "How related conversation is grouped into themes, and how to investigate before acting.",
    keywords: ["narratives", "trends", "growth", "velocity", "lifecycle", "risks", "opportunities"],
    blocks: [
      {
        body: [
          "Narratives group related monitored conversation into practical themes so a user can understand what is driving volume instead of reading every post first.",
        ],
      },
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
    category: "testing",
    title: "Response Studio",
    summary: "Test proposed messaging against the persona panel before it moves into execution.",
    keywords: ["response studio", "test", "confidence", "persona panel", "recommended version"],
    blocks: [
      {
        body: [
          "Response Studio tests proposed messaging against the platform's persona panel before the message moves into execution.",
        ],
      },
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
    category: "testing",
    title: "Personas",
    summary: "The audience perspectives Response Studio uses to evaluate how a message may land.",
    keywords: ["personas", "audience panel", "voices", "persona reactions"],
    blocks: [
      {
        body: [
          "Personas are the audience perspectives used by Response Studio to evaluate how a message may be received by different types of people.",
        ],
      },
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
    category: "campaigns",
    title: "Run a campaign",
    summary:
      "The execution entry point, using the platform's connected-account and scheduling tools.",
    keywords: ["campaign", "create campaign", "run", "execution", "connected accounts"],
    blocks: [
      {
        body: [
          "Create campaign is the execution entry point. The exact form depends on the action you choose and reuses the connected-account and scheduling systems already configured in the platform.",
        ],
      },
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
    category: "campaigns",
    title: "Campaign Manager",
    summary:
      "The live operational list for campaign execution: status, progress, pause and resume.",
    keywords: [
      "campaign manager",
      "status",
      "pause",
      "resume",
      "running",
      "scheduled",
      "completed",
    ],
    blocks: [
      {
        body: ["Campaign Manager is the live operational list for campaign execution."],
      },
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
    category: "campaigns",
    requiredAccess: "admin",
    title: "Performance",
    summary:
      "Measurement view combining campaign execution data and post-publish metrics. Admin access.",
    keywords: ["performance", "measurement", "metrics", "admin"],
    blocks: [
      {
        body: [
          "Performance is the measurement view for users who have access to it. It combines campaign execution data and the metrics collected after actions or posts are published.",
        ],
      },
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
    id: "accounts",
    category: "campaigns",
    requiredAccess: "admin",
    title: "Connected Accounts",
    summary: "Operational account management for authorised administrators. Admin access.",
    keywords: ["connected accounts", "linked accounts", "admin", "account status"],
    blocks: [
      {
        body: [
          "Connected Accounts is an operational page for authorised administrators. It is separate from the public brand-account cards shown in Overview and Mentions.",
        ],
      },
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
    id: "reports",
    category: "reporting",
    title: "Reports",
    summary:
      "A dated record of monitoring and campaign activity, generated from stored platform data.",
    keywords: ["reports", "automated reports", "csv", "export", "date range"],
    blocks: [
      {
        body: [
          "Reports keeps a dated record of monitoring and campaign activity and separates system-generated records from prepared Persona_Voices reports.",
        ],
      },
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
    category: "reporting",
    title: "Managed Reports",
    summary:
      "Reports prepared and shared by the Persona_Voices team rather than generated automatically.",
    keywords: ["managed reports", "prepared reports", "publish", "download"],
    blocks: [
      {
        body: [
          "Managed Reports contains reports prepared and shared by the Persona_Voices team rather than automatically generated system records.",
        ],
      },
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
    id: "metrics",
    category: "reporting",
    title: "Understanding metrics",
    summary:
      "What each metric measures, and why the same-looking number can differ between platforms.",
    keywords: [
      "metrics",
      "glossary",
      "views",
      "impressions",
      "reach",
      "engagement",
      "engagement rate",
      "confidence",
      "importance",
      "source authority",
    ],
    blocks: [
      {
        body: [
          "Metrics describe different parts of the communication lifecycle. Similar-looking numbers from different platforms are not always calculated in the same way.",
        ],
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
  // -- Migrated FAQ entries --------------------------------------------------
  {
    id: "faq-start-morning",
    category: "signals",
    title: "Where should I start each morning?",
    summary: "Start on Overview, then open Mentions only for items that need investigation.",
    keywords: ["morning", "start", "routine", "overview"],
    blocks: [
      {
        body: [
          "Start on Overview. Read the health cards, Intelligence Brief, What Changed, risks and opportunities. Open Mentions only for the items that need investigation.",
        ],
      },
    ],
  },
  {
    id: "faq-numbers-differ",
    category: "reporting",
    title: "Why are the numbers on two pages different?",
    summary: "Pages can use different time windows, sources or metric definitions.",
    keywords: ["numbers", "different", "mismatch", "time window"],
    blocks: [
      {
        body: [
          "Pages can use different time windows, data sources or metric definitions. Check the selected period and the metric label before comparing values.",
        ],
      },
    ],
  },
  {
    id: "faq-negative-positive-words",
    category: "signals",
    title: "Why is a mention labelled negative when it contains positive words?",
    summary: "Sentiment can use context, sarcasm and rhetorical criticism.",
    keywords: ["sentiment", "negative", "positive words", "sarcasm"],
    blocks: [
      {
        body: [
          "The sentiment system can use context, sarcasm and rhetorical criticism. Open the sentiment explanation where it is available to see the short user-facing reason.",
        ],
      },
    ],
  },
  {
    id: "faq-narrative-posts",
    category: "signals",
    title: "Can I see the posts behind an Overview narrative?",
    summary: "Yes — use Investigate mentions to open the underlying material.",
    keywords: ["narrative", "posts", "investigate", "sources"],
    blocks: [
      {
        body: [
          "Yes. Use Investigate mentions. The focused Mentions view applies the narrative topic across the monitored sources available to that investigation.",
        ],
      },
    ],
  },
  {
    id: "faq-critical-meaning",
    category: "signals",
    title: "What does Critical mean?",
    summary: "The strongest mention-importance label — review the item first.",
    keywords: ["critical", "importance", "label"],
    blocks: [
      {
        body: [
          "Critical is the strongest mention-importance label. It tells you to review the item first. It does not automatically mean the platform recommends a public response.",
        ],
      },
    ],
  },
  {
    id: "faq-source-authority",
    category: "signals",
    title: "What does High Source Authority mean?",
    summary:
      "Stronger observable authority signals available to the platform — a prioritisation aid.",
    keywords: ["source authority", "high", "verified"],
    blocks: [
      {
        body: [
          "It means the source has stronger observable authority signals available to the platform, such as publication status or verified/high-attention account signals. It is a prioritisation aid.",
        ],
      },
    ],
  },
  {
    id: "faq-likely-origin",
    category: "signals",
    title: "Why does Likely origin say likely?",
    summary:
      "The earliest matching item in the monitored data, not proof of the first publication anywhere.",
    keywords: ["likely origin", "first", "earliest"],
    blocks: [
      {
        body: [
          "The platform can identify the earliest matching item in the data it has monitored. It cannot prove that no earlier item existed outside those sources or collection windows.",
        ],
      },
    ],
  },
  {
    id: "faq-test-recommendation",
    category: "testing",
    title: "Can I test an Overview recommendation?",
    summary: "Yes — use Test with personas to send it into Response Studio as prefilled copy.",
    keywords: ["test", "recommendation", "response studio"],
    blocks: [
      {
        body: [
          "Yes. Use Test with personas to send the suggested message into Response Studio as prefilled copy.",
        ],
      },
    ],
  },
  {
    id: "faq-edit-recommended",
    category: "testing",
    title: "Can I edit the recommended message?",
    summary: "Yes, before it is passed into Run campaign.",
    keywords: ["edit", "recommended message", "response studio"],
    blocks: [
      {
        body: [
          "Yes. The recommended version on a test result can be edited before it is passed into Run campaign.",
        ],
      },
    ],
  },
  {
    id: "faq-pause-campaign",
    category: "campaigns",
    title: "Can I pause a campaign?",
    summary: "Running campaigns that support operational control can be paused and resumed.",
    keywords: ["pause", "campaign", "resume"],
    blocks: [
      {
        body: [
          "Running campaigns that support operational control can be paused in Campaign Manager and resumed later.",
        ],
      },
    ],
  },
  {
    id: "faq-completed-campaigns",
    category: "campaigns",
    title: "Where do completed campaigns go?",
    summary: "Campaign Manager keeps them in the Completed filter, linked to Performance.",
    keywords: ["completed", "campaigns", "performance"],
    blocks: [
      {
        body: [
          "Campaign Manager keeps completed campaigns in the Completed filter and links them to Performance.",
        ],
      },
    ],
  },
  {
    id: "faq-page-access",
    category: "campaigns",
    title: "Why can another user see a page that I cannot?",
    summary: "Some operational pages and controls are permission-based.",
    keywords: ["permissions", "access", "page", "role"],
    blocks: [
      {
        body: [
          "Some operational pages and controls are permission-based. Your navigation only exposes the surfaces available to your account.",
        ],
      },
    ],
  },
  {
    id: "faq-automated-managed",
    category: "reporting",
    title: "What is the difference between automated and managed reports?",
    summary: "Automated reports are system-generated; Managed reports are analyst-prepared.",
    keywords: ["automated reports", "managed reports", "difference"],
    blocks: [
      {
        body: [
          "Automated reports use available platform data and standard templates. Managed reports add analyst review, narrative interpretation and approved recommendations.",
        ],
      },
    ],
  },
  {
    id: "faq-custom-date-report",
    category: "reporting",
    title: "Can I generate a report for my own dates?",
    summary: "Yes — choose Custom date range in Automated Reports.",
    keywords: ["custom date", "report", "range"],
    blocks: [
      {
        body: [
          "Yes. In Automated Reports choose Generate report, select Custom date range, then enter the From and To dates.",
        ],
      },
    ],
  },
  {
    id: "faq-export-overview",
    category: "reporting",
    title: "Can I export Overview?",
    summary: "Yes — use Generate PDF Report for an executive PDF from current data.",
    keywords: ["export", "overview", "pdf"],
    blocks: [
      {
        body: [
          "Yes. Use Generate PDF Report on Overview for the executive PDF generated from current platform data.",
        ],
      },
    ],
  },
  {
    id: "faq-missing-metric",
    category: "reporting",
    title: "Why is a platform metric missing?",
    summary: "The source may not expose it, or it may not have been collected yet.",
    keywords: ["missing", "metric", "unavailable"],
    blocks: [
      {
        body: [
          "The source may not expose that metric, the item may not have been refreshed yet, or the collector may not have received it. Missing data should not be invented.",
        ],
      },
    ],
  },
  {
    id: "faq-duplicates",
    category: "signals",
    title: "Why do I see fewer duplicate posts in an investigation?",
    summary: "Hide duplicates collapses near-identical items in the view only.",
    keywords: ["duplicates", "hide", "investigation"],
    blocks: [
      {
        body: [
          "Hide duplicates collapses near-identical items in that view. The underlying stored records are not deleted.",
        ],
      },
    ],
  },
  {
    id: "faq-response-studio-prediction",
    category: "testing",
    title: "Does Response Studio predict the exact outcome?",
    summary: "No — it supports judgement rather than replacing it.",
    keywords: ["response studio", "predict", "outcome", "exact"],
    blocks: [
      {
        body: [
          "No. It is communication decision support based on the persona panel. Use real monitoring and campaign performance alongside it.",
        ],
      },
    ],
  },
  {
    id: "faq-overview-refresh",
    category: "signals",
    title: "How often does Overview update?",
    summary: "Several datasets refresh often; source feeds keep their own collection cadence.",
    keywords: ["overview", "update", "refresh", "cadence"],
    blocks: [
      {
        body: [
          "Several Overview datasets refresh on a short interval, while some source feeds have their own collection cadence. The page can therefore contain data with different latest-refresh times.",
        ],
      },
    ],
  },
  // -- Migrated troubleshooting entries --------------------------------------
  {
    id: "trouble-overview-empty",
    category: "signals",
    title: "Overview is empty",
    summary:
      "Widen the time window first, then check whether sources have collected anything recently.",
    keywords: ["overview", "empty", "no data"],
    blocks: [
      {
        body: [
          "Widen the time window first. If the page is still empty, open Mentions and check whether the connected sources have collected anything recently. An empty window is different from a platform error.",
        ],
      },
    ],
  },
  {
    id: "trouble-chart-missing",
    category: "reporting",
    title: "A chart or metric is missing",
    summary:
      "Some charts wait for more than one data point, or the source did not return that metric.",
    keywords: ["chart", "metric", "missing"],
    blocks: [
      {
        body: [
          "Check whether the page has enough data for the selected period. Some charts intentionally wait for more than one data point and some platform metrics only appear when the source returned them.",
        ],
      },
    ],
  },
  {
    id: "trouble-campaign-stalled",
    category: "campaigns",
    title: "A campaign is not progressing",
    summary: "Check its status in Campaign Manager and whether required accounts are ready.",
    keywords: ["campaign", "stuck", "not progressing", "stalled"],
    blocks: [
      {
        body: [
          "Open Campaign Manager and check whether the campaign is Scheduled, Paused, Running or Completed. Also check whether the campaign reports execution data and whether the connected accounts required for the action are ready for use.",
        ],
      },
    ],
  },
  {
    id: "trouble-mention-missing",
    category: "signals",
    title: "An expected mention is missing",
    summary: "Confirm the source is connected, refresh Mentions, then check the filters.",
    keywords: ["mention", "missing", "expected"],
    blocks: [
      {
        body: [
          "Confirm the source is part of the connected monitoring set, refresh Mentions, then check the source and topic filters. The item may be outside the source collection window, may not match the listening brief, or may have been removed or unavailable when collection ran.",
        ],
      },
    ],
  },
  {
    id: "trouble-sentiment-wrong",
    category: "signals",
    title: "Sentiment looks wrong",
    summary:
      "Read the full item and open the sentiment explanation; report it if it still looks wrong.",
    keywords: ["sentiment", "wrong", "incorrect"],
    blocks: [
      {
        body: [
          "Read the full post or article and open the sentiment explanation where available. Sarcasm and reply context can change the intended reading. If the label still appears materially wrong, capture the item link and contact support so it can be reviewed.",
        ],
      },
    ],
  },
  {
    id: "trouble-report-wont-open",
    category: "reporting",
    title: "A report will not open",
    summary: "Try Download as well as View report, then contact support with the report title.",
    keywords: ["report", "will not open", "broken link"],
    blocks: [
      {
        body: [
          "Try the Download action as well as View report. If a managed report still cannot be opened, note the report title and contact support. Prepared report links are permission-aware and may expire or need to be regenerated.",
        ],
      },
    ],
  },
  {
    id: "trouble-account-unused",
    category: "campaigns",
    requiredAccess: "admin",
    title: "A connected account is not being used",
    summary: "Review the account status on Connected Accounts. Admin access.",
    keywords: ["connected account", "unused", "unavailable", "admin"],
    blocks: [
      {
        body: [
          "The campaign engine can exclude accounts that are unavailable or not ready for execution. Administrators should review the account status on Connected Accounts rather than forcing repeated actions through an unhealthy account.",
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function normalise(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function articleBodyText(article: HelpArticle) {
  return normalise(
    article.blocks
      .flatMap((block) => [block.title ?? "", ...block.body, ...(block.bullets ?? [])])
      .join(" "),
  );
}

function scoreArticle(article: HelpArticle, terms: string[]) {
  if (!terms.length) return 1;
  const title = normalise(article.title);
  const keywords = normalise(article.keywords.join(" "));
  const body = `${normalise(article.summary)} ${articleBodyText(article)}`;

  return terms.reduce((score, term) => {
    if (score === 0) return 0;
    if (title.includes(term)) return score + 30;
    if (keywords.includes(term)) return score + 20;
    if (body.includes(term)) return score + 10;
    return 0;
  }, 1);
}

function ArticleBlockView({ block }: { block: HelpBlock }) {
  return (
    <div>
      {block.title ? <h4 className="type-body font-semibold">{block.title}</h4> : null}
      <div className={cn("space-y-2", block.title && "mt-1.5")}>
        {block.body.map((paragraph) => (
          <p key={paragraph} className="type-body leading-6 text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </div>
      {block.bullets?.length ? (
        <ul className="mt-2 list-disc space-y-1.5 pl-5 type-body leading-6 text-muted-foreground">
          {block.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function HelpSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse px-4 py-10 sm:px-8" aria-hidden="true">
      <div className="mx-auto h-4 w-24 rounded bg-muted" />
      <div className="mx-auto mt-3 h-9 w-80 max-w-full rounded bg-muted" />
      <div className="mx-auto mt-7 h-14 w-full max-w-2xl rounded-2xl bg-muted" />
      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-28 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="mt-12 h-64 rounded-[18px] bg-muted" />
    </div>
  );
}

function HelpPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const { data: profile, isLoading: profileLoading } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<HelpCategory | null>(null);
  const [openArticleId, setOpenArticleId] = useState<string | null>(search.article ?? null);

  // Command / Control + K focuses the Help Centre search only while this page is mounted.
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  // Keep the open article in sync with a deep link, including browser back/forward.
  useEffect(() => {
    setOpenArticleId(search.article ?? null);
  }, [search.article]);

  const visibleArticles = useMemo(
    () =>
      profileLoading
        ? []
        : HELP_ARTICLES.filter((article) => article.requiredAccess !== "admin" || isAdmin),
    [isAdmin, profileLoading],
  );

  const queryTerms = useMemo(() => normalise(query).split(" ").filter(Boolean), [query]);

  const filteredArticles = useMemo(() => {
    return visibleArticles
      .map((article) => ({ article, score: scoreArticle(article, queryTerms) }))
      .filter(({ article, score }) => {
        const matchesCategory = !activeCategory || article.category === activeCategory;
        return matchesCategory && score > 0;
      })
      .sort((a, b) => b.score - a.score)
      .map(({ article }) => article);
  }, [activeCategory, queryTerms, visibleArticles]);

  const clearFilters = () => {
    setQuery("");
    setActiveCategory(null);
  };

  const toggleCategory = (category: HelpCategory) => {
    setActiveCategory((current) => (current === category ? null : category));
  };

  const openArticle = (articleId: string) => {
    const next = openArticleId === articleId ? undefined : articleId;
    setOpenArticleId(next ?? null);
    void navigate({ to: "/help", search: next ? { article: next } : {}, replace: false });
  };

  const handleContactSupport = () => {
    document.getElementById("help-support-strip")?.scrollIntoView({ behavior: "smooth" });
  };

  if (profileLoading) {
    return (
      <WorkspaceShell title="Help">
        <HelpSkeleton />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell title="Help">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 lg:py-14">
        <header className="text-center">
          <p className="type-meta font-semibold uppercase tracking-[0.08em] text-primary">
            Help Centre
          </p>
          <h1 className="mt-2 type-title">What do you need help with?</h1>

          <label className="relative mx-auto mt-7 flex min-h-14 w-full max-w-[650px] items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Search Help Centre</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search campaigns, sentiment, reports…"
              className="min-h-[52px] min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded-md border border-border bg-muted px-2 py-1 type-meta text-muted-foreground sm:block">
              ⌘K
            </kbd>
          </label>

          <div className="mt-3 flex flex-wrap justify-center gap-x-5">
            <Link
              to="/changelog"
              className="min-h-10 type-meta font-medium text-muted-foreground hover:text-primary"
            >
              Release notes
            </Link>
            <Link
              to="/governance"
              className="min-h-10 type-meta font-medium text-muted-foreground hover:text-primary"
            >
              Governance
            </Link>
            <button
              type="button"
              onClick={() =>
                document.getElementById("metrics")?.scrollIntoView({ behavior: "smooth" })
              }
              className="min-h-10 type-meta font-medium text-muted-foreground hover:text-primary"
            >
              Glossary
            </button>
          </div>
        </header>

        <section className="mt-12" aria-labelledby="help-categories-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="help-categories-title" className="type-card font-semibold">
                Browse by task
              </h2>
              <p className="mt-1 type-meta text-muted-foreground">
                Start with the outcome you are trying to reach.
              </p>
            </div>
            {activeCategory || query ? (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-10 type-meta font-medium text-primary"
              >
                Show all
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const selected = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleCategory(category.id)}
                  className={cn(
                    "grid min-h-28 min-w-0 grid-cols-[auto_1fr_auto] grid-rows-2 items-center gap-x-3 rounded-2xl border p-4 text-left transition-colors",
                    selected
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card hover:border-primary/25",
                  )}
                >
                  <span className="row-span-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <strong className="self-end truncate type-body font-semibold">
                    {category.title}
                  </strong>
                  <span className="self-start truncate type-meta text-muted-foreground">
                    {category.description}
                  </span>
                  <ArrowUpRight
                    className="row-span-2 size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="popular-answers-title">
          <div className="mb-4">
            <h2 id="popular-answers-title" className="type-card font-semibold">
              {query ? "Search results" : "Answers"}
            </h2>
            <p className="mt-1 type-meta text-muted-foreground" aria-live="polite">
              {filteredArticles.length} {filteredArticles.length === 1 ? "answer" : "answers"}
            </p>
          </div>

          {filteredArticles.length ? (
            <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
              {filteredArticles.map((article, index) => {
                const open = openArticleId === article.id;
                const category = CATEGORIES.find((item) => item.id === article.category);

                return (
                  <article
                    key={article.id}
                    id={article.id}
                    className={cn(
                      "scroll-mt-20",
                      index !== filteredArticles.length - 1 && "border-b border-border",
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`${article.id}-answer`}
                      onClick={() => openArticle(article.id)}
                      className="flex min-h-[72px] w-full items-center justify-between gap-5 px-4 py-3 text-left sm:px-5"
                    >
                      <span className="grid gap-1">
                        <small className="type-meta text-muted-foreground">
                          {category?.title ?? "Getting started"}
                        </small>
                        <strong className="type-body font-semibold">{article.title}</strong>
                      </span>
                      <motion.span animate={{ rotate: open ? 180 : 0 }}>
                        <ChevronDown className="size-5 text-muted-foreground" aria-hidden="true" />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.div
                          id={`${article.id}-answer`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="grid gap-3 px-4 pb-5 sm:px-5 sm:pr-14">
                            {article.id === "getting-started" ? (
                              <div className="rounded-xl border border-border bg-background p-4">
                                <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                                  {[
                                    "Monitor",
                                    "Understand",
                                    "Decide",
                                    "Test",
                                    "Run",
                                    "Measure",
                                  ].map((step, stepIndex) => (
                                    <li
                                      key={step}
                                      className="min-w-0 rounded-lg border border-border bg-card p-3"
                                    >
                                      <p className="type-meta text-muted-foreground">
                                        {stepIndex + 1}
                                      </p>
                                      <p className="type-body mt-1 font-semibold">{step}</p>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            ) : null}
                            {article.blocks.map((block, blockIndex) => (
                              <ArticleBlockView
                                key={block.title ?? `${article.id}-${blockIndex}`}
                                block={block}
                              />
                            ))}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center rounded-[18px] border border-border bg-card p-6 text-center">
              <div>
                <SearchX className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
                <h3 className="mt-3 type-body font-semibold">No matching answer</h3>
                <p className="mt-1 type-meta text-muted-foreground">
                  Try a shorter phrase or contact support.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="min-h-11 rounded-xl border border-border px-4 type-body font-medium"
                  >
                    Clear search
                  </button>
                  <button
                    type="button"
                    onClick={handleContactSupport}
                    className="min-h-11 rounded-xl bg-primary px-4 type-body font-semibold text-primary-foreground"
                  >
                    Contact support
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section
          id="help-support-strip"
          className="mt-7 scroll-mt-20 grid items-center gap-4 rounded-[18px] border border-border bg-card p-5 shadow-sm sm:grid-cols-[auto_1fr_auto]"
        >
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LifeBuoy className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="type-body font-semibold">Still need help?</h2>
            <p className="mt-1 type-meta text-muted-foreground">
              Send the issue, page name and any relevant link to the support team.
            </p>
          </div>
          <ContactSupportButton
            context="Help Centre"
            variant="default"
            size="lg"
            className="max-sm:w-full sm:shrink-0"
          />
        </section>

        <p className="mt-4 flex items-center justify-center gap-1.5 type-meta text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Role-restricted guidance follows your current workspace access.
        </p>
        <p className="mt-1 flex items-center justify-center gap-1.5 type-meta text-muted-foreground">
          <FileClock className="size-3.5" aria-hidden="true" />
          Looking for what changed recently? See{" "}
          <Link to="/changelog" className="font-medium text-primary">
            Release notes
          </Link>
          .
        </p>
      </div>
    </WorkspaceShell>
  );
}
