import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("product_events RLS", () => {
  const migration = read("supabase/migrations/20260920150000_product_events.sql");

  it("enables RLS and scopes reads to the caller's workspace", () => {
    expect(migration).toMatch(/ALTER TABLE public\.product_events ENABLE ROW LEVEL SECURITY/);
    expect(migration).toMatch(/private\.can_access_workspace\(workspace_id\)/);
  });

  it("does not grant a client-facing INSERT/UPDATE/DELETE policy", () => {
    // Only a SELECT policy should exist - writes go through supabaseAdmin
    // (service role) from growth-events.server.ts, never the RLS-scoped
    // client, so a workspace member can never forge or inflate an event.
    expect(migration).toMatch(/FOR SELECT TO authenticated/);
    expect(migration).not.toMatch(/FOR (ALL|INSERT|UPDATE|DELETE)/);
  });
});

describe("trackEvent truncates string properties so content can't leak in", () => {
  const source = read("src/lib/growth-events.server.ts");

  it("caps string property length", () => {
    expect(source).toMatch(/value\.slice\(0,\s*MAX_LABEL_LENGTH\)/);
  });

  it("writes through supabaseAdmin, not the caller's RLS-scoped client", () => {
    expect(source).toMatch(/supabaseAdmin/);
  });

  it("never throws out of trackEvent - a logging failure can't break the caller", () => {
    const fnBody = source.slice(source.indexOf("export async function trackEvent"));
    expect(fnBody).toMatch(/try\s*{/);
    expect(fnBody).toMatch(/catch\s*\(err\)/);
  });
});
