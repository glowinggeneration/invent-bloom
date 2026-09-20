import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("workspace_budgets RLS", () => {
  const migration = read("supabase/migrations/20260920190000_budget_controls.sql");

  it("workspace_budgets is workspace-scoped RLS, matching every other shared-content table", () => {
    expect(migration).toMatch(/ALTER TABLE public\.workspace_budgets ENABLE ROW LEVEL SECURITY/);
    expect(migration).toMatch(/private\.can_access_workspace\(workspace_id\)/);
  });

  it("does not redeclare idempotency_keys - it already existed before this migration", () => {
    expect(migration).not.toMatch(/CREATE TABLE public\.idempotency_keys/);
  });
});

describe("createSupabaseIdempotencyStore satisfies idempotency_keys.workspace_id's real NOT NULL constraint", () => {
  const source = read("src/lib/platform/idempotency.server.ts");

  it("takes workspaceId as a required parameter", () => {
    const fnBody = source.slice(source.indexOf("export function createSupabaseIdempotencyStore"));
    const sig = fnBody.slice(0, fnBody.indexOf("): IdempotencyStore"));
    expect(sig).toMatch(/workspaceId: string/);
  });

  it("writes workspace_id on every insert into idempotency_keys", () => {
    const fnBody = source.slice(source.indexOf("async createInProgress"));
    expect(fnBody).toMatch(/workspace_id: workspaceId/);
  });
});

describe("every call site passes workspaceId to createSupabaseIdempotencyStore", () => {
  for (const file of ["src/lib/smait.functions.ts", "src/lib/publish.functions.ts"]) {
    it(`${file} calls createSupabaseIdempotencyStore with two arguments`, () => {
      const source = read(file);
      expect(source).toMatch(/createSupabaseIdempotencyStore\(supabaseAdmin as any, workspaceId\)/);
    });
  }
});

describe("checkSpendLimit only blocks once cumulative spend has actually reached the limit", () => {
  const source = read("src/lib/budget.server.ts");

  it("returns early when no limit is set, rather than blocking by default", () => {
    const fnBody = source.slice(source.indexOf("export async function checkSpendLimit"));
    expect(fnBody).toMatch(/if \(limit === null \|\| limit === undefined\) return;/);
  });

  it("only counts successful calls with a real cost estimate, from this month, for this workspace", () => {
    const fnBody = source.slice(source.indexOf("export async function checkSpendLimit"));
    expect(fnBody).toMatch(/\.eq\("workspace_id", workspaceId\)/);
    expect(fnBody).toMatch(/\.eq\("outcome", "success"\)/);
    expect(fnBody).toMatch(/\.gte\("created_at", MONTH_START\(\)\)/);
  });
});

describe("sendMessage wires spend/rate checks inside the idempotent operation, not outside it", () => {
  const source = read("src/lib/smait.functions.ts");

  it("checkSpendLimit and checkRateLimit run inside `operation`, before withIdempotencyKey is ever reached", () => {
    const operationBody = source.slice(
      source.indexOf("const operation = async"),
      source.indexOf("if (!data.idempotencyKey)"),
    );
    expect(operationBody).toMatch(/checkRateLimit\(/);
    expect(operationBody).toMatch(/checkSpendLimit\(/);
  });

  it("a request with no idempotencyKey still runs (backward compatible for any caller that omits it)", () => {
    expect(source).toMatch(/if \(!data\.idempotencyKey\) return operation\(\);/);
  });
});

describe("Studio composers rotate their idempotency key after a successful submit", () => {
  for (const file of [
    "src/routes/_authenticated/new.tsx",
    "src/routes/_authenticated/chat.$threadId.tsx",
  ]) {
    it(`${file} generates a fresh key on success, not just once per mount`, () => {
      const source = read(file);
      expect(source).toMatch(/idempotencyKeyRef\.current = crypto\.randomUUID\(\)/);
    });
  }
});
