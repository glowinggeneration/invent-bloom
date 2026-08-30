import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExternalProfile = {
  handle: string;
  displayName: string;
  description: string;
  avatarUrl: string | null;
  followers: number;
  following: number;
  tweetCount: number;
  isVerified: boolean;
  fetchedAt: string;
};

const STALE_MS = 24 * 60 * 60 * 1000;
const MAX_FETCH_PER_CALL = 12;

const norm = (h?: string | null) => (h ?? "").trim().replace(/^@/, "").toLowerCase();

function mapRow(row: any): ExternalProfile {
  return {
    handle: row.handle,
    displayName: row.display_name || row.handle,
    description: row.description ?? "",
    avatarUrl: row.avatar_url ?? null,
    followers: row.followers ?? 0,
    following: row.following ?? 0,
    tweetCount: row.tweet_count ?? 0,
    isVerified: Boolean(row.is_verified),
    fetchedAt: row.fetched_at,
  };
}

/**
 * Resolves the public X profile (name, picture, follower counts) for any
 * handle a persona interacted with. Reads a shared cache first and only calls
 * the X API for handles that are missing or stale.
 */
export const resolveExternalProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { handles: string[] }) => ({
    handles: Array.from(new Set((input?.handles ?? []).map(norm).filter(Boolean))).slice(0, 60),
  }))
  .handler(async ({ data, context }): Promise<ExternalProfile[]> => {
    if (data.handles.length === 0) return [];

    const { data: cached } = await context.supabase
      .from("external_profiles")
      .select("*")
      .in("handle", data.handles);

    const byHandle = new Map<string, ExternalProfile>();
    for (const row of cached ?? []) byHandle.set(row.handle, mapRow(row));

    const now = Date.now();
    const needed = data.handles
      .filter((h) => {
        const hit = byHandle.get(h);
        return !hit || now - new Date(hit.fetchedAt).getTime() > STALE_MS;
      })
      .slice(0, MAX_FETCH_PER_CALL);

    if (needed.length > 0) {
      const { fetchXProfile } = await import("./twitterapi.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const rows: any[] = [];
      for (const handle of needed) {
        const { profile } = await fetchXProfile(handle).catch(() => ({ profile: null }) as any);
        if (!profile) continue;
        const row = {
          handle,
          display_name: profile.displayName,
          description: profile.description,
          avatar_url: profile.avatarUrl,
          followers: profile.followers,
          following: profile.following,
          tweet_count: profile.tweetCount,
          is_verified: profile.isVerified,
          fetched_at: new Date().toISOString(),
        };
        rows.push(row);
        byHandle.set(handle, mapRow(row));
      }
      if (rows.length > 0) {
        await supabaseAdmin.from("external_profiles").upsert(rows, { onConflict: "handle" });
      }
    }

    return data.handles.map(
      (h) =>
        byHandle.get(h) ?? {
          handle: h,
          displayName: h,
          description: "",
          avatarUrl: null,
          followers: 0,
          following: 0,
          tweetCount: 0,
          isVerified: false,
          fetchedAt: new Date(0).toISOString(),
        },
    );
  });
