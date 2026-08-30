import { createServerFn } from "@tanstack/react-start";
import { assertAdmin } from "./access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ApiCredits = {
  configured: boolean;
  credits: number | null;
  currency: string;
  email: string | null;
  error: string | null;
};

export type UserUsageRow = {
  userId: string;
  name: string;
  email: string;
  posts: number;
  replies: number;
  scheduled: number;
  failed: number;
  total: number;
  lastActiveAt: string | null;
};

export type ApiUsageReport = {
  credits: ApiCredits;
  users: UserUsageRow[];
  totals: { posts: number; replies: number; scheduled: number; failed: number; total: number };
  last30Days: { date: string; calls: number }[];
};

/** twitterapi.io account balance. Returns a soft error instead of throwing. */
async function fetchCredits(): Promise<ApiCredits> {
  const key = process.env["TWITTERAPI_IO_KEY"];
  if (!key) {
    return { configured: false, credits: null, currency: "credits", email: null, error: null };
  }
  try {
    const res = await fetch("https://api.twitterapi.io/oapi/my/info", {
      headers: { "x-api-key": key },
    });
    const body = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      return {
        configured: true,
        credits: null,
        currency: "credits",
        email: null,
        error: body?.msg ?? `Balance lookup failed (${res.status})`,
      };
    }
    const data = body?.data ?? body ?? {};
    const raw = data.recharge_credits ?? data.credits ?? data.balance ?? null;
    return {
      configured: true,
      credits: typeof raw === "number" ? raw : raw != null ? Number(raw) : null,
      currency: "credits",
      email: data.email ?? null,
      error: null,
    };
  } catch (e) {
    return {
      configured: true,
      credits: null,
      currency: "credits",
      email: null,
      error: e instanceof Error ? e.message : "Balance lookup failed",
    };
  }
}

const dayKey = (iso: string) => iso.slice(0, 10);

export const getApiUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiUsageReport> => {
    assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [credits, actions, replies, scheduled, profiles] = await Promise.all([
      fetchCredits(),
      supabaseAdmin.from("publish_actions").select("user_id, status, created_at"),
      supabaseAdmin.from("campaign_replies").select("user_id, status, created_at"),
      supabaseAdmin.from("persona_daily_posts").select("user_id, status, created_at"),
      supabaseAdmin.from("profiles").select("id, email, full_name"),
    ]);

    const people = new Map(
      (profiles.data ?? []).map((p: any) => [
        p.id,
        { email: p.email as string, name: p.full_name as string },
      ]),
    );
    const rows = new Map<string, UserUsageRow>();
    const daily = new Map<string, number>();

    const track = (list: any[] | null, field: "posts" | "replies" | "scheduled") => {
      for (const r of list ?? []) {
        const id = r.user_id as string | null;
        if (!id) continue;
        const person = people.get(id);
        let row = rows.get(id);
        if (!row) {
          row = {
            userId: id,
            name: person?.name ?? "Unknown user",
            email: person?.email ?? "-",
            posts: 0,
            replies: 0,
            scheduled: 0,
            failed: 0,
            total: 0,
            lastActiveAt: null,
          };
          rows.set(id, row);
        }
        row[field] += 1;
        row.total += 1;
        if (String(r.status) === "failed" || String(r.status) === "error") row.failed += 1;
        const at = r.created_at as string;
        if (at && (!row.lastActiveAt || at > row.lastActiveAt)) row.lastActiveAt = at;
        if (at && at >= since) daily.set(dayKey(at), (daily.get(dayKey(at)) ?? 0) + 1);
      }
    };

    track(actions.data as any[], "posts");
    track(replies.data as any[], "replies");
    track(scheduled.data as any[], "scheduled");

    const users = [...rows.values()].sort((a, b) => b.total - a.total);
    const totals = users.reduce(
      (acc, u) => ({
        posts: acc.posts + u.posts,
        replies: acc.replies + u.replies,
        scheduled: acc.scheduled + u.scheduled,
        failed: acc.failed + u.failed,
        total: acc.total + u.total,
      }),
      { posts: 0, replies: 0, scheduled: 0, failed: 0, total: 0 },
    );

    const last30Days: { date: string; calls: number }[] = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      last30Days.push({ date: d, calls: daily.get(d) ?? 0 });
    }

    return { credits, users, totals, last30Days };
  });
