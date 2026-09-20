import { describe, expect, it } from "vitest";
import { GROUP_EXTRA_PREFIXES, isSectionActive } from "./navigation";

describe("isSectionActive", () => {
  it("matches a top-level page in the section", () => {
    expect(isSectionActive("/mentions", ["/overview", "/mentions"])).toBe(true);
  });

  it("does not match a page outside the section", () => {
    expect(isSectionActive("/reports", ["/overview", "/mentions"])).toBe(false);
  });

  it("matches a nested route under a section prefix (e.g. campaign creation)", () => {
    expect(isSectionActive("/campaign/post", ["/campaign-manager", "/campaign"])).toBe(true);
  });

  it("returns false for an empty prefix list", () => {
    expect(isSectionActive("/mentions", [])).toBe(false);
  });
});

describe("GROUP_EXTRA_PREFIXES", () => {
  it("routes campaign creation (/publish, /campaign/$action) into the Campaigns section", () => {
    const prefixes = ["/campaign-manager", "/campaign-calendar", ...GROUP_EXTRA_PREFIXES.campaigns];
    expect(isSectionActive("/publish", prefixes)).toBe(true);
    expect(isSectionActive("/campaign/post", prefixes)).toBe(true);
    expect(isSectionActive("/campaign/reply", prefixes)).toBe(true);
  });

  it("routes Response Studio's thread/recommendation detail views into the Studio section", () => {
    const prefixes = ["/new", "/compare", "/archive", ...GROUP_EXTRA_PREFIXES.studio];
    expect(isSectionActive("/chat/abc123", prefixes)).toBe(true);
    expect(isSectionActive("/recommendations/abc123", prefixes)).toBe(true);
  });

  it("never lets Studio's extra prefixes leak into an unrelated section", () => {
    expect(isSectionActive("/chat/abc123", ["/overview", "/mentions"])).toBe(false);
  });
});
