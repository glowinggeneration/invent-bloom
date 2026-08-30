import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { listThreads } from "@/lib/smait.functions";
import { readActiveTest } from "@/lib/active-test";

const STEPS = ["upload", "analysis", "recommendations"] as const;
type Step = (typeof STEPS)[number];

type TestingSearch = { step?: Step };

export const Route = createFileRoute("/_authenticated/testing")({
  validateSearch: (search: Record<string, unknown>): TestingSearch => {
    const raw = typeof search["step"] === "string" ? (search["step"] as string) : "";
    return STEPS.includes(raw as Step) ? { step: raw as Step } : {};
  },
  head: () => ({
    meta: [
      { title: "Message testing - FKF CommsIQ" },
      {
        name: "description",
        content:
          "Open the FKF CommsIQ message testing workspace directly to run persona-based message tests.",
      },
      { property: "og:title", content: "Message testing - FKF CommsIQ" },
      {
        property: "og:description",
        content: "Open the FKF CommsIQ message testing workspace directly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TestingEntry,
});

/** Deep-link shim: resolves the right destination and redirects, showing nothing. */
function TestingEntry() {
  const navigate = useNavigate();
  const { step } = Route.useSearch();
  const fetchThreads = useServerFn(listThreads);

  const needsThread = step === "analysis" || step === "recommendations";
  const { data: threads, isLoading } = useQuery({
    queryKey: ["threads", "mine"],
    queryFn: () => fetchThreads({ data: { scope: "mine" } }),
    enabled: needsThread,
  });

  useEffect(() => {
    if (!needsThread) {
      void navigate({ to: "/new", replace: true });
      return;
    }

    const active = readActiveTest();
    const threadId =
      active?.threadId ?? (threads as { id?: string }[] | undefined)?.[0]?.id ?? null;

    if (threadId) {
      void navigate({
        to: step === "analysis" ? "/chat/$threadId" : "/recommendations/$threadId",
        params: { threadId },
        replace: true,
      });
      return;
    }

    if (!isLoading) void navigate({ to: "/new", replace: true });
  }, [navigate, step, needsThread, isLoading, threads]);

  return null;
}
