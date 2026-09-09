import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type BrandProfile } from "./brand-profiles";
import { brandHandles, getWorkspaceSettings } from "./entity-config.server";
import { resolveWorkspaceId } from "./workspace.server";

/** Stored brand profile cards for the signed-in workspace. */
export const listBrandProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BrandProfile[]> => {
    const { mapBrandRows } = await import("./brand-profiles.server");
    const { data } = await context.supabase
      .from("brand_profiles")
      .select("*")
      .order("followers", { ascending: false });
    return mapBrandRows(data ?? []);
  });

/** Pulls the live X profile for each tracked brand account and stores it. */
export const refreshBrandProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ profiles: BrandProfile[]; error: string | null }> => {
    const { fetchXProfile } = await import("./twitterapi.server");
    const { mapBrandRows } = await import("./brand-profiles.server");

    const errors: string[] = [];
    const workspaceId = await resolveWorkspaceId(context);
    const settings = await getWorkspaceSettings(workspaceId);
    for (const handle of brandHandles(settings)) {
      const { profile, error } = await fetchXProfile(handle);
      if (!profile) {
        errors.push(`${handle}: ${error ?? "not found"}`);
        continue;
      }
      const { error: dbError } = await context.supabase.from("brand_profiles").upsert(
        {
          user_id: context.userId,
          handle: profile.handle,
          display_name: profile.displayName,
          description: profile.description,
          location: profile.location,
          avatar_url: profile.avatarUrl,
          banner_url: profile.bannerUrl,
          followers: profile.followers,
          following: profile.following,
          tweet_count: profile.tweetCount,
          media_count: profile.mediaCount,
          favourites_count: profile.favouritesCount,
          is_verified: profile.isVerified,
          profile_created_at: profile.createdAt,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,handle" },
      );
      if (dbError) errors.push(`${handle}: ${dbError.message}`);
    }

    const { data } = await context.supabase
      .from("brand_profiles")
      .select("*")
      .order("followers", { ascending: false });

    return {
      profiles: mapBrandRows(data ?? []),
      error: errors.length ? errors.join(" · ") : null,
    };
  });
