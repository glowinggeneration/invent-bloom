import { describe, expect, it } from "vitest";
import { LEGACY_SINGLE_WORKSPACE_ID, resolveWorkspaceId } from "./workspace.server";

/**
 * A minimal fake of the Supabase query-builder chain resolveWorkspaceId()
 * uses: .from(table).select(cols).eq(col, value).limit(n).maybeSingle().
 * Backed by an in-memory `workspace_members` table so these tests exercise
 * the real query shape (which column it filters on, what a miss returns)
 * without needing a live database.
 */
function fakeSupabase(
  rows: { user_id: string; workspace_id: string }[],
  opts?: { error?: string },
) {
  return {
    from(table: string) {
      if (table !== "workspace_members") throw new Error(`Unexpected table: ${table}`);
      let filterUserId: string | undefined;
      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => {
          if (column !== "user_id") throw new Error(`Unexpected filter column: ${column}`);
          filterUserId = value;
          return builder;
        },
        limit: () => builder,
        maybeSingle: async () => {
          if (opts?.error) return { data: null, error: { message: opts.error } };
          const match = rows.find((r) => r.user_id === filterUserId);
          return { data: match ? { workspace_id: match.workspace_id } : null, error: null };
        },
      };
      return builder;
    },
  };
}

describe("resolveWorkspaceId", () => {
  it("resolves the caller's own workspace", async () => {
    const supabase = fakeSupabase([
      { user_id: "user-a", workspace_id: "workspace-a" },
      { user_id: "user-b", workspace_id: "workspace-b" },
    ]);
    await expect(resolveWorkspaceId({ userId: "user-a", supabase: supabase as any })).resolves.toBe(
      "workspace-a",
    );
  });

  it("never cross-resolves one caller to a different caller's workspace", async () => {
    const supabase = fakeSupabase([
      { user_id: "user-a", workspace_id: "workspace-a" },
      { user_id: "user-b", workspace_id: "workspace-b" },
      { user_id: "user-c", workspace_id: "workspace-c" },
    ]);
    const [a, b, c] = await Promise.all([
      resolveWorkspaceId({ userId: "user-a", supabase: supabase as any }),
      resolveWorkspaceId({ userId: "user-b", supabase: supabase as any }),
      resolveWorkspaceId({ userId: "user-c", supabase: supabase as any }),
    ]);
    expect(a).toBe("workspace-a");
    expect(b).toBe("workspace-b");
    expect(c).toBe("workspace-c");
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("fails closed when the caller has no membership row, rather than defaulting to any workspace", async () => {
    const supabase = fakeSupabase([{ user_id: "user-a", workspace_id: "workspace-a" }]);
    await expect(
      resolveWorkspaceId({ userId: "stranger", supabase: supabase as any }),
    ).rejects.toThrow(/no workspace/i);
  });

  it("never silently falls back to the legacy single-tenant workspace on a miss", async () => {
    const supabase = fakeSupabase([]);
    let resolved: string | null = null;
    try {
      resolved = await resolveWorkspaceId({ userId: "user-a", supabase: supabase as any });
    } catch {
      // expected
    }
    expect(resolved).not.toBe(LEGACY_SINGLE_WORKSPACE_ID);
    expect(resolved).toBeNull();
  });

  it("propagates a query error instead of resolving to a workspace", async () => {
    const supabase = fakeSupabase([], { error: "connection reset" });
    await expect(
      resolveWorkspaceId({ userId: "user-a", supabase: supabase as any }),
    ).rejects.toThrow(/connection reset/);
  });
});
