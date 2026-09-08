import { createFileRoute } from "@tanstack/react-router";
import { BrandMentions } from "@/components/brand-mentions";
import { BrandAccounts } from "@/components/brand-accounts";
import { SocialProfiles } from "@/components/social-profiles";
import { MentionInvestigation } from "@/components/mention-investigation";
import { SavedInvestigations } from "@/components/saved-investigations";

import { WorkspaceShell } from "@/components/workspace-shell";
import { PageTitle } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/mentions")({
  head: () => ({
    meta: [
      { title: "Mentions - SMAIT" },
      {
        name: "description",
        content:
          "See what people are posting about your organisation and its leadership, how it feels, and reply in one tap.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Mentions - SMAIT" },
      {
        property: "og:description",
        content: "Who is talking about your organisation right now, and how it reads.",
      },
    ],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    sentiment?: string | undefined;
    platform?: string | undefined;
    topic?: string | undefined;
  } => {
    const str = (key: string) =>
      typeof search[key] === "string" && search[key] ? (search[key] as string) : undefined;
    return { sentiment: str("sentiment"), platform: str("platform"), topic: str("topic") };
  },
  component: MentionsPage,
});

function MentionsPage() {
  const search = Route.useSearch();
  return (
    <WorkspaceShell title="Mentions" wide>
      <PageTitle description="Public posts about your organisation and its leadership, scored in context.">
        Mentions
      </PageTitle>
      <BrandAccounts />
      <SocialProfiles />
      <SavedInvestigations currentTopic={search.topic ?? ""} />

      {search.topic ? (
        <MentionInvestigation topic={search.topic} />
      ) : (
        <BrandMentions initialSentiment={search.sentiment} initialSource={search.platform} />
      )}
    </WorkspaceShell>
  );
}
