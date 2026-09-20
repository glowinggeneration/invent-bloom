import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

/**
 * linkItemToProject is the one place a cross-workspace link could slip
 * through RLS's normal guarantees (the FK on project_id only checks the
 * projects row exists somewhere, not that it's in the caller's workspace).
 * This is a source-level guard: it fails loudly if that explicit check
 * (and its resolveWorkspaceId call) is ever removed.
 */
describe("linkItemToProject enforces same-workspace linking", () => {
  const source = read("src/lib/projects.functions.ts");

  it("resolves the caller's own workspace before linking", () => {
    const fnBody = source.slice(
      source.indexOf("export const linkItemToProject"),
      source.indexOf("const unlinkItemSchema"),
    );
    expect(fnBody).toMatch(/resolveWorkspaceId\(context\)/);
  });

  it("rejects a target project that isn't in the caller's workspace", () => {
    const fnBody = source.slice(
      source.indexOf("export const linkItemToProject"),
      source.indexOf("const unlinkItemSchema"),
    );
    expect(fnBody).toMatch(/project\.workspace_id\s*!==\s*workspaceId/);
  });
});

describe("every projects table gets a workspace-scoped RLS policy", () => {
  const migration = read("supabase/migrations/20260920120000_projects.sql");

  for (const table of ["projects", "project_references", "investigations"]) {
    it(`${table} has RLS enabled and a can_access_workspace policy`, () => {
      expect(migration).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
      );
      const tableSection = migration.slice(migration.indexOf(`CREATE TABLE public.${table}`));
      const nextTableIdx = tableSection.indexOf("CREATE TABLE public.", 1);
      const scoped = nextTableIdx === -1 ? tableSection : tableSection.slice(0, nextTableIdx);
      expect(scoped).toMatch(/private\.can_access_workspace\(workspace_id\)/);
    });
  }

  it("every linkable table's new project_id column allows ON DELETE SET NULL, never CASCADE", () => {
    const additions = migration.slice(migration.indexOf("ALTER TABLE public.threads"));
    const projectIdLines =
      additions.match(/project_id uuid REFERENCES public\.projects\(id\)[^;]*/g) ?? [];
    expect(projectIdLines.length).toBeGreaterThanOrEqual(5);
    for (const line of projectIdLines) {
      expect(line).toMatch(/ON DELETE SET NULL/);
      expect(line).not.toMatch(/ON DELETE CASCADE/);
    }
  });
});
