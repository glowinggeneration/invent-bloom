import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("buildPersonaVariations now records every gateway call, success or failure", () => {
  const source = read("src/lib/variations.server.ts");

  it("records a success event with token usage after a successful gateway call", () => {
    const successBody = source.slice(
      source.indexOf("const payload = (await response.json())"),
      source.indexOf("const raw = (payload"),
    );
    expect(successBody).toMatch(/recordVariationsEvent\(\{/);
    expect(successBody).toMatch(/outcome: "success"/);
    expect(successBody).toMatch(/usage: payload\.usage/);
  });

  it("records a failure event on a non-ok gateway response", () => {
    const failureBody = source.slice(
      source.indexOf("if (!response.ok) {"),
      source.indexOf("const payload = (await response.json())"),
    );
    expect(failureBody).toMatch(/recordVariationsEvent\(\{/);
    expect(failureBody).toMatch(/outcome: "failure"/);
  });

  it("records a failure event on a thrown/network error too, in the catch block", () => {
    const catchBody = source.slice(source.lastIndexOf("} catch (e) {"));
    expect(catchBody).toMatch(/recordVariationsEvent\(\{/);
    expect(catchBody).toMatch(/outcome: "failure"/);
  });
});

describe("Spend limit is enforced before a preview generates variations, not inside the auto-fallback publish path", () => {
  const source = read("src/lib/publish.functions.ts");

  it("previewPersonaVariations checks the spend limit before calling buildPersonaVariations", () => {
    const fnBody = source.slice(
      source.indexOf("export const previewPersonaVariations"),
      source.indexOf("export const getTweetPreview"),
    );
    const checkIdx = fnBody.indexOf("checkSpendLimit(");
    const buildIdx = fnBody.indexOf("buildPersonaVariations({");
    expect(checkIdx).toBeGreaterThan(-1);
    expect(buildIdx).toBeGreaterThan(checkIdx);
  });

  it("runPublish's auto-fallback branch does NOT call checkSpendLimit (documented deliberately, to avoid orphaning a running publish_jobs row)", () => {
    const fnBody = source.slice(
      source.indexOf("} else if (data.varyByPersona) {"),
      source.indexOf("} else if (data.varyByPersona) {") + 800,
    );
    expect(fnBody).not.toMatch(/checkSpendLimit\(/);
    expect(fnBody).toMatch(/deliberately/);
  });
});
