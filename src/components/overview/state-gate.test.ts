import { describe, expect, it } from "vitest";
import { deriveOverviewMode, type SourceHealth } from "./state-gate";

const readySource: SourceHealth = { id: "x", label: "X", status: "ready" };
const failedSource: SourceHealth = { id: "news", label: "News", status: "error" };

describe("deriveOverviewMode", () => {
  it("shows loading while the request is unresolved", () => {
    expect(
      deriveOverviewMode({
        loading: true,
        fatalQueryError: false,
        sourcesKnown: true,
        sources: [],
        empty: false,
      }),
    ).toBe("loading");
  });

  it("never treats a failed request as an empty result", () => {
    expect(
      deriveOverviewMode({
        loading: false,
        fatalQueryError: true,
        sourcesKnown: true,
        sources: [readySource],
        empty: false,
      }),
    ).toBe("connection-error");
  });

  it("renders empty-window only after a successful zero-result query with a ready source", () => {
    expect(
      deriveOverviewMode({
        loading: false,
        fatalQueryError: false,
        sourcesKnown: true,
        sources: [readySource],
        empty: true,
      }),
    ).toBe("empty-window");
  });

  it("renders no-sources when zero sources are configured", () => {
    expect(
      deriveOverviewMode({
        loading: false,
        fatalQueryError: false,
        sourcesKnown: true,
        sources: [],
        empty: false,
      }),
    ).toBe("no-sources");
  });

  it("renders connection-error when every configured source has failed", () => {
    expect(
      deriveOverviewMode({
        loading: false,
        fatalQueryError: false,
        sourcesKnown: true,
        sources: [failedSource],
        empty: false,
      }),
    ).toBe("connection-error");
  });

  it("renders partial and keeps valid data visible when one source fails but data exists", () => {
    expect(
      deriveOverviewMode({
        loading: false,
        fatalQueryError: false,
        sourcesKnown: true,
        sources: [readySource, failedSource],
        empty: false,
      }),
    ).toBe("partial");
  });

  it("renders ready when all sources are healthy and data exists", () => {
    expect(
      deriveOverviewMode({
        loading: false,
        fatalQueryError: false,
        sourcesKnown: true,
        sources: [readySource],
        empty: false,
      }),
    ).toBe("ready");
  });

  it("falls back to the main query result when source health isn't visible to this viewer", () => {
    expect(
      deriveOverviewMode({
        loading: false,
        fatalQueryError: false,
        sourcesKnown: false,
        sources: [],
        empty: true,
      }),
    ).toBe("empty-window");
    expect(
      deriveOverviewMode({
        loading: false,
        fatalQueryError: false,
        sourcesKnown: false,
        sources: [],
        empty: false,
      }),
    ).toBe("ready");
  });
});
