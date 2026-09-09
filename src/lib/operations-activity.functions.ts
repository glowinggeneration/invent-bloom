import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./access";
import { resolveWorkspaceId } from "./workspace.server";

export type OperationsActivityItem = {
  id: string;
  category: "publish" | "campaign" | "always-on" | "test";
  title: string;
  detail: string;
  status: string;
  at: string;
  href: string | null;
};

function iso(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function compact(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

export const getOperationsActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OperationsActivityItem[]> => {
    assertAdmin(context as any);
    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const [publishRes, repliesRes, dailyRes, threadsRes] = await Promise.all([
      admin
        .from("publish_jobs")
        .select(
          "id, mode, tweet_text, comment_text, objective_mode, objective_text, status, created_at",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(120),
      admin
        .from("campaign_replies")
        .select("id, campaign_id, handle, reply_text, status, result_tweet_id, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(180),
      admin
        .from("persona_daily_posts")
        .select(
          "id, content, status, result_tweet_id, published_at, created_at, x_accounts(handle)",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(120),
      admin
        .from("threads")
        .select("id, title, updated_at, created_at")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false })
        .limit(120),
    ]);

    const items: OperationsActivityItem[] = [];

    for (const row of publishRes.data ?? []) {
      const at = iso(row.created_at);
      if (!at) continue;
      const text = row.objective_mode
        ? compact(row.objective_text, "Objective-led publishing run")
        : compact(row.tweet_text || row.comment_text, "Publishing run");
      items.push({
        id: `publish:${row.id}`,
        category: "publish",
        title: row.objective_mode ? "Objective publishing run" : "Publishing run",
        detail: text,
        status: String(row.status ?? "unknown"),
        at,
        href: "/publish",
      });
    }

    for (const row of repliesRes.data ?? []) {
      const at = iso(row.created_at);
      if (!at) continue;
      const handle = String(row.handle ?? "").replace(/^@/, "");
      items.push({
        id: `campaign:${row.id}`,
        category: "campaign",
        title: handle ? `Campaign reply from @${handle}` : "Campaign reply",
        detail: compact(row.reply_text, "Campaign reply recorded"),
        status: String(row.status ?? "unknown"),
        at,
        href: row.campaign_id
          ? `/performance?campaign=${encodeURIComponent(String(row.campaign_id))}`
          : "/performance",
      });
    }

    for (const row of dailyRes.data ?? []) {
      const at = iso(row.published_at) ?? iso(row.created_at);
      if (!at) continue;
      const handle = String(row.x_accounts?.handle ?? "").replace(/^@/, "");
      items.push({
        id: `always-on:${row.id}`,
        category: "always-on",
        title: handle ? `Always-on post · @${handle}` : "Always-on post",
        detail: compact(row.content, "Always-on content"),
        status: String(row.status ?? "unknown"),
        at,
        href: "/always-on",
      });
    }

    for (const row of threadsRes.data ?? []) {
      const at = iso(row.updated_at) ?? iso(row.created_at);
      if (!at) continue;
      items.push({
        id: `test:${row.id}`,
        category: "test",
        title: compact(row.title, "Message test"),
        detail: "Response Studio test created or updated",
        status: "recorded",
        at,
        href: `/chat/${row.id}`,
      });
    }

    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 250);
  });
