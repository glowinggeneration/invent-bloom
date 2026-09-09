/**
 * CSV builders for a reporting period.
 *
 * Every row comes from stored data — mentions the collectors saved and actions
 * the platform actually executed. Nothing is generated or estimated, and no
 * credential, token or cookie is ever included.
 */
import { loadExecutions, loadMentions } from "./reports.server";
import { getWorkspaceSettings } from "./entity-config.server";

function cell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value).replace(/\r?\n/g, " ");
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function line(values: (string | number | null | undefined)[]): string {
  return values.map(cell).join(",");
}

const KIND_LABEL: Record<string, string> = {
  tweet: "Post",
  comment: "Reply",
  like: "Like",
  retweet: "Repost",
  bookmark: "Bookmark",
  follow: "Follow",
};

const SUCCESS = new Set(["success", "posted", "completed", "sent"]);
const FAILED = new Set(["failed", "error"]);

function dateParts(iso: string | null): [string, string] {
  if (!iso) return ["", ""];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return ["", ""];
  const shifted = new Date(d.getTime() + 3 * 3600_000).toISOString();
  return [shifted.slice(0, 10), shifted.slice(11, 19)];
}

export async function mentionsCsv(
  periodStart: string,
  periodEnd: string,
  workspaceId: string,
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const settings = await getWorkspaceSettings(workspaceId);
  const items = await loadMentions(
    supabaseAdmin as any,
    periodStart,
    periodEnd,
    [],
    settings,
    workspaceId,
  );
  const out = [
    line([
      "Date",
      "Time",
      "Platform",
      "Author",
      "Handle",
      "Content",
      "URL",
      "Entity",
      "Topic",
      "Sentiment",
      "Views",
      "Likes",
      "Comments",
      "Shares",
      "Engagements",
      "Matched Keyword",
      "Collected At",
    ]),
  ];
  for (const i of items) {
    const [date, time] = dateParts(i.at ? new Date(i.at).toISOString() : null);
    out.push(
      line([
        date,
        time,
        i.platform,
        i.authorName,
        i.authorHandle ? `@${i.authorHandle.replace(/^@/, "")}` : "",
        (i.content || i.title).slice(0, 900),
        i.url,
        i.entity,
        i.topics.join(" | "),
        i.sentiment,
        i.views,
        i.likes,
        i.comments,
        i.shares,
        i.engagements,
        i.matchedKeyword,
        i.collectedAt ?? "",
      ]),
    );
  }
  return out.join("\n");
}

export async function campaignsCsv(
  periodStart: string,
  periodEnd: string,
  workspaceId: string,
): Promise<string> {
  const { buildReport } = await import("./reports.server");
  const report = await buildReport({
    kind: "custom",
    reportDate: periodStart.slice(0, 10),
    label: "",
    periodStart,
    periodEnd,
    workspaceId,
  });

  const out = [
    line([
      "Campaign Name",
      "Campaign Type",
      "Created At",
      "Started At",
      "Completed At",
      "Status",
      "Target Post",
      "Target URL",
      "Personas Selected",
      "Eligible Personas",
      "Actions Requested",
      "Actions Completed",
      "Likes",
      "Replies",
      "Reposts",
      "Follows",
      "Posts",
      "Successful Actions",
      "Failed Actions",
      "Total Engagement Generated",
    ]),
  ];
  for (const r of report.campaigns.runs) {
    out.push(
      line([
        r.campaignName,
        r.campaignType,
        r.createdAt ?? "",
        r.startedAt ?? "",
        r.completedAt ?? "",
        r.status,
        r.targetPost,
        r.targetUrl,
        r.personasRequested,
        r.personasEligible,
        r.requestedActions,
        r.completedActions,
        r.likes,
        r.replies,
        r.reposts,
        r.follows,
        r.posts,
        r.completedActions,
        r.failedActions,
        r.engagementGenerated,
      ]),
    );
  }
  return out.join("\n");
}

export async function personaActivityCsv(
  periodStart: string,
  periodEnd: string,
  workspaceId: string,
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  const [rows, accountRows] = await Promise.all([
    loadExecutions(admin, periodStart, periodEnd, [], workspaceId),
    admin
      .from("x_accounts")
      .select("id, handle, persona_label, display_name")
      .eq("workspace_id", workspaceId)
      .then((r: any) => r.data ?? [])
      .catch(() => []),
  ]);

  const accounts = new Map<string, { handle: string; persona: string }>();
  for (const a of accountRows as any[]) {
    accounts.set(String(a.id), {
      handle: String(a.handle ?? ""),
      persona: String(a.persona_label ?? a.display_name ?? a.handle ?? ""),
    });
  }

  const names = new Map<string, string>();
  const jobIds = [...new Set(rows.filter((r) => r.source === "publish").map((r) => r.campaignId))];
  const listenIds = [
    ...new Set(rows.filter((r) => r.source === "listen").map((r) => r.campaignId)),
  ];
  if (jobIds.length) {
    const { data } = await admin
      .from("publish_jobs")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .in("id", jobIds);
    for (const j of (data ?? []) as any[]) names.set(`publish:${j.id}`, String(j.name ?? ""));
  }
  if (listenIds.length) {
    const { data } = await admin
      .from("listening_campaigns")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .in("id", listenIds);
    for (const c of (data ?? []) as any[]) names.set(`listen:${c.id}`, String(c.name ?? ""));
  }

  const out = [
    line([
      "Persona",
      "Account",
      "Platform",
      "Campaign",
      "Action",
      "Target",
      "Time",
      "Status",
      "Result",
    ]),
  ];
  for (const r of rows.sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")))) {
    const acc = r.accountId ? accounts.get(r.accountId) : undefined;
    const handle = r.handle || acc?.handle || "";
    out.push(
      line([
        r.persona || acc?.persona || handle || "Persona",
        handle ? `@${handle.replace(/^@/, "")}` : "",
        "X",
        names.get(r.campaignKey) || "Campaign",
        KIND_LABEL[r.kind] ?? r.kind,
        r.target,
        r.at ?? "",
        SUCCESS.has(r.status) ? "Success" : FAILED.has(r.status) ? "Failed" : r.status,
        r.result,
      ]),
    );
  }
  return out.join("\n");
}
