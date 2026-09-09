import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Analysis, ChatMessage } from "./analysis";
import type { Profile, ThreadListItem } from "./threads";

const BUCKET = "message-uploads";

const sendSchema = z.object({
  threadId: z.string().uuid().nullable(),
  text: z.string().min(1).max(4000),
  imageDataUrl: z.string().max(8_000_000).nullable().optional(),
  attachments: z
    .array(z.object({ name: z.string().max(200), excerpt: z.string().max(20_000) }))
    .max(5)
    .optional(),
});

export const getProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Profile> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, full_name, org")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Profile not found.");
    const { getWorkspaceSettings } = await import("./entity-config.server");
    const { resolveWorkspaceId } = await import("./workspace.server");
    const workspaceId = await resolveWorkspaceId(context);
    const settings = await getWorkspaceSettings(workspaceId);
    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      org: data.org === "team" ? "team" : "external",
      workspaceName: settings.orgName.trim() || "Team",
    };
  });

export const updateProfileName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ fullName: z.string().trim().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.fullName })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function nameMap(
  supabase: { from: (t: "profiles") => any },
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { id: string; full_name: string }[]) {
    map[row.id] = row.full_name;
  }
  return map;
}

export const listThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ scope: z.enum(["mine", "shared"]).default("mine") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ThreadListItem[]> => {
    let query = context.supabase
      .from("threads")
      .select("id, title, created_at, updated_at, visibility, pinned, user_id")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200);

    query =
      data.scope === "mine"
        ? query.eq("user_id", context.userId)
        : query.eq("visibility", "workspace").neq("user_id", context.userId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const names = await nameMap(context.supabase, [...new Set((rows ?? []).map((r) => r.user_id))]);

    const ids = (rows ?? []).map((r) => r.id);
    const confidence: Record<string, number> = {};
    const personas: Record<string, string[]> = {};
    const segments: Record<string, string[]> = {};
    const reaction: Record<string, "positive" | "neutral" | "negative"> = {};
    if (ids.length > 0) {
      const { data: analyses } = await context.supabase
        .from("messages")
        .select("thread_id, analysis, created_at")
        .in("thread_id", ids)
        .eq("role", "assistant")
        .order("created_at", { ascending: true });
      for (const row of analyses ?? []) {
        const analysis = row.analysis as {
          confidence?: number;
          sentiment?: { positive?: number; neutral?: number; negative?: number };
          personaReactions?: { name?: string; segment?: string }[];
        } | null;
        const value = analysis?.confidence;
        if (typeof value === "number") confidence[row.thread_id] = Math.round(value);
        const reactions = analysis?.personaReactions ?? [];
        if (reactions.length > 0) {
          personas[row.thread_id] = [
            ...new Set(reactions.map((r) => r.name ?? "").filter(Boolean)),
          ];
          segments[row.thread_id] = [
            ...new Set(reactions.map((r) => r.segment ?? "").filter(Boolean)),
          ];
        }
        const s = analysis?.sentiment;
        if (s) {
          const entries: ["positive" | "neutral" | "negative", number][] = [
            ["positive", s.positive ?? 0],
            ["neutral", s.neutral ?? 0],
            ["negative", s.negative ?? 0],
          ];
          entries.sort((a, b) => b[1] - a[1]);
          const top = entries[0];
          if (top) reaction[row.thread_id] = top[0];
        }
      }
    }

    return (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      visibility: r.visibility === "workspace" ? "workspace" : "private",
      pinned: r.pinned,
      isOwner: r.user_id === context.userId,
      ownerName: names[r.user_id] ?? "a teammate",
      confidence: confidence[r.id] ?? null,
      personas: personas[r.id] ?? [],
      segments: segments[r.id] ?? [],
      reaction: reaction[r.id] ?? null,
    }));
  });

export const getThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ thread: ThreadListItem; messages: ChatMessage[] } | null> => {
      const { data: thread } = await context.supabase
        .from("threads")
        .select("id, title, created_at, updated_at, visibility, pinned, user_id")
        .eq("id", data.threadId)
        .maybeSingle();
      if (!thread) return null;

      const { data: rows, error } = await context.supabase
        .from("messages")
        .select("id, role, content, image_url, analysis, created_at")
        .eq("thread_id", data.threadId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const messages: ChatMessage[] = [];
      for (const row of rows ?? []) {
        let imageUrl: string | null = null;
        if (row.image_url) {
          const { data: signed } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(row.image_url, 60 * 60);
          imageUrl = signed?.signedUrl ?? null;
        }
        messages.push({
          id: row.id,
          role: row.role as "user" | "assistant",
          content: row.content,
          imageUrl,
          analysis: (row.analysis as Analysis | null) ?? null,
          createdAt: row.created_at,
        });
      }

      const names = await nameMap(context.supabase, [thread.user_id]);

      return {
        thread: {
          id: thread.id,
          title: thread.title,
          createdAt: thread.created_at,
          updatedAt: thread.updated_at,
          visibility: thread.visibility === "workspace" ? "workspace" : "private",
          pinned: thread.pinned,
          isOwner: thread.user_id === context.userId,
          ownerName: names[thread.user_id] ?? "a teammate",
          confidence:
            messages
              .map((m) => m.analysis?.confidence)
              .filter((c): c is number => typeof c === "number")
              .at(-1) ?? null,
        },
        messages,
      };
    },
  );

export const updateThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        title: z.string().trim().min(1).max(120).optional(),
        visibility: z.enum(["private", "workspace"]).optional(),
        pinned: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: { title?: string; visibility?: string; pinned?: boolean } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.visibility !== undefined) patch.visibility = data.visibility;
    if (data.pinned !== undefined) patch.pinned = data.pinned;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("threads")
      .update(patch)
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .delete()
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ threadId: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runAnalysis, applyLegalReview } = await import("./smait.server");
    const { resolveWorkspaceId } = await import("./workspace.server");
    const supabase = context.supabase;
    const workspaceId = await resolveWorkspaceId(context);

    const { checkRateLimit, createSupabaseRateLimitStore, RATE_LIMIT_PRESETS } =
      await import("./platform/rate-limit.server");
    const rate = await checkRateLimit(createSupabaseRateLimitStore(supabaseAdmin as any), {
      bucketKey: `ai-generate:user:${context.userId}`,
      ...RATE_LIMIT_PRESETS.aiGenerate,
    });
    if (!rate.allowed) {
      throw new Error(
        "You're testing messages faster than we can process them. Wait a moment and try again.",
      );
    }

    let threadId = data.threadId;
    if (threadId) {
      const { data: existing } = await supabase
        .from("threads")
        .select("id")
        .eq("id", threadId)
        .maybeSingle();
      if (!existing) throw new Error("Test not found.");
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("org")
        .eq("id", context.userId)
        .maybeSingle();
      const title = data.text.slice(0, 60) + (data.text.length > 60 ? "…" : "");
      // Cast: the generated Supabase types don't know about workspace_id yet -
      // types are regenerated from the live schema, which this environment has
      // no credentials to reach.
      const { data: created, error } = await (supabase as any)
        .from("threads")
        .insert({
          user_id: context.userId,
          workspace_id: workspaceId,
          org: profile?.org ?? "external",
          title,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message ?? "Could not start a test.");
      threadId = created.id as string;
    }
    if (!threadId) throw new Error("Could not start a test.");

    let storagePath: string | null = null;
    if (data.imageDataUrl?.startsWith("data:")) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(data.imageDataUrl);
      if (match) {
        const mime = match[1] ?? "image/png";
        const bytes = Buffer.from(match[2] ?? "", "base64");
        const ext = mime.split("/")[1]?.split("+")[0] ?? "png";
        const path = `${threadId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType: mime, upsert: false });
        if (uploadError) console.error("[storage] upload failed", uploadError.message);
        else storagePath = path;
      }
    }

    const { error: userInsertError } = await supabase.from("messages").insert({
      thread_id: threadId,
      user_id: context.userId,
      role: "user",
      content: data.text,
      image_url: storagePath,
    });
    if (userInsertError) throw new Error(userInsertError.message);

    const { data: prior } = await supabase
      .from("messages")
      .select("role, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(12);

    const rawAnalysis = await runAnalysis({
      text: data.text,
      imageDataUrl: data.imageDataUrl ?? null,
      attachments: data.attachments ?? [],
      history: (prior ?? []).slice(0, -1).map((p) => ({
        role: p.role as "user" | "assistant",
        content: p.content,
      })),
      userId: context.userId,
      workspaceId,
    });

    // Legal-Risk Language Transformation Engine: rewrite risky wording in the
    // recommendations and record the verdict on the tested message.
    const analysis = await applyLegalReview(rawAnalysis, data.text);

    const { error: assistantInsertError } = await supabase.from("messages").insert({
      thread_id: threadId,
      user_id: context.userId,
      role: "assistant",
      content: analysis.summary,
      analysis: JSON.parse(JSON.stringify(analysis)),
    });
    if (assistantInsertError) throw new Error(assistantInsertError.message);

    await supabaseAdmin
      .from("threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId);

    return { threadId };
  });
