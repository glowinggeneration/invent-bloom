import { describe, expect, it } from "vitest";
import { ADMIN_EMAIL, assertAdmin, isAdminEmail } from "./access";

const NON_ADMIN = "jordan.smith@example.org";

describe("isAdminEmail", () => {
  it("accepts the admin account", () => {
    expect(isAdminEmail(ADMIN_EMAIL)).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isAdminEmail("  LediMothabo@Gmail.com ")).toBe(true);
  });

  it("rejects other users and missing values", () => {
    expect(isAdminEmail(NON_ADMIN)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it("rejects lookalike addresses", () => {
    expect(isAdminEmail("ledimothabo@gmail.com.attacker.io")).toBe(false);
    expect(isAdminEmail("x+ledimothabo@gmail.com")).toBe(false);
  });
});

describe("assertAdmin", () => {
  it("passes for the admin claim", () => {
    expect(() => assertAdmin({ claims: { email: ADMIN_EMAIL } })).not.toThrow();
  });

  it("throws for non-admin, missing, or malformed claims", () => {
    expect(() => assertAdmin({ claims: { email: NON_ADMIN } })).toThrow(/admin only/i);
    expect(() => assertAdmin({ claims: {} })).toThrow(/admin only/i);
    expect(() => assertAdmin({})).toThrow(/admin only/i);
    expect(() => assertAdmin({ claims: { email: 123 } as never })).toThrow(/admin only/i);
  });
});
