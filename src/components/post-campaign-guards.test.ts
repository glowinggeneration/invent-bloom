import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("post-campaign inline field errors stay wired to blockStep", () => {
  const source = read("src/components/post-campaign.tsx");

  it("blockStep sets fieldErrors, not just the toast/banner", () => {
    const fnBody = source.slice(
      source.indexOf("const blockStep ="),
      source.indexOf("const runPreview ="),
    );
    expect(fnBody).toMatch(/setFieldErrors\(\(prev\) => \(\{ \.\.\.prev, \[id\]: message \}\)\)/);
    expect(fnBody).toMatch(/toast\.error\(message\)/);
  });

  it("every successful-validation path clears fieldErrors alongside error", () => {
    const setErrorNullCount = (source.match(/setError\(null\);/g) ?? []).length;
    const setFieldErrorsEmptyCount = (source.match(/setFieldErrors\(\{\}\);/g) ?? []).length;
    expect(setFieldErrorsEmptyCount).toBe(setErrorNullCount);
  });

  it("the campaign-name and message fields render an aria-describedby error and clear on edit", () => {
    expect(source).toMatch(/aria-describedby=\{\s*fieldErrors\["post-campaign-name"\]/);
    expect(source).toMatch(/aria-describedby=\{fieldErrors\["post-details"\]/);
    expect(source).toMatch(/clearFieldError\("post-campaign-name"\)/);
    expect(source).toMatch(/clearFieldError\("post-details"\)/);
  });

  it("persona selection clears its field error via an effect, not by editing PersonaPicker itself", () => {
    expect(source).not.toMatch(/PersonaPicker[\s\S]{0,400}clearFieldError/);
    expect(source).toMatch(
      /if \(personas\.selected\.length > 0\) clearFieldError\("post-personas"\)/,
    );
  });
});
