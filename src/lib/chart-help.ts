/** Plain-language explanations shown in chart tooltips on the results view. */

export const METRIC_HELP: Record<string, string> = {
  Clarity:
    "How easily the panel understood the message on first read. Low means it needs simpler wording.",
  "Cultural fit":
    "How natural the message feels in a Kenyan context: language, references and tone.",
  Trust: "How believable the message is coming from the federation. Low means it reads as spin.",
  Relevance:
    "How much the panel felt the message speaks to what they actually care about right now.",
  "Call to action":
    "How clear the next step is. Low means people liked it but would not act on it.",
  Shareability: "How likely personas are to repost, quote or forward it to their circles.",
};

export const SENTIMENT_HELP: Record<string, string> = {
  Positive: "Personas who react favourably and would support or amplify the message.",
  Neutral: "Personas who neither back nor push back. They usually scroll past.",
  Negative: "Personas who react against the message. These drive replies, criticism and risk.",
};

export const BAND_HELP: Record<string, string> = {
  "0–19": "Strong rejection. These personas would push back publicly.",
  "20–39": "Sceptical. They doubt the message or the messenger.",
  "40–59": "On the fence. They need more proof before they move.",
  "60–79": "Warm. They accept the message and may engage.",
  "80–100": "Advocates. They would share and defend the message.",
};

export const CONFIDENCE_HELP =
  "The share of the 100-persona panel likely to receive this message as intended. Above 70% is safe to publish, 50-70% needs a rewrite, below 50% is high risk.";

export const SEGMENT_HELP =
  "Average score out of 100 for every persona in this audience segment. Lower bars are the audiences the message loses.";

export const SCORE_HELP = "Score is 0-100: how positively that persona receives the message.";

/** Grouped glossary of every metric shown on the results charts. */
export const GLOSSARY: { group: string; terms: { term: string; definition: string }[] }[] = [
  {
    group: "Headline",
    terms: [
      { term: "Confidence score", definition: CONFIDENCE_HELP },
      { term: "Persona score", definition: SCORE_HELP },
      { term: "Audience segment", definition: SEGMENT_HELP },
    ],
  },
  {
    group: "Message quality",
    terms: Object.entries(METRIC_HELP).map(([term, definition]) => ({ term, definition })),
  },
  {
    group: "Panel sentiment",
    terms: Object.entries(SENTIMENT_HELP).map(([term, definition]) => ({ term, definition })),
  },
  {
    group: "Score bands",
    terms: Object.entries(BAND_HELP).map(([term, definition]) => ({
      term,
      definition,
    })),
  },
];
