import { useQuery } from "@tanstack/react-query";
import { AccountIdentity } from "@/components/account-identity";
import { ExternalIdentity } from "@/components/external-identity";
import { useServerFn } from "@tanstack/react-start";
import {
  Bookmark,
  Download,
  ExternalLink,
  Heart,
  Loader2,
  MessageCircle,
  Repeat2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPublishCampaign, getTweetPreview } from "@/lib/publish.functions";
import { formatCount } from "@/lib/performance";
import {
  ENGAGEMENT_ACTION_LABELS,
  ENGAGEMENT_TARGET_LABELS,
  modeLabel,
  type CampaignActionRow,
  type CampaignDetail,
  type EngagementActionsSelection,
} from "@/lib/publish";

function csvCell(value: string | null) {
  const v = (value ?? "").replace(/"/g, '""');
  return `"${v}"`;
}

const STATUS_TONE: Record<string, string> = {
  success: "text-emerald-600",
  failed: "text-muted-foreground",
  pending: "text-muted-foreground",
};

/**
 * Operational wording only: retries and account failover happen automatically,
 * so an action that has not landed yet is simply still in progress.
 */
const STATUS_LABEL: Record<string, string> = {
  success: "delivered",
  failed: "in progress",
  pending: "queued",
  queued: "queued",
  running: "sending",
};

const statusLabel = (status: string) => STATUS_LABEL[status] ?? status;

/** The post the personas replied to, rendered like the original tweet. */
function TargetTweet({ url }: { url: string }) {
  const fetchPreview = useServerFn(getTweetPreview);
  const { data, isLoading } = useQuery({
    queryKey: ["tweet-preview", url],
    queryFn: () => fetchPreview({ data: { url } }),
    enabled: /status\/\d+/.test(url),
    staleTime: 5 * 60 * 1000,
  });
  const tweet = data?.tweet ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">Replying to this post</p>
      {tweet ? (
        <div className="mt-2 space-y-2">
          <ExternalIdentity
            handle={tweet.authorHandle}
            fallbackName={tweet.authorName ?? null}
            avatarClassName="size-9"
            nameClassName="truncate text-sm font-semibold"
          />
          <p className="whitespace-pre-wrap text-sm leading-snug">{tweet.text}</p>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] tabular-nums text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5" /> {formatCount(tweet.replyCount ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Repeat2 className="size-3.5" /> {formatCount(tweet.retweetCount ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3.5" /> {formatCount(tweet.likeCount ?? 0)}
            </span>
            <Bookmark className="size-3.5" />
          </div>
        </div>
      ) : (
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {isLoading ? "Loading post…" : url}
        </p>
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Open on X <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

/** One persona's reply or post, shown as a comment card. */
function ActionCard({ action, threaded }: { action: CampaignActionRow; threaded: boolean }) {
  return (
    <li className={threaded ? "border-l-2 border-border/70 pl-4" : ""}>
      <div className="rounded-2xl border border-border/70 bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AccountIdentity
            handle={action.handle}
            avatarClassName="size-7"
            nameClassName="truncate text-sm font-medium"
          />
          <span
            className={`text-[11px] font-medium ${STATUS_TONE[action.status] ?? "text-muted-foreground"}`}
          >
            {statusLabel(action.status)}
          </span>
        </div>
        {action.content && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-snug">{action.content}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span>{new Date(action.createdAt).toLocaleString()}</span>
          {action.url && (
            <a
              href={action.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

function downloadCsv(campaign: CampaignDetail) {
  const header = ["Date", "Time", "Account", "Action", "Status", "Link", "Content"];
  const rows = campaign.actions.map((a) => {
    const d = new Date(a.createdAt);
    return [
      csvCell(d.toLocaleDateString()),
      csvCell(d.toLocaleTimeString()),
      csvCell(a.handle ? `@${a.handle}` : ""),
      csvCell(a.actionType),
      csvCell(statusLabel(a.status)),
      csvCell(a.url),
      csvCell(a.content),
    ].join(",");
  });
  const csv = [header.join(","), ...rows].join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `campaign-${campaign.id.slice(0, 8)}-${new Date(campaign.createdAt)
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function CampaignDialog({
  campaignId,
  onClose,
}: {
  campaignId: string | null;
  onClose: () => void;
}) {
  const fetchCampaign = useServerFn(getPublishCampaign);
  const query = useQuery({
    queryKey: ["publish-campaign", campaignId],
    queryFn: () => fetchCampaign({ data: { jobId: campaignId as string } }),
    enabled: Boolean(campaignId),
  });
  const campaign = query.data;

  return (
    <Dialog open={Boolean(campaignId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="text-base">Campaign</DialogTitle>
          <DialogDescription className="truncate">
            {campaign
              ? `${modeLabel(campaign.mode)} · ${new Date(campaign.createdAt).toLocaleString()}`
              : "Loading campaign details…"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
          {query.isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {query.isError && (
            <p className="py-6 text-sm text-muted-foreground">
              This campaign is still syncing. Try again in a moment.
            </p>
          )}
          {campaign && (
            <>
              {campaign.targetTweetUrl && <TargetTweet url={campaign.targetTweetUrl} />}

              {campaign.objectiveMode && (
                <p className="mt-3 rounded-xl border border-border px-3 py-2 text-sm">
                  <span className="text-xs text-muted-foreground">Objective brief</span>
                  <br />
                  {campaign.objectiveText || campaign.tweetText || campaign.commentText || "-"}
                </p>
              )}

              {(() => {
                const written = campaign.actions.filter(
                  (a) => a.actionType === "comment" || a.actionType === "tweet",
                );
                const engagement = campaign.actions.filter(
                  (a) => a.actionType !== "comment" && a.actionType !== "tweet",
                );
                const threaded = Boolean(campaign.targetTweetUrl);
                return (
                  <>
                    <p className="mt-4 text-xs font-medium text-muted-foreground">
                      {threaded
                        ? `Persona replies (${written.length})`
                        : `Persona posts (${written.length})`}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {written.map((a) => (
                        <ActionCard key={a.id} action={a} threaded={threaded} />
                      ))}
                      {written.length === 0 && (
                        <li className="py-2 text-xs text-muted-foreground">Nothing here yet.</li>
                      )}
                    </ul>

                    {engagement.length > 0 && (
                      <details className="mt-4 rounded-xl border border-border/70 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                          Engagement actions ({engagement.length})
                        </summary>
                        <ul className="mt-2 space-y-1.5">
                          {engagement.map((a) => (
                            <li
                              key={a.id}
                              className="flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <AccountIdentity
                                handle={a.handle}
                                avatarClassName="size-5"
                                nameClassName="truncate text-xs font-medium"
                              />
                              <span className="text-muted-foreground">
                                {a.actionType} ·{" "}
                                <span className={STATUS_TONE[a.status] ?? ""}>
                                  {statusLabel(a.status)}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                );
              })()}

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Engagement actions selected:</span>
                {(["like", "retweet", "bookmark", "follow"] as (keyof EngagementActionsSelection)[])
                  .filter((k) => campaign.engagementActions[k])
                  .map((k) => (
                    <span
                      key={k}
                      className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                    >
                      {ENGAGEMENT_ACTION_LABELS[k]}
                    </span>
                  ))}
                {!Object.values(campaign.engagementActions).some(Boolean) && (
                  <span className="text-xs text-muted-foreground">None - posting only</span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Applied to:</span>
                {(["author", "peer", "watchlist"] as const)
                  .filter((k) => campaign.engagementTargets?.[k])
                  .map((k) => (
                    <span
                      key={k}
                      className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {ENGAGEMENT_TARGET_LABELS[k]}
                    </span>
                  ))}
                {!Object.values(campaign.engagementTargets ?? {}).some(Boolean) && (
                  <span className="text-xs text-muted-foreground">No targets</span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            disabled={!campaign || campaign.actions.length === 0}
            onClick={() => campaign && downloadCsv(campaign)}
          >
            <Download className="mr-2 h-4 w-4" /> Download CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
