import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("getActiveKnowledgeEntries only ever returns approved, current entries", () => {
  const source = read("src/lib/knowledge.server.ts");

  it("filters to approval_status = approved", () => {
    expect(source).toMatch(/\.eq\("approval_status",\s*"approved"\)/);
  });

  it("excludes entries past their expiry date", () => {
    expect(source).toMatch(/expiry_date\.gte\.\$\{today\}/);
  });
});

describe("knowledge conflict ids from the model are checked against real entries", () => {
  const source = read("src/lib/smait.server.ts");

  it("looks up every claimed conflict id in the entries actually supplied as context", () => {
    const fnBody = source.slice(
      source.indexOf("const knowledgeConflicts ="),
      source.indexOf("const knowledgeConflicts =") + 800,
    );
    expect(fnBody).toMatch(/knowledgeById\.get\(/);
    expect(fnBody).toMatch(/if \(!entry\) return null;/);
  });
});

describe("every knowledge table gets a workspace-scoped RLS policy", () => {
  const migration = read("supabase/migrations/20260920140000_knowledge_library.sql");

  for (const table of ["knowledge_entries", "knowledge_entry_versions"]) {
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
});

describe("createKnowledgeEntry and deleteKnowledgeEntry enforce their stated invariants", () => {
  const source = read("src/lib/knowledge.functions.ts");

  it("createKnowledgeEntry checks the target project's workspace before attaching an entry", () => {
    const fnBody = source.slice(
      source.indexOf("export const createKnowledgeEntry"),
      source.indexOf("const updateEntrySchema"),
    );
    expect(fnBody).toMatch(/project\.workspace_id\s*!==\s*workspaceId/);
  });

  it("deleteKnowledgeEntry can only remove pending or rejected entries, never approved/superseded", () => {
    const fnBody = source.slice(
      source.indexOf("export const deleteKnowledgeEntry"),
      source.indexOf("export const listKnowledgeEntryVersions"),
    );
    expect(fnBody).toMatch(/\.in\("approval_status",\s*\["pending",\s*"rejected"\]\)/);
  });

  it("updateKnowledgeEntry drops a substantively-edited entry back to pending review", () => {
    const fnBody = source.slice(
      source.indexOf("export const updateKnowledgeEntry"),
      source.indexOf("const statusSchema"),
    );
    expect(fnBody).toMatch(/patch\["approval_status"\]\s*=\s*"pending"/);
  });
});

describe("the approval trust boundary is enforced at the database layer, not just in application code", () => {
  const source = read("src/lib/knowledge.functions.ts");
  const migration = read(
    "supabase/migrations/20260920200000_knowledge_approval_trust_boundary.sql",
  );

  it("the trigger rejects a non-service-role change to approval_status unless it's a demotion to pending", () => {
    expect(migration).toMatch(/CREATE TRIGGER knowledge_entries_approval_admin_only/);
    expect(migration).toMatch(/auth\.role\(\) <> 'service_role'/);
    expect(migration).toMatch(/NEW\.approval_status <> 'pending'/);
  });

  it("the trigger rejects any non-service-role change to superseded_by, no exceptions", () => {
    expect(migration).toMatch(
      /NEW\.superseded_by IS DISTINCT FROM OLD\.superseded_by[\s\S]{0,80}RAISE EXCEPTION/,
    );
  });

  it("setKnowledgeApprovalStatus calls assertAdmin AND writes through the service-role client (context.supabase alone would now be rejected by the trigger)", () => {
    const fnBody = source.slice(
      source.indexOf("export const setKnowledgeApprovalStatus"),
      source.indexOf("const supersedeSchema"),
    );
    expect(fnBody).toMatch(/assertAdmin\(context as any\)/);
    expect(fnBody).toMatch(/supabaseAdmin as any/);
    expect(fnBody).not.toMatch(
      /context\.supabase as any\)\s*\n\s*\.from\("knowledge_entries"\)\s*\n\s*\.update/,
    );
  });

  it("supersedeKnowledgeEntry calls assertAdmin AND writes through the service-role client", () => {
    const fnBody = source.slice(source.indexOf("export const supersedeKnowledgeEntry"));
    expect(fnBody).toMatch(/assertAdmin\(context as any\)/);
    expect(fnBody).toMatch(/supabaseAdmin as any/);
  });

  it("updateKnowledgeEntry (member-open) only ever demotes approval_status to 'pending', never elevates it", () => {
    const fnBody = source.slice(
      source.indexOf("export const updateKnowledgeEntry"),
      source.indexOf("const statusSchema"),
    );
    expect(fnBody).toMatch(/patch\["approval_status"\]\s*=\s*"pending"/);
    expect(fnBody).not.toMatch(/approval_status"\]\s*=\s*"approved"/);
    expect(fnBody).not.toMatch(/superseded_by/);
  });

  it("drafting (create/update) stays open to any workspace member - only approval is restricted", () => {
    const createBody = source.slice(
      source.indexOf("export const createKnowledgeEntry"),
      source.indexOf("const updateEntrySchema"),
    );
    const updateBody = source.slice(
      source.indexOf("export const updateKnowledgeEntry"),
      source.indexOf("const statusSchema"),
    );
    expect(createBody).not.toMatch(/assertAdmin/);
    expect(updateBody).not.toMatch(/assertAdmin/);
  });
});

describe("Knowledge Library UI hides Approve/Reject from non-admins", () => {
  const source = read("src/routes/_authenticated/knowledge.tsx");

  it("checks isAdminEmail before rendering the approval controls", () => {
    expect(source).toMatch(/const isAdmin = isAdminEmail\(profile\?\.email\)/);
    expect(source).toMatch(/\{isAdmin \? \(/);
  });
});
