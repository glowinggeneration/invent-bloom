/** Plain-language definitions for every metric shown on the Performance report. */

export type PerformanceTerm = { term: string; definition: string };

export const PERFORMANCE_GLOSSARY: { group: string; terms: PerformanceTerm[] }[] = [
  {
    group: "Value and rates",
    terms: [
      {
        term: "AVE",
        definition:
          "Advertising value equivalent — an estimate of what this organic reach would have cost if bought as paid advertising, based on standard rate-card pricing.",
      },
      {
        term: "Engagement rate",
        definition:
          "Engagements divided by views, shown as a percentage. Measures how many people who saw a post interacted with it.",
      },
      {
        term: "Share of voice",
        definition:
          "Each persona's share of total views in this period. A high share means one voice is carrying most of the conversation.",
      },
    ],
  },
  {
    group: "Reach",
    terms: [
      {
        term: "Views",
        definition:
          "Total number of times posts were displayed, including repeat views by the same person.",
      },
      {
        term: "Reach",
        definition:
          "Distinct people who saw the posts. Uses the platform's own view count when it has been reported; when a post has no reported views yet, an amplification-based estimate is used instead and the figure is labelled 'includes estimates'.",
      },
      {
        term: "Impressions",
        definition:
          "Same as views — total displays of a post, including repeats. Used interchangeably with views on X.",
      },
    ],
  },
  {
    group: "Engagements",
    terms: [
      {
        term: "Engagements",
        definition:
          "All interactions combined: likes, retweets, replies received, quotes and bookmarks.",
      },
      {
        term: "Likes",
        definition: "Number of likes on persona posts in this period.",
      },
      {
        term: "Retweets",
        definition: "Number of times a persona post was reposted by another account.",
      },
      {
        term: "Replies received",
        definition:
          "Replies written by other accounts under persona posts. Indicates conversation, but is not always positive.",
      },
      {
        term: "Bookmarks",
        definition:
          "Times a post was saved for later. Often signals useful or reference-worthy content.",
      },
      {
        term: "Quotes",
        definition: "Reposts with added commentary. Can be positive or critical.",
      },
    ],
  },
  {
    group: "Activity",
    terms: [
      {
        term: "Posts",
        definition: "Original tweets published by personas.",
      },
      {
        term: "Comments",
        definition: "Replies personas wrote under another account's post, outside any campaign.",
      },
      {
        term: "Campaign replies",
        definition:
          "Replies personas published as part of a listening campaign, matched to that campaign's keywords.",
      },
      {
        term: "Tone",
        definition:
          "The voice a post was written in, classified from its text — for example supportive, factual, or celebratory.",
      },
    ],
  },
];

/** Flat lookup by term for inline definitions. */
export const PERFORMANCE_HELP: Record<string, string> = Object.fromEntries(
  PERFORMANCE_GLOSSARY.flatMap((g) => g.terms.map((t) => [t.term, t.definition])),
);

/** Stable DOM id for a glossary entry so inline notes can link to it. */
export function glossaryId(term: string) {
  return `perf-glossary-${term.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
