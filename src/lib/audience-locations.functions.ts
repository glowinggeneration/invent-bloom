import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AudienceLocation = {
  /** Clean place name, e.g. "Nairobi, Kenya". */
  place: string;
  /** How many of the accounts sit in that place. */
  count: number;
  /** Share of all accounts we could place. */
  share: number;
};

export type AudienceGender = {
  female: number;
  male: number;
  unknown: number;
};

export type AudienceInfluencer = {
  handle: string;
  name: string;
  avatarUrl: string | null;
  followers: number;
  /** Realistic share of followers who would see a single mention. */
  estimatedReach: number;
  verified: boolean;
};

/**
 * Organic reach on X is only a fraction of an account's followers per post.
 * ~5% is a widely-used midpoint for a single tweet's impressions-to-followers
 * ratio, so we estimate the reach of a mention as that share of the author's
 * audience.
 */
const REACH_RATE = 0.05;
const estimateReach = (followers: number) => Math.round(followers * REACH_RATE);

export type AudienceLocationsResult = {
  locations: AudienceLocation[];
  /** Accounts we looked at. */
  checked: number;
  /** Accounts with a location we could read. */
  placed: number;
  /** Handle (lowercase, no @) -> clean place name. */
  byHandle: Record<string, string>;
  /** Rough gender split, read from display names. */
  gender: AudienceGender;
  /** Biggest accounts mentioning us, by follower count. */
  influencers: AudienceInfluencer[];
  error: string | null;
};

const inputSchema = z.object({
  /** Handles seen in the mentions list, so the chart matches what is on screen. */
  handles: z.array(z.string().min(1).max(30)).max(60).default([]),
});

/**
 * Where the people we reply to — and the people mentioning us — are based.
 * Profile locations are free text, so Google Maps normalises them into real
 * places before we count the top ones.
 */
export const getAudienceLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AudienceLocationsResult> => {
    const handles = new Set(
      data.handles.map((h) => h.replace(/^@/, "").trim().toLowerCase()).filter(Boolean),
    );

    // Accounts our personas replied to in campaigns.
    const { data: replies } = await context.supabase
      .from("campaign_replies")
      .select("author_handle")

      .order("created_at", { ascending: false })
      .limit(300);
    for (const r of replies ?? []) {
      const h = String((r as any).author_handle ?? "")
        .replace(/^@/, "")
        .trim()
        .toLowerCase();
      if (h) handles.add(h);
    }

    const list = [...handles].slice(0, 60);
    const emptyGender = { female: 0, male: 0, unknown: 0 };
    if (!list.length)
      return {
        locations: [],
        checked: 0,
        placed: 0,
        byHandle: {},
        gender: emptyGender,
        influencers: [],
        error: null,
      };

    const { fetchXProfile } = await import("./twitterapi.server");
    const { geocodePlace } = await import("./google-maps.server");
    const { guessGender } = await import("./gender.server");

    const raw: Array<{ handle: string; value: string }> = [];
    const gender = { female: 0, male: 0, unknown: 0 };
    const influencers: AudienceInfluencer[] = [];
    for (let i = 0; i < list.length; i += 8) {
      const chunk = list.slice(i, i + 8);
      const results = await Promise.all(chunk.map((h) => fetchXProfile(h)));
      results.forEach((r, idx) => {
        const loc = r.profile?.location?.trim();
        if (loc) raw.push({ handle: chunk[idx]!, value: loc });
        if (r.profile) {
          gender[guessGender(r.profile.displayName ?? "")] += 1;
          influencers.push({
            handle: chunk[idx]!,
            name: r.profile.displayName || chunk[idx]!,
            avatarUrl: r.profile.avatarUrl ?? null,
            followers: r.profile.followers ?? 0,
            estimatedReach: estimateReach(r.profile.followers ?? 0),
            verified: Boolean((r.profile as { isVerified?: boolean }).isVerified),
          });
        }
      });
    }

    const counts = new Map<string, number>();
    const seen = new Map<string, string | null>();
    let error: string | null = null;
    const byHandle: Record<string, string> = {};
    for (const { handle, value } of raw) {
      const key = value.toLowerCase();
      let place = seen.get(key) ?? null;
      if (!seen.has(key)) {
        const res = await geocodePlace(value);
        place = res.place;
        if (res.error && !error) error = res.error;
        seen.set(key, place);
      }
      if (!place) continue;
      byHandle[handle] = place;
      counts.set(place, (counts.get(place) ?? 0) + 1);
    }

    const placed = [...counts.values()].reduce((a, b) => a + b, 0);
    const locations = [...counts.entries()]
      .map(([place, count]) => ({
        place,
        count,
        share: placed ? Math.round((count / placed) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      locations,
      checked: list.length,
      placed,
      byHandle,
      gender,
      influencers: influencers
        .filter((i) => i.followers > 0)
        .sort((a, b) => b.followers - a.followers)
        .slice(0, 10),
      error: locations.length ? null : error,
    };
  });
