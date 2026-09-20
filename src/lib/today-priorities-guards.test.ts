import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("today_priorities RLS is workspace AND owner scoped", () => {
  const migration = read("supabase/migrations/20260920160000_today_priorities.sql");

  it("enables RLS", () => {
    expect(migration).toMatch(/ALTER TABLE public\.today_priorities ENABLE ROW LEVEL SECURITY/);
  });

  it("requires both workspace access and matching auth.uid() on both USING and WITH CHECK", () => {
    const policySection = migration.slice(
      migration.indexOf("CREATE POLICY today_priorities_owner_access"),
    );
    expect(policySection).toMatch(
      /USING \(private\.can_access_workspace\(workspace_id\) AND user_id = auth\.uid\(\)\)/,
    );
    expect(policySection).toMatch(
      /WITH CHECK \(private\.can_access_workspace\(workspace_id\) AND user_id = auth\.uid\(\)\)/,
    );
  });
});

describe("today-priorities.functions.ts scopes every write to the caller", () => {
  const source = read("src/lib/today-priorities.functions.ts");

  for (const fn of ["deferPriority", "reactivatePriority", "completePriority", "deletePriority"]) {
    it(`${fn} filters by both id and the caller's own user_id`, () => {
      const fnBody = source.slice(source.indexOf(`export const ${fn}`));
      const nextExport = fnBody.indexOf("\nexport const", 1);
      const scoped = nextExport === -1 ? fnBody : fnBody.slice(0, nextExport);
      expect(scoped).toMatch(/\.eq\("id",\s*data\.id\)/);
      expect(scoped).toMatch(/\.eq\("user_id",\s*context\.userId\)/);
    });
  }

  it("reorderPriorities scopes every update by user_id, not just id", () => {
    const fnBody = source.slice(source.indexOf("export const reorderPriorities"));
    expect(fnBody).toMatch(/\.eq\("user_id",\s*context\.userId\)/);
  });
});

describe("Today's completed-today filtering is a real UTC-day boundary, not string matching", () => {
  const source = read("src/routes/_authenticated/today.tsx");

  it("isToday compares actual UTC date components", () => {
    const fnBody = source.slice(
      source.indexOf("function isToday"),
      source.indexOf("function decisionStatusTone"),
    );
    expect(fnBody).toMatch(/getUTCFullYear\(\)/);
    expect(fnBody).toMatch(/getUTCMonth\(\)/);
    expect(fnBody).toMatch(/getUTCDate\(\)/);
  });
});
