import { afterEach, describe, expect, it } from "vitest";
import { defineFlags, isEnabled } from "./feature-flags";

const FLAGS = defineFlags({
  new_composer: { default: false },
  legacy_export: { default: true },
});

describe("isEnabled", () => {
  afterEach(() => {
    delete process.env["FLAG_NEW_COMPOSER"];
    delete process.env["FLAG_LEGACY_EXPORT"];
  });

  it("falls back to the flag's default with no overrides", () => {
    expect(isEnabled(FLAGS.new_composer)).toBe(false);
    expect(isEnabled(FLAGS.legacy_export)).toBe(true);
  });

  it("lets an environment variable override the default", () => {
    process.env["FLAG_NEW_COMPOSER"] = "true";
    expect(isEnabled(FLAGS.new_composer)).toBe(true);
  });

  it("prefers a per-context override over the environment and default", () => {
    process.env["FLAG_NEW_COMPOSER"] = "true";
    const flag = defineFlags({
      new_composer: { default: false, override: (ctx) => (ctx.org === "beta" ? true : undefined) },
    }).new_composer;

    expect(isEnabled(flag, { org: "other" })).toBe(true); // falls through to env override
    expect(isEnabled(flag, { org: "beta" })).toBe(true); // explicit override
  });
});
