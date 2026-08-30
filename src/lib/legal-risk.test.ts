import { describe, expect, it } from "vitest";
import { assessLegalRisk, transformText } from "./legal-risk";

describe("legal-risk transformation engine", () => {
  it("leaves ordinary football reaction untouched", () => {
    const rec = transformText("That second half was painful, but the boys fought hard.");
    expect(rec.riskLevel).toBe(0);
    expect(rec.revisedText).toBe(rec.originalText);
    expect(rec.autoPublishAllowed).toBe(true);
  });

  it("turns a guilt conclusion into procedural language", () => {
    const rec = transformText("He stole the sponsorship money.");
    expect(rec.riskLevel).toBeGreaterThanOrEqual(3);
    expect(rec.revisedText).not.toMatch(/stole/i);
    expect(rec.revisedText).toMatch(/concerns|records|reviewed/i);
    expect(rec.approvalRequired).toBe("senior_reviewer");
    expect(rec.factsChanged).toBe(false);
  });

  it("keeps lawful criticism strong instead of deleting it", () => {
    const rec = transformText("These officials are idiots and everyone knows it.");
    expect(rec.revisedText.length).toBeGreaterThan(20);
    expect(rec.revisedText).toMatch(/standard supporters expected|concerns/i);
  });

  it("flags indirect Sheng threats as critical and refuses a publishable version", () => {
    const rec = transformText("Tutakupata, hii haitakuishia poa.");
    expect(rec.riskLevel).toBe(4);
    expect(rec.revisedText).toBe("");
    expect(rec.autoPublishAllowed).toBe(false);
    expect(rec.approvalRequired).toBe("legal");
  });

  it("treats personal data as a privacy risk", () => {
    const { categories } = assessLegalRisk("Call him on 0712 345 678 if you want answers.");
    expect(categories).toContain("privacy");
  });

  it("does not accept 'allegedly' as a defence", () => {
    const { findings } = assessLegalRisk("He allegedly stole all the funds.");
    expect(findings.some((f) => /allegedly/i.test(f.segment))).toBe(true);
  });

  it("never allows automatic publication above moderate risk", () => {
    for (const text of [
      "He is corrupt.",
      "The chairman rigged the election.",
      "Everyone should go to his office tomorrow.",
    ]) {
      expect(transformText(text).autoPublishAllowed).toBe(false);
    }
  });
});
