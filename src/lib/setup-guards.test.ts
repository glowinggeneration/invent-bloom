import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Onboarding lands a new customer on Today, not the raw Mentions feed", () => {
  const source = read("src/routes/_authenticated/setup.tsx");

  it("has no remaining redirect to /mentions as a completion/skip/already-done destination", () => {
    expect(source).not.toMatch(/navigate\(\{ to: "\/mentions"/);
  });

  it("finish, skip, and the already-done guard all redirect to /today", () => {
    const matches = source.match(/navigate\(\{ to: "\/today", replace: true \}\)/g) ?? [];
    expect(matches.length).toBe(3);
  });
});
