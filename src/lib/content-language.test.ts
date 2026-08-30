import { describe, expect, it } from "vitest";
import { containsChineseScript } from "./content-language";

describe("containsChineseScript", () => {
  it("detects Chinese characters in visible monitored text", () => {
    expect(containsChineseScript("Football Kenya Federation 最新消息")).toBe(true);
    expect(containsChineseScript(null, "肯尼亚足球")).toBe(true);
  });

  it("does not reject ordinary English, Kiswahili or Sheng text", () => {
    expect(containsChineseScript("FKF coach education is moving forward")).toBe(false);
    expect(containsChineseScript("Hongera Harambee Stars kwa ushindi")).toBe(false);
    expect(containsChineseScript("Hii fixture iko sawa bana")).toBe(false);
  });

  it("handles empty and missing parts safely", () => {
    expect(containsChineseScript()).toBe(false);
    expect(containsChineseScript("", null, undefined)).toBe(false);
  });
});
