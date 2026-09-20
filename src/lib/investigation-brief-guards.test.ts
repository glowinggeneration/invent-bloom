import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("generateInvestigationBrief only keeps facts citing real evidence", () => {
  const source = read("src/lib/investigation-brief.functions.ts");

  it("builds evidenceKeys from the actual supplied evidence set", () => {
    expect(source).toMatch(/const evidenceKeys = new Set\(evidence\.map\(\(e\) => e\.key\)\)/);
  });

  it("filters each fact's cited keys against that set before keeping it", () => {
    const fnBody = source.slice(source.indexOf("const observedFacts:"));
    expect(fnBody).toMatch(/evidenceKeys\.has\(k\)/);
    expect(fnBody).toMatch(/f\.evidenceKeys\.length > 0/);
  });

  it("explicitly forbids a confidence score in the prompt and never parses one from the response", () => {
    expect(source).toMatch(/Never output a confidence score/i);
    expect(source).not.toMatch(/parsed\.confidence/);
    expect(source).not.toMatch(/"confidence":/);
  });
});

describe("deterministicGaps is computed from evidence, not the model", () => {
  const source = read("src/lib/investigation-brief.functions.ts");

  it("flags zero evidence, missing news coverage, and stale sources without AI involvement", () => {
    const fnBody = source.slice(
      source.indexOf("function deterministicGaps"),
      source.indexOf("const SYSTEM_PROMPT"),
    );
    expect(fnBody).toMatch(/No supporting material was found/);
    expect(fnBody).toMatch(/No news coverage found/);
    expect(fnBody).toMatch(/hoursOld > STALE_HOURS/);
  });

  it("is called with the evidence array before any gateway call, and its result is always included", () => {
    const fnBody = source.slice(source.indexOf("export const generateInvestigationBrief"));
    expect(fnBody).toMatch(/const gaps = deterministicGaps\(evidence\)/);
    expect(fnBody).toMatch(/coverageGaps: gaps/);
  });
});

describe("saved investigation briefs use a concrete, serialisable type", () => {
  const source = read("src/lib/projects.functions.ts");

  it("SavedInvestigationBrief has no Record<string, unknown> or unknown[] fields", () => {
    const typeBody = source.slice(
      source.indexOf("export type SavedInvestigationBrief"),
      source.indexOf("export type SavedEvidenceRef"),
    );
    expect(typeBody).not.toMatch(/Record<string,\s*unknown>/);
    expect(typeBody).not.toMatch(/unknown\[\]/);
  });
});
