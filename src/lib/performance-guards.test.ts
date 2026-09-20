import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Performance CSV export matches the on-screen filters", () => {
  const source = read("src/routes/_authenticated/performance.tsx");

  it("handleExportCsv exports filteredRows (search/activity/tone applied), not the raw campaign-scoped data", () => {
    const fnBody = source.slice(
      source.indexOf("function handleExportCsv"),
      source.indexOf("const pageTabs ="),
    );
    expect(fnBody).toMatch(/rows:\s*filteredRows/);
  });

  it("filteredRows has no display cap, unlike the on-screen `rows`", () => {
    const start = source.indexOf("const filteredRows = useMemo(");
    const end = source.indexOf("const rows = useMemo(", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(source.slice(start, end)).not.toMatch(/\.slice\(0,\s*100\)/);
  });
});

describe("Performance source-coverage reconciliation is workspace-scoped", () => {
  const source = read("src/lib/performance.functions.ts");

  it("counts scheduled_actions filtered to this workspace's successful, dispatched posts", () => {
    const fnBody = source.slice(source.indexOf("scheduled_actions"));
    expect(fnBody).toMatch(/\.eq\("workspace_id", workspaceId\)/);
    expect(fnBody).toMatch(/\.eq\("status", "success"\)/);
    expect(fnBody).toMatch(/\.not\("result_tweet_id", "is", null\)/);
  });
});
