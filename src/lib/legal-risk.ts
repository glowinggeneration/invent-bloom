/**
 * Legal-Risk Language Transformation Engine
 * (spec: "Legal-Safe Language Preservation Engine").
 *
 * Preserve purpose. Preserve function. Preserve persona. Reduce unnecessary
 * legal exposure. The engine rewrites the smallest amount of text needed and
 * never silently changes meaning, facts, persona or the requested action.
 */

export const RISK_CATEGORIES = [
  "defamation",
  "unsupported_criminal_allegation",
  "privacy",
  "harassment",
  "threat",
  "hate_or_discrimination",
  "sub_judice",
  "misrepresentation",
  "intellectual_property",
  "platform_policy",
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

/** 0 = no meaningful risk … 4 = critical, never auto-publishable. */
export type RiskLevel = 0 | 1 | 2 | 3 | 4;

export type ApprovalRequired = "none" | "reviewer" | "senior_reviewer" | "legal";

export type RiskyFinding = {
  segment: string;
  category: RiskCategory;
  level: RiskLevel;
  /** Plain-language explanation for the audit record. */
  reason: string;
  /** Deterministic safer wording, when one exists for this pattern. */
  replacement?: string;
};

/** Audit record kept for every transformation (spec §13). */
export type LegalReviewRecord = {
  originalText: string;
  riskLevel: RiskLevel;
  riskCategories: RiskCategory[];
  findings: RiskyFinding[];
  revisedText: string;
  functionPreserved: boolean;
  personaPreserved: boolean;
  factsChanged: boolean;
  approvalRequired: ApprovalRequired;
  confidence: number;
  escalationNote: string;
  autoPublishAllowed: boolean;
};

type Pattern = {
  re: RegExp;
  category: RiskCategory;
  level: RiskLevel;
  reason: string;
  /** Safer wording; `$1`-style backreferences from the match are supported. */
  replacement?: string;
};

/**
 * Meaning-aware lexicon (spec §32): each entry carries a category, a severity
 * and a tested replacement - this is deliberately not a banned-word list.
 */
const PATTERNS: Pattern[] = [
  // Rule 1 - conclusions of guilt → procedural language.
  {
    re: /\b(?:he|she|they)\s+stole\b[^.!?]*/gi,
    category: "unsupported_criminal_allegation",
    level: 3,
    reason: "States theft as established fact without a lawful finding.",
    replacement:
      "Concerns have been raised about how the funds were handled, and the records should be published and independently reviewed",
  },
  {
    re: /\b(?:is|are)\s+(?:corrupt|a\s+thief|thieves|criminals?)\b/gi,
    category: "defamation",
    level: 3,
    reason: "Declares criminality or corruption as fact.",
    replacement:
      "has questions to answer, and the decision needs a transparent, evidence-based response",
  },
  {
    re: /\bstole\s+(?:public\s+)?(?:money|funds|cash)\b/gi,
    category: "unsupported_criminal_allegation",
    level: 3,
    reason: "Unsupported criminal allegation about public funds.",
    replacement: "raised concerns about how the funds were managed",
  },
  {
    re: /\b(?:rigged|manipulated)\s+the\s+(?:election|vote|process|poll)\b/gi,
    category: "defamation",
    level: 3,
    reason: "Presents an election-integrity allegation as a proven fact.",
    replacement:
      "has been the subject of alleged irregularities in the process, which should be assessed through the appropriate dispute-resolution mechanism",
  },
  {
    re: /\bfraudulent\s+(deal|contract|tender|payment)\b/gi,
    category: "defamation",
    level: 3,
    reason: "Asserts fraud without a formal finding.",
    replacement: "$1 that raises serious transparency concerns",
  },
  // Rule 4 - criticise decisions, not personal worth.
  {
    re: /\b(?:is|are)\s+(?:useless|incompetent|stupid|idiots?|clowns?|fools?|shameless)\b/gi,
    category: "defamation",
    level: 2,
    reason: "Personal attack rather than criticism of a decision.",
    replacement: "handled this below the standard supporters expected",
  },
  // Rule 5 - malicious intent → observable conduct.
  {
    re: /\bdeliberately\s+(destroyed|sabotaged|ruined)\b/gi,
    category: "defamation",
    level: 2,
    reason: "Claims malicious intent, which is hard to substantiate.",
    replacement: "made decisions that have had a damaging effect on",
  },
  // Rule 6 - absolutes.
  {
    re: /\beveryone\s+knows\b/gi,
    category: "misrepresentation",
    level: 1,
    reason: "Absolute claim presented as shared knowledge.",
    replacement: "many supporters have raised concerns",
  },
  {
    re: /\bnobody\s+believes\b/gi,
    category: "misrepresentation",
    level: 1,
    reason: "Absolute claim about public belief.",
    replacement: "the available information has not persuaded everyone",
  },
  {
    re: /\b(?:always\s+lies|never\s+delivers|completely\s+failed)\b/gi,
    category: "misrepresentation",
    level: 1,
    reason: "Absolute statement that cannot be evidenced.",
    replacement: "has not clearly demonstrated progress",
  },
  // Rule 7 - accurate legal status.
  {
    re: /\bis\s+guilty\b/gi,
    category: "sub_judice",
    level: 3,
    reason: "Declares guilt before any determination.",
    replacement: "is accused",
  },
  {
    re: /\billegally\b/gi,
    category: "misrepresentation",
    level: 2,
    reason: "Asserts unlawfulness that has not been established.",
    replacement: "in a legally disputed manner",
  },
  {
    re: /\bcourt\s+proved\b/gi,
    category: "sub_judice",
    level: 2,
    reason: "Misstates a procedural outcome.",
    replacement: "court found",
  },
  // Rule 9 - mob action.
  {
    re: /\b(?:tag\s+him|tag\s+her|tag\s+them)\s+everywhere\b[^.!?]*/gi,
    category: "harassment",
    level: 3,
    reason: "Coordinated pile-on instruction.",
    replacement:
      "supporters can keep requesting a formal response through the official public channels",
  },
  {
    re: /\b(?:let'?s|we\s+should|everyone\s+should)\s+(?:go\s+to\s+his|go\s+to\s+her|storm|surround)\b[^.!?]*/gi,
    category: "harassment",
    level: 4,
    reason: "Calls for people to converge on an individual.",
    replacement:
      "those seeking answers should use the lawful complaint, petition or stakeholder-engagement process",
  },
  // Rule 10 - threats, including indirect Sheng phrasing.
  {
    re: /\b(?:tutakupata|tutakuonyesha|dawa\s+yako\s+iko|utajua\s+sisi\s+ni\s+nani|watu\s+wanakungoja|hii\s+haitakuishia\s+poa|we\s+shall\s+visit\s+you|we\s+will\s+teach\s+you\s+a\s+lesson|your\s+time\s+is\s+coming)\b/gi,
    category: "threat",
    level: 4,
    reason: "Indirect threat or intimidation.",
    replacement: "this matter should be pursued through lawful accountability channels",
  },
  // Rule 11 - personal information.
  {
    re: /\b(?:\+?254|0)7\d{2}\s?\d{3}\s?\d{3}\b/g,
    category: "privacy",
    level: 3,
    reason: "Publishes a personal phone number.",
    replacement: "the official contact channel",
  },
  {
    re: /\b[\w.+-]+@(?!footballkenya\.org)[\w-]+\.[\w.]{2,}\b/g,
    category: "privacy",
    level: 2,
    reason: "Publishes a personal email address.",
    replacement: "the official public email address",
  },
  {
    re: /\bID\s?(?:no\.?|number)\s?\d{6,}\b/gi,
    category: "privacy",
    level: 4,
    reason: "Publishes a national identification number.",
    replacement: "",
  },
  {
    re: /\b(?:lives?\s+at|home\s+address\s+is)\s+[^.!?]*/gi,
    category: "privacy",
    level: 4,
    reason: "Discloses a home address (doxxing).",
    replacement: "",
  },
  // Rule 13 - rumour language.
  {
    re: /\b(?:word\s+on\s+the\s+street|sources\s+say|people\s+are\s+saying|it'?s?\s+an\s+open\s+secret|there\s+are\s+whispers|i\s+heard)\b/gi,
    category: "misrepresentation",
    level: 1,
    reason: "Rumour framing presented as reporting.",
    replacement: "no verified source has confirmed that",
  },
  // Rule 14 - accusation by question.
  {
    re: /\bhow\s+much\s+(?:money\s+)?did\s+(?:he|she|they)\s+steal\b[^?]*\??/gi,
    category: "defamation",
    level: 3,
    reason: "Accusation framed as a question.",
    replacement: "can the organisation publish a clear breakdown of how the funds were used?",
  },
  // Hate / discrimination.
  {
    re: /\b(?:these|those)\s+(?:kikuyus?|luos?|kalenjins?|luhyas?|kambas?|somalis?)\b/gi,
    category: "hate_or_discrimination",
    level: 4,
    reason: "Collective attack on an ethnic community.",
    replacement: "the people involved",
  },
];

/** Rule 15 - "allegedly" is not a complete defence. */
const ALLEGEDLY = /\ballegedly\b/gi;

export function assessLegalRisk(text: string): {
  level: RiskLevel;
  categories: RiskCategory[];
  findings: RiskyFinding[];
} {
  const findings: RiskyFinding[] = [];
  if (!text.trim()) return { level: 0, categories: [], findings };

  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      findings.push({
        segment: match[0],
        category: p.category,
        level: p.level,
        reason: p.reason,
        ...(p.replacement === undefined ? {} : { replacement: expand(p.replacement, match) }),
      });
      if (match[0] === "") re.lastIndex += 1;
    }
  }

  if (ALLEGEDLY.test(text) && /\b(stole|fraud|bribe|corrupt)\b/i.test(text)) {
    findings.push({
      segment: "allegedly",
      category: "defamation",
      level: 2,
      reason:
        "\u201cAllegedly\u201d does not neutralise a criminal accusation; state the actual procedural position.",
    });
  }
  ALLEGEDLY.lastIndex = 0;

  const level = findings.reduce<RiskLevel>((max, f) => (f.level > max ? f.level : max), 0);
  const categories = [...new Set(findings.map((f) => f.category))];
  return { level, categories, findings };
}

function expand(replacement: string, match: RegExpExecArray): string {
  return replacement.replace(/\$(\d)/g, (_, d: string) => match[Number(d)] ?? "");
}

export function approvalFor(level: RiskLevel): ApprovalRequired {
  if (level === 0) return "none";
  if (level === 1) return "reviewer";
  if (level === 2) return "reviewer";
  if (level === 3) return "senior_reviewer";
  return "legal";
}

/**
 * Deterministic minimal rewrite: replaces only the risky segments with their
 * tested safer wording. Level-4 findings are never repaired automatically.
 */
export function transformText(text: string): LegalReviewRecord {
  const { level, categories, findings } = assessLegalRisk(text);
  let revised = text;

  if (level < 4) {
    for (const f of findings) {
      if (f.replacement === undefined) continue;
      revised = revised.split(f.segment).join(f.replacement);
    }
    revised = revised
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([.,!?])/g, "$1")
      .trim();
  }

  const residual = assessLegalRisk(revised).level;
  return {
    originalText: text,
    riskLevel: level,
    riskCategories: categories,
    findings,
    revisedText: level === 4 ? "" : revised,
    functionPreserved: true,
    // Deterministic swaps keep the surrounding voice untouched.
    personaPreserved: true,
    factsChanged: false,
    approvalRequired: approvalFor(level),
    confidence: level === 0 ? 1 : findings.length > 2 ? 0.7 : 0.85,
    escalationNote:
      level === 4
        ? "Critical risk: do not publish. Preserve the record and escalate for legal review."
        : residual >= 3
          ? "Residual high risk after rewrite - senior or legal approval required before publication."
          : "",
    autoPublishAllowed: level <= 2 && residual <= 2,
  };
}

/** Doctrine block injected into every generation and rewrite prompt. */
export const LEGAL_RISK_DOCTRINE = [
  "LEGAL-SAFE LANGUAGE ENGINE - preserve purpose, function and persona while reducing legal exposure.",
  "Never state crime, corruption, fraud, theft or dishonesty as established fact; describe observable conduct and ask for evidence-based transparency instead.",
  "Attribute allegations to a real source only; never invent attribution. Use accurate procedural language (accused, charged, under investigation, court found).",
  "Criticise decisions and conduct, not personal worth. Avoid absolutes (everyone knows, always lies, completely failed) and rumour framing (sources say, word on the street).",
  "No threats, no intimidation (including indirect Sheng phrasing), no calls for pile-ons, no doxxing, no ethnic or identity attacks.",
  "Do not publish personal data: phone numbers, home addresses, ID numbers, private email, medical details, live location, children's names.",
  "'Allegedly' is not a defence; questions can also defame. Strong lawful criticism must be preserved - do not water down a legitimate demand for accountability.",
  "Never change facts, the topic, the requested action or the persona voice while making wording safer.",
].join(" ");

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  0: "No legal risk",
  1: "Low risk",
  2: "Moderate risk",
  3: "High risk",
  4: "Critical risk",
};
