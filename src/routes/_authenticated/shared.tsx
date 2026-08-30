import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { useProfile } from "@/hooks/use-profile";
import { listThreads } from "@/lib/smait.functions";
import { EmptyState, PageTitle } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/shared")({
  head: () => ({
    meta: [
      { title: "Shared with FKF - CommsIQ" },
      {
        name: "description",
        content:
          "Message tests colleagues have shared with the Football Kenya Federation workspace, open for follow-up analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Shared with FKF - CommsIQ" },
      {
        property: "og:description",
        content: "Departmental message tests shared across the FKF workspace.",
      },
    ],
  }),
  component: SharedPage,
});

function SharedPage() {
  const { data: profile } = useProfile();
  const fetchThreads = useServerFn(listThreads);

  const { data: threads, isPending } = useQuery({
    queryKey: ["threads", "shared"],
    queryFn: () => fetchThreads({ data: { scope: "shared" } }),
    enabled: profile?.org === "fkf",
  });

  if (profile && profile.org !== "fkf") {
    return (
      <WorkspaceShell title="Shared">
        <PageTitle>Shared</PageTitle>
        <EmptyState
          title="Not available here"
          description="Your workspace is private, so shared tests aren't available."
        />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell title="Shared with FKF">
      <PageTitle description="Tests colleagues shared with the federation workspace.">
        Shared with FKF
      </PageTitle>

      {(isPending || !profile) && (
        <div className="flex items-center gap-2 py-16 type-body text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading shared tests…
        </div>
      )}

      {!isPending && threads?.length === 0 && (
        <EmptyState
          title="Nothing shared yet"
          description="Open one of your tests and switch it to “Shared with FKF”."
        />
      )}

      <ul className="mt-6 space-y-2">
        {threads?.map((thread) => (
          <li key={thread.id} className="rounded-2xl border border-border bg-card px-4 py-3">
            <Link to="/chat/$threadId" params={{ threadId: thread.id }} className="block min-w-0">
              <p className="truncate type-card">{thread.title}</p>
              <p className="type-meta text-muted-foreground">
                {thread.ownerName} ·{" "}
                {new Date(thread.updatedAt).toLocaleString("en-KE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </WorkspaceShell>
  );
}
