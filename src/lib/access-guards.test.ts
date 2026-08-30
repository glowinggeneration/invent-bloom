import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

/**
 * Server functions that expose linked X account data must be guarded with
 * assertAdmin. These are source-level guard tests: they fail loudly if a new
 * handler is added without the admin check.
 */
describe("linked X account server functions are admin-guarded", () => {
  const files = [
    "src/lib/publish.functions.ts",
    "src/lib/persona-images.functions.ts",
    "src/lib/account-images.functions.ts",
  ];

  for (const file of files) {
    it(`${file} imports assertAdmin`, () => {
      expect(read(file)).toMatch(/assertAdmin/);
    });
  }

  const MANAGEMENT_FNS = [
    "syncAccountHandles",
    "saveXAccount",
    "loginAndAddXAccount",
    "bulkLoginXAccounts",
    "deleteXAccount",
    "renameXAccounts",
  ];

  it("account management handlers stay admin-guarded", () => {
    const source = read("src/lib/publish.functions.ts");
    const blocks = source.split(/export const /).slice(1);
    const offenders = MANAGEMENT_FNS.filter((name) => {
      const block = blocks.find((b) => b.startsWith(name));
      return !block || !block.includes("assertAdmin");
    });

    expect(offenders).toEqual([]);
  });

  it("persona reads and campaign runs are open to every signed-in user", () => {
    const source = read("src/lib/publish.functions.ts");
    const blocks = source.split(/export const /).slice(1);
    for (const name of ["listXAccounts", "runPublish", "previewPersonaVariations"]) {
      const block = blocks.find((b) => b.startsWith(name));
      expect(block).toBeTruthy();
      expect(block).not.toMatch(/assertAdmin/);
    }
    expect(read("src/lib/campaigns.functions.ts")).not.toMatch(/assertAdmin/);
  });
});

describe("UI restrictions", () => {
  it("campaigns workspace is open to every signed-in user", () => {
    const source = read("src/routes/_authenticated/campaigns.tsx");
    expect(source).not.toMatch(/LockScreen/);
  });

  it("linked accounts page renders a lock state for non-admins", () => {
    const source = read("src/routes/_authenticated/admin.accounts.tsx");
    expect(source).toMatch(/isAdminEmail/);
    expect(source).toMatch(/!isAdmin/);
    expect(source).toMatch(/LockScreen/);
  });

  it("performance page renders a lock state for non-admins", () => {
    const source = read("src/routes/_authenticated/performance.tsx");
    expect(source).toMatch(/isAdminEmail/);
    expect(source).toMatch(/!isAdmin/);
    expect(source).toMatch(/LockScreen/);
  });

  it("sidebar only links admin destinations for the admin account", () => {
    const source = read("src/components/workspace-shell.tsx");
    expect(source).toMatch(/isAdminEmail\(profile\?\.email\)/);
  });

  it("personas page is visible to every signed-in user", () => {
    const source = read("src/routes/_authenticated/personas.tsx");
    // artwork sync notice stays admin-only
    expect(source).toMatch(/isAdminEmail\(profile\?\.email\)/);
  });
});
