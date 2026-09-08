import { describe, expect, it } from "vitest";
import { dedupeByStory, isSameStory, normalizeTitle } from "./news";

/**
 * Multi-source news dedupe. Google News and NewsData describe the same event
 * with different headlines and non-comparable links, so matching happens on the
 * headline. These cases are drawn from real collisions in a live feed.
 *
 * NEWS_ENTITIES ships empty by default (no hardcoded monitored subject), so
 * the entity-guard tests below pass their own fixture list explicitly
 * rather than relying on that shared production default.
 */
const TEST_ENTITIES = [
  "harambee stars",
  "harambee starlets",
  "gor mahia",
  "afc leopards",
  "tusker",
];

describe("isSameStory", () => {
  it("matches syndicated copies carrying aggregator boilerplate", () => {
    expect(
      isSameStory(
        "Gor Mahia out to end 41-year Kagame Cup jinx against Rayon Sports",
        "News Comments Gor Mahia out to end 41-year Kagame Cup jinx against Rayon Sports",
      ),
    ).toBe(true);
  });

  it("matches the same event reported under different headlines", () => {
    expect(
      isSameStory(
        "Rayon Sport end 28-year wait to win Cecafa Kagame Cup in Kigali",
        "Rayon Sports End 28-Year Wait for CECAFA Kagame Cup",
      ),
    ).toBe(true);
    expect(
      isSameStory(
        "Gor Mahia out to end 41-year Kagame Cup jinx against Rayon Sports",
        "Gor Mahia seek to end 41\u2011year regional cup drought against Rayon Sports",
      ),
    ).toBe(true);
    expect(
      isSameStory(
        "AFCON 2027 Jobs: Tanzania Counts 12 Sectors Beyond the Stadiums",
        "Beyond the stadiums: How AFCON 2027 can create jobs in Tanzania",
      ),
    ).toBe(true);
  });

  it("keeps different scorelines apart", () => {
    expect(
      isSameStory(
        "Gor Mahia beat AFC Leopards 2-0 in Mashemeji derby",
        "Gor Mahia beat AFC Leopards 3-1 in Mashemeji derby",
      ),
    ).toBe(false);
  });

  it("keeps Harambee Stars and Harambee Starlets apart", () => {
    expect(
      isSameStory(
        "Harambee Stars name squad for AFCON qualifier against Namibia",
        "Harambee Starlets name squad for WAFCON qualifier against Namibia",
        TEST_ENTITIES,
      ),
    ).toBe(false);
  });

  it("keeps identical wording about different clubs apart", () => {
    expect(
      isSameStory(
        "Tusker FC sign Ugandan striker on two-year deal",
        "AFC Leopards sign Ugandan striker on two-year deal",
        TEST_ENTITIES,
      ),
    ).toBe(false);
  });

  it("keeps a match preview apart from the match report", () => {
    expect(
      isSameStory(
        "CECAFA Kagame Cup: History on the line as Gor Mahia face Rayon Sports in final",
        "Rayon Sports sink Gor Mahia in extra time to lift CECAFA Kagame Cup",
      ),
    ).toBe(false);
  });

  it("does not merge unrelated stories that share only tournament vocabulary", () => {
    expect(
      isSameStory(
        "Confident Gor Mahia eye CECAFA Kagame Cup title as Rayon comes calling",
        "Will Gor Mahia end 41-year Cecafa Kagame Cup title drought?",
      ),
    ).toBe(false);
    expect(
      isSameStory(
        "Harambee Starlets: Beldine Odemba Reveals Game Plan for Must-Win WAFCON 2026 Clash Against Algeria",
        "Why Beldine Odemba is not to blame for Harambee Starlets' disastrous Wafcon campaign",
      ),
    ).toBe(false);
  });

  it("only matches short headlines exactly", () => {
    expect(isSameStory("Federation statement", "Federation statement")).toBe(true);
    expect(isSameStory("Federation statement", "Federation response")).toBe(false);
  });

  it("strips publisher suffixes when normalizing", () => {
    expect(normalizeTitle("Harambee Stars win in Nairobi - Nation")).toBe(
      "harambee stars win in nairobi",
    );
  });
});

describe("dedupeByStory", () => {
  const item = (title: string, imageUrl: string | null, description: string) => ({
    title,
    imageUrl,
    description,
  });

  it("keeps the richest record of a duplicated story", () => {
    const { kept, duplicates } = dedupeByStory([
      item("Gor Mahia seek to end 41-year Kagame Cup drought against Rayon Sports", null, ""),
      item(
        "Gor Mahia out to end 41-year Kagame Cup jinx against Rayon Sports",
        "https://img.example/pic.jpg",
        "Full match preview.",
      ),
    ]);

    expect(duplicates).toBe(1);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.imageUrl).toBe("https://img.example/pic.jpg");
  });

  it("leaves unrelated stories untouched", () => {
    const { kept, duplicates } = dedupeByStory([
      item("Harambee Stars name squad for AFCON qualifier", null, ""),
      item("Tusker FC sign Ugandan striker on two-year deal", null, ""),
      item("Federation chairperson addresses league sponsorship talks", null, ""),
    ]);

    expect(duplicates).toBe(0);
    expect(kept).toHaveLength(3);
  });
});
