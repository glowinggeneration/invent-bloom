import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("draft_versions is append-only by construction", () => {
  const migration = read("supabase/migrations/20260920180000_draft_versions.sql");
  const source = read("src/lib/draft-versions.functions.ts");

  it("the migration grants no UPDATE or DELETE policy", () => {
    expect(migration).toMatch(/FOR SELECT TO authenticated/);
    expect(migration).toMatch(/FOR INSERT TO authenticated/);
    expect(migration).not.toMatch(/FOR (UPDATE|DELETE|ALL)/);
  });

  it("draft-versions.functions.ts exports no update/delete server function", () => {
    expect(source).not.toMatch(/export const (update|delete)DraftVersion/);
  });

  it("saveDraftVersion always inserts, never updates an existing row", () => {
    const fnBody = source.slice(source.indexOf("export const saveDraftVersion"));
    expect(fnBody).toMatch(/\.insert\(/);
    expect(fnBody).not.toMatch(/\.update\(/);
  });
});

describe("saveDraftVersion verifies the thread's workspace before attaching a version", () => {
  const source = read("src/lib/draft-versions.functions.ts");

  it("checks thread.workspace_id against the caller's resolved workspace", () => {
    const fnBody = source.slice(source.indexOf("export const saveDraftVersion"));
    expect(fnBody).toMatch(/thread\.workspace_id\s*!==\s*workspaceId/);
  });
});
