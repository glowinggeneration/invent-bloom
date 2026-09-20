export type PersonaReaction = {
  personaId: string;
  name: string;
  segment: string;
  location: string;
  score: number;
  sentiment: "positive" | "neutral" | "negative";
  reaction: string;
  likelyAction: string;
};

export type Suggestion = {
  title: string;
  message: string;
  rationale: string;
  /** Response strategy from the persona-engine doctrine (optional). */
  strategy?: string;
  /** Legal-risk review of this exact wording (optional). */
  legal?: LegalSafety;
};

/** Summary of the Legal-Risk Language Transformation Engine's verdict. */
export type LegalSafety = {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  categories: string[];
  approvalRequired: string;
  rewritten: boolean;
  note: string;
};

/** Post classification from the persona-engine doctrine (optional). */
export type Classification = {
  topic: string;
  intent: string;
  tone: string;
  language: string;
  risk: "low" | "medium" | "high";
};

export type Analysis = {
  summary: string;
  confidence: number;
  sentiment: { positive: number; neutral: number; negative: number };
  metrics: {
    clarity: number;
    culturalFit: number;
    trust: number;
    relevance: number;
    callToAction: number;
    shareability: number;
  };
  personaReactions: PersonaReaction[];
  risks: string[];
  suggestions: Suggestion[];
  classification?: Classification;
  /** Legal review of the message the user submitted. */
  legal?: LegalSafety;
  /**
   * Approved Knowledge Library entries the tested message or a suggested
   * rewrite appears to conflict with. Populated only when the workspace has
   * approved entries to check against - absence never implies "no conflict
   * exists", only "nothing was checked".
   */
  knowledgeConflicts?: KnowledgeConflict[];
};

export type KnowledgeConflict = {
  entryId: string;
  entryTitle: string;
  note: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl: string | null;
  analysis: Analysis | null;
  createdAt: string;
};

export type ThreadSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export const METRIC_LABELS: Record<keyof Analysis["metrics"], string> = {
  clarity: "Clarity",
  culturalFit: "Cultural fit",
  trust: "Trust",
  relevance: "Relevance",
  callToAction: "Call to action",
  shareability: "Shareability",
};
