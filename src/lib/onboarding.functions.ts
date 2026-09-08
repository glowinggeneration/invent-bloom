import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { EMPTY_SOCIALS, cleanHandle, type SetupStatus } from "./onboarding";
import { LEGACY_SINGLE_WORKSPACE_ID } from "./workspace.server";

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
  brandName: z.string().trim().max(120).default(""),
  brandHandle: z.string().trim().max(60).default(""),
  keyFigures: z.array(z.string().trim().min(2).max(80)).max(10).default([]),
  keywords: z.array(z.string().trim().min(2).max(80)).min(1).max(25),
  socials: socialsSchema.default(EMPTY_SOCIALS),
});

/** Current setup answers plus whether the guided flow still needs running. */
export const getSetupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SetupStatus> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("full_name, job_title, team, phone, onboarding_completed_at, onboarding_skipped_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { getWorkspaceSettings } = await import("./entity-config.server");
    const settings = await getWorkspaceSettings();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: keywordRows } = await db
      .from("mention_keywords")
      .select("term")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(40);

    const { data: watchRows } = await db
      .from("monitoring_watchlist")
      .select("platform, value")
      .eq("kind", "account")
      .eq("is_active", true)
      .limit(60);

    const socials = { ...EMPTY_SOCIALS };
    for (const row of (watchRows ?? []) as { platform: string | null; value: string }[]) {
      const key = String(row.platform ?? "").toLowerCase();
      if (key in socials && !socials[key as keyof typeof socials]) {
        socials[key as keyof typeof socials] = row.value;
      }
    }

    return {
      needsSetup: !data?.onboarding_completed_at && !data?.onboarding_skipped_at,
      fullName: data?.full_name ?? "",
      jobTitle: data?.job_title ?? "",
      team: data?.team ?? "",
      phone: data?.phone ?? "",
      brandName: settings.orgName,
      brandHandle: settings.orgHandle,
      keyFigures: settings.keyFigures,
      keywords: ((keywordRows ?? []) as { term: string }[]).map((r) => r.term).filter(Boolean),
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
        onboarding_completed_at: new Date().toISOString(),
        onboarding_skipped_at: null,
      })
      .eq("id", context.userId);
    if (profileError) throw new Error(profileError.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    // Organisation identity and key figures are workspace-wide, not per-user -
    // every team member's setup writes into the same shared row, same as the
    // shared mention_keywords/monitoring_watchlist writes below.
    // TODO(Phase 3): thread the caller's real workspaceId here instead of
    // the LEGACY_SINGLE_WORKSPACE_ID stopgap - see workspace.server.ts.
    const { error: settingsError } = await db
      .from("workspace_settings")
      .update({
        org_name: data.brandName,
        org_handle: brandHandle,
        key_figures: data.keyFigures,
        updated_by: context.userId,
      })
      .eq("workspace_id", LEGACY_SINGLE_WORKSPACE_ID);
    if (settingsError) throw new Error(settingsError.message);

    // Monitoring keywords — the listening pipeline reads this list every run.
    const { data: existingKeywords } = await db.from("mention_keywords").select("term");
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
          term,
          source: "setup",
          is_active: true,
          last_refreshed_at: new Date().toISOString(),
        })),
      );
    }

    // Optional accounts to watch, including the brand's own X handle.
    const accounts: { platform: string; value: string; label: string }[] = [];
    if (brandHandle) {
      accounts.push({
        platform: "x",
        value: brandHandle,
        label: data.brandName || `@${brandHandle}`,
      });
    }
    for (const [platform, raw] of Object.entries(data.socials)) {
      const value = cleanHandle(String(raw ?? ""));
      if (value)
        accounts.push({ platform, value, label: `${data.brandName || value} (${platform})` });
    }

    let pagesAdded = 0;
    if (accounts.length) {
      const { data: existingWatch } = await db
        .from("monitoring_watchlist")
        .select("platform, value");
      const seen = new Set(
        ((existingWatch ?? []) as { platform: string | null; value: string }[]).map(
          (r) => `${String(r.platform ?? "").toLowerCase()}:${r.value.trim().toLowerCase()}`,
        ),
      );
      const rows = accounts
        .filter((a) => !seen.has(`${a.platform}:${a.value.toLowerCase()}`))
        .map((a) => ({
          kind: "account",
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
