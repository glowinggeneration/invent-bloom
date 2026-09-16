import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { EMPTY_SOCIALS, cleanHandle, cleanHashtag, type SetupStatus } from "./onboarding";
import { resolveWorkspaceId } from "./workspace.server";

const socialsSchema = z.object({
  facebook: z.string().trim().max(120).default(""),
  instagram: z.string().trim().max(120).default(""),
  tiktok: z.string().trim().max(120).default(""),
  youtube: z.string().trim().max(120).default(""),
});

const setupSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  jobTitle: z.string().trim().max(120).default(""),
  team: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(40).default(""),
  phoneWhatsapp: z.boolean().default(false),
  brandName: z.string().trim().max(120).default(""),
  brandHandle: z.string().trim().max(60).default(""),
  orgAddress: z.string().trim().max(300).default(""),
  orgWebsite: z.string().trim().max(200).default(""),
  orgDescription: z.string().trim().max(2000).default(""),
  orgProfilePath: z.string().trim().max(400).default(""),
  orgProfileName: z.string().trim().max(200).default(""),
  keyFigures: z.array(z.string().trim().min(2).max(80)).max(10).default([]),
  keywords: z.array(z.string().trim().min(2).max(80)).max(25).default([]),
  hashtags: z.array(z.string().trim().min(2).max(80)).max(25).default([]),
  topics: z.array(z.string().trim().min(2).max(80)).max(25).default([]),
  socials: socialsSchema.default(EMPTY_SOCIALS),
  /** True while the person is still moving between steps; keeps setup open. */
  partial: z.boolean().default(false),
});

/** Current setup answers plus whether the guided flow still needs running. */
export const getSetupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SetupStatus> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(
        "full_name, job_title, team, phone, phone_whatsapp, onboarding_completed_at, onboarding_skipped_at",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const workspaceId = await resolveWorkspaceId(context);
    const { getWorkspaceSettings } = await import("./entity-config.server");
    const settings = await getWorkspaceSettings(workspaceId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: orgExtrasRow } = await db
      .from("workspace_settings")
      .select("org_address, org_website, org_description, org_profile_path, org_profile_name")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    const orgExtras = (orgExtrasRow ?? {}) as Record<string, string | null>;

    const { data: keywordRows } = await db
      .from("mention_keywords")
      .select("term")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(40);

    const { data: watchRows } = await db
      .from("monitoring_watchlist")
      .select("kind, platform, value")
      .eq("workspace_id", workspaceId)
      .in("kind", ["account", "hashtag", "topic"])
      .eq("is_active", true)
      .limit(120);

    const allWatch = (watchRows ?? []) as {
      kind: string;
      platform: string | null;
      value: string;
    }[];

    const socials = { ...EMPTY_SOCIALS };
    for (const row of allWatch.filter((r) => r.kind === "account")) {
      const key = String(row.platform ?? "").toLowerCase();
      if (key in socials && !socials[key as keyof typeof socials]) {
        socials[key as keyof typeof socials] = row.value;
      }
    }
    const hashtags = allWatch.filter((r) => r.kind === "hashtag").map((r) => r.value);
    const topics = allWatch.filter((r) => r.kind === "topic").map((r) => r.value);

    return {
      needsSetup: !data?.onboarding_completed_at && !data?.onboarding_skipped_at,
      fullName: data?.full_name ?? "",
      jobTitle: data?.job_title ?? "",
      team: data?.team ?? "",
      phone: data?.phone ?? "",
      phoneWhatsapp: data?.phone_whatsapp ?? false,
      brandName: settings.orgName,
      brandHandle: settings.orgHandle,
      orgAddress: orgExtras["org_address"] ?? "",
      orgWebsite: orgExtras["org_website"] ?? "",
      orgDescription: orgExtras["org_description"] ?? "",
      orgProfilePath: orgExtras["org_profile_path"] ?? "",
      orgProfileName: orgExtras["org_profile_name"] ?? "",
      keyFigures: settings.keyFigures,
      keywords: ((keywordRows ?? []) as { term: string }[]).map((r) => r.term).filter(Boolean),
      hashtags,
      topics,
      socials,
    };
  });

/** Saves the guided setup: profile details, monitoring keywords and optional pages. */
export const saveSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setupSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ keywordsAdded: number; pagesAdded: number }> => {
    const brandHandle = cleanHandle(data.brandHandle);

    const { error: profileError } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.fullName,
        job_title: data.jobTitle,
        team: data.team,
        phone: data.phone,
        phone_whatsapp: data.phoneWhatsapp,
        ...(data.partial ? {} : { onboarding_completed_at: new Date().toISOString() }),
        onboarding_skipped_at: null,
      })
      .eq("id", context.userId);
    if (profileError) throw new Error(profileError.message);

    const workspaceId = await resolveWorkspaceId(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    // Organisation identity and key figures are workspace-wide, not per-user -
    // every team member's setup writes into the same shared row, same as the
    // shared mention_keywords/monitoring_watchlist writes below.
    const { error: settingsError } = await db
      .from("workspace_settings")
      .update({
        org_name: data.brandName,
        org_handle: brandHandle,
        key_figures: data.keyFigures,
        org_address: data.orgAddress,
        org_website: data.orgWebsite,
        org_description: data.orgDescription,
        org_profile_path: data.orgProfilePath,
        org_profile_name: data.orgProfileName,
        updated_by: context.userId,
      })
      .eq("workspace_id", workspaceId);
    if (settingsError) throw new Error(settingsError.message);

    // Monitoring keywords — the listening pipeline reads this list every run.
    const { data: existingKeywords } = await db
      .from("mention_keywords")
      .select("term")
      .eq("workspace_id", workspaceId);
    const known = new Set(
      ((existingKeywords ?? []) as { term: string }[]).map((r) => r.term.trim().toLowerCase()),
    );
    const fresh: string[] = [];
    for (const term of data.keywords) {
      const key = term.toLowerCase();
      if (!term || known.has(key)) continue;
      known.add(key);
      fresh.push(term);
    }
    if (fresh.length) {
      await db.from("mention_keywords").insert(
        fresh.map((term) => ({
          workspace_id: workspaceId,
          term,
          source: "setup",
          is_active: true,
          last_refreshed_at: new Date().toISOString(),
        })),
      );
    }

    // Optional accounts, hashtags and topics to watch, including the brand's own X handle.
    type WatchEntry = { kind: string; platform: string | null; value: string; label: string };
    const entries: WatchEntry[] = [];
    if (brandHandle) {
      entries.push({
        kind: "account",
        platform: "x",
        value: brandHandle,
        label: data.brandName || `@${brandHandle}`,
      });
    }
    for (const [platform, raw] of Object.entries(data.socials)) {
      const value = cleanHandle(String(raw ?? ""));
      if (value)
        entries.push({
          kind: "account",
          platform,
          value,
          label: `${data.brandName || value} (${platform})`,
        });
    }
    for (const raw of data.hashtags) {
      const value = cleanHashtag(raw);
      if (value) entries.push({ kind: "hashtag", platform: null, value, label: `#${value}` });
    }
    for (const raw of data.topics) {
      const value = raw.trim();
      if (value) entries.push({ kind: "topic", platform: null, value, label: value });
    }

    let pagesAdded = 0;
    if (entries.length) {
      const { data: existingWatch } = await db
        .from("monitoring_watchlist")
        .select("kind, platform, value")
        .eq("workspace_id", workspaceId);
      const keyOf = (kind: string, platform: string | null, value: string) =>
        `${kind}:${String(platform ?? "").toLowerCase()}:${value.trim().toLowerCase()}`;
      const seen = new Set(
        ((existingWatch ?? []) as { kind: string; platform: string | null; value: string }[]).map(
          (r) => keyOf(r.kind, r.platform, r.value),
        ),
      );
      const rows = entries
        .filter((a) => !seen.has(keyOf(a.kind, a.platform, a.value)))
        .map((a) => ({
          workspace_id: workspaceId,
          kind: a.kind,
          label: a.label.slice(0, 120),
          value: a.value,
          platform: a.platform,
          priority: "standard",
          notes: "Added during profile setup",
          alert_enabled: true,
          is_active: true,
          created_by: context.userId,
        }));
      if (rows.length) {
        await db.from("monitoring_watchlist").insert(rows);
        pagesAdded = rows.length;
      }
    }

    return { keywordsAdded: fresh.length, pagesAdded };
  });

/** Lets someone finish later; the flow stops nagging until they reopen it. */
export const skipSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ onboarding_skipped_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
