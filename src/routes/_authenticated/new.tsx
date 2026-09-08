import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GitCompareArrows } from "lucide-react";
import { toast } from "sonner";
import { useCallback, useEffect, useState } from "react";
import { Composer, type ComposerPayload } from "@/components/composer";
import { MessageTemplates } from "@/components/message-templates";
import { setAnalysisStatus, setFirstRunStep } from "@/lib/first-run";
import { EXAMPLE_MESSAGE_TEXT, takeExampleMessage } from "@/lib/example-message";
import { TestProgress } from "@/components/test-progress";
import { TESTING_DRAFT_KEY } from "@/lib/composer-draft";
import { completeActiveTest, interruptActiveTest, startActiveTest } from "@/lib/active-test";
import { WorkspaceShell } from "@/components/workspace-shell";
import { PageTitle } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { listThreads, sendMessage } from "@/lib/smait.functions";
import { PERSONAS } from "@/lib/personas";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/new")({
  validateSearch: (search: Record<string, unknown>): { text?: string | undefined } => ({
    text:
      typeof search["text"] === "string" && search["text"].trim()
        ? search["text"].slice(0, 4000)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Response Studio - SMAIT" },
      {
        name: "description",
        content:
          "Start a new message test: paste copy, attach a creative or brief, and see how 100 Kenyan personas respond before publication.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "New test - SMAIT" },
      {
        property: "og:description",
        content: "Test messaging against 100 research-grounded Kenyan personas.",
      },
    ],
  }),
  component: NewTest,
});

const CHIPS = [
  { label: "Quick test", text: "Run a quick sentiment read on this message." },
  { label: "Shorten", text: "Make this shorter and punchier without losing the key facts." },
  { label: "Make it stronger", text: "Make the tone more confident and authoritative." },
  { label: "Add call to action", text: "Add a clear call to action for fans." },
  { label: "Improve clarity", text: "Rewrite this so it is unmistakably clear on first read." },
];

function NewTest() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const send = useServerFn(sendMessage);
  const fetchThreads = useServerFn(listThreads);

  const { data: threads } = useQuery({
    queryKey: ["threads", "mine"],
    queryFn: () => fetchThreads({ data: { scope: "mine" } }),
  });

  const list = threads ?? [];

  const mutation = useMutation({
    mutationFn: async (payload: ComposerPayload) =>
      send({
        data: {
          threadId: null,
          text: payload.text,
          imageDataUrl: payload.imageDataUrl,
          attachments: payload.attachments,
        },
      }),
    onMutate: (payload: ComposerPayload) => {
      setAnalysisStatus("running");
      startActiveTest({ text: payload.text });
    },
    onSuccess: (result) => {
      setAnalysisStatus("completed");
      completeActiveTest(result.threadId);
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: result.threadId } });
    },
    onError: (error: Error) => {
      const message = friendlyError(error, {
        action: "run this test",
        preserved: "Your message is still saved.",
      });
      setAnalysisStatus("failed", message);
      interruptActiveTest();
      toast.error(message);
    },
  });

  const [prefill, setPrefill] = useState<{ text: string; token: number } | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  useEffect(() => {
    if (search.text) {
      setPrefill({ text: search.text, token: Date.now() });
      setFocusToken(Date.now());
      return;
    }
    const stashed = takeExampleMessage();
    if (stashed) setPrefill({ text: stashed, token: Date.now() });
  }, [search.text]);

  useEffect(() => {
    if (!mutation.isPending) return;
    const onUnload = () => interruptActiveTest();
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      interruptActiveTest();
    };
  }, [mutation.isPending]);

  const handleComposerState = useCallback(
    ({ hasText, hasImage }: { hasText: boolean; hasImage: boolean }) => {
      if (hasText) setFirstRunStep("text", true);
      if (hasImage) setFirstRunStep("image", true);
    },
    [],
  );

  function loadText(text: string) {
    setPrefill({ text, token: Date.now() });
    setFocusToken(Date.now());
    setFirstRunStep("text", true);
  }

  function loadExampleMessage() {
    loadText(EXAMPLE_MESSAGE_TEXT);
  }

  return (
    <WorkspaceShell title="Response Studio">
      <PageTitle
        description={`Paste a message and see how ${PERSONAS.length} Kenyan personas react.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/compare">
              <GitCompareArrows className="size-4" /> Compare versions
            </Link>
          </Button>
        }
      >
        Will your message land?
      </PageTitle>

      {mutation.isPending ? (
        <TestProgress />
      ) : (
        <Composer
          draftKey={TESTING_DRAFT_KEY}
          onSubmit={(p) => mutation.mutate(p)}
          pending={mutation.isPending}
          chips={CHIPS}
          onStateChange={handleComposerState}
          prefill={prefill}
          focusToken={focusToken}
        />
      )}

      {!mutation.isPending ? <MessageTemplates onUse={loadText} /> : null}

      {list.length === 0 && !mutation.isPending && (
        <p className="type-meta mt-4 text-muted-foreground">
          Paste a message, or{" "}
          <Button variant="link" className="type-meta h-auto p-0" onClick={loadExampleMessage}>
            try an example
          </Button>
          .
        </p>
      )}
    </WorkspaceShell>
  );
}
