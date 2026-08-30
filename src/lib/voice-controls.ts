/**
 * Voice controls for publishing: the tone personas should adopt and how
 * strongly they should express it. Pure data so both the composer UI and the
 * server-side variation prompt read the same vocabulary.
 */

export const PUBLISH_TONES = [
  "auto",
  "celebratory",
  "supportive",
  "informative",
  "urgent",
  "reassuring",
  "playful",
  "defensive",
] as const;

export type PublishTone = (typeof PUBLISH_TONES)[number];

export const TONE_OPTIONS: {
  value: PublishTone;
  label: string;
  hint: string;
  /** Guidance injected into the generation prompt. */
  direction: string;
}[] = [
  {
    value: "auto",
    label: "Auto",
    hint: "Let each persona pick the tone that fits them",
    direction: "",
  },
  {
    value: "celebratory",
    label: "Celebratory",
    hint: "Wins, milestones, pride",
    direction: "celebratory and proud: mark the moment, credit the people behind it",
  },
  {
    value: "supportive",
    label: "Supportive",
    hint: "Backing players, staff or fans",
    direction: "supportive and encouraging: stand behind the people involved without overclaiming",
  },
  {
    value: "informative",
    label: "Informative",
    hint: "Facts, fixtures, announcements",
    direction: "informative and matter-of-fact: lead with the useful detail, no hype",
  },
  {
    value: "urgent",
    label: "Urgent",
    hint: "Deadlines and calls to act now",
    direction: "urgent and action-first: make the deadline or next step unmissable",
  },
  {
    value: "reassuring",
    label: "Reassuring",
    hint: "Calming a worried audience",
    direction:
      "calm and reassuring: acknowledge the concern, then steady it with what is being done",
  },
  {
    value: "playful",
    label: "Playful",
    hint: "Banter and light energy",
    direction: "playful and light: banter, humour and everyday fan energy",
  },
  {
    value: "defensive",
    label: "Defensive",
    hint: "Answering criticism",
    direction: "measured and corrective: answer the criticism with facts, never insult or escalate",
  },
];

export const DEFAULT_TONE: PublishTone = "auto";

/** 1 = barely there, 5 = full volume. */
export const INTENSITY_MIN = 1;
export const INTENSITY_MAX = 5;
export const DEFAULT_INTENSITY = 3;

export const INTENSITY_LABELS: Record<number, string> = {
  1: "Subtle",
  2: "Measured",
  3: "Balanced",
  4: "Strong",
  5: "Full volume",
};

const INTENSITY_DIRECTION: Record<number, string> = {
  1: "Keep it very understated: short, plain sentences, at most one emoji, no exclamation marks, no hashtags.",
  2: "Keep it restrained: calm wording, minimal punctuation, 0-1 emoji, no shouting.",
  3: "Natural everyday energy: normal social wording, 1-2 emojis, at most one exclamation mark.",
  4: "High energy: punchy lines, vivid wording, 2-3 emojis, exclamation marks allowed.",
  5: "Maximum energy: bold, loud, rallying language, 2-3 emojis, caps only for one short word if it fits the persona.",
};

export function toneOption(tone: PublishTone) {
  return TONE_OPTIONS.find((t) => t.value === tone) ?? TONE_OPTIONS[0]!;
}

export function clampIntensity(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_INTENSITY;
  return Math.min(INTENSITY_MAX, Math.max(INTENSITY_MIN, n));
}

export function intensityLabel(value: number) {
  return INTENSITY_LABELS[clampIntensity(value)] ?? "Balanced";
}

/** Prompt lines describing the requested tone and intensity, if any. */
export function voiceDirective(tone: PublishTone, intensity: number): string {
  const option = toneOption(tone);
  const level = clampIntensity(intensity);
  const parts: string[] = [];
  if (option.direction) {
    parts.push(
      `Required tone for every variation: ${option.direction}. Keep each persona's own voice, but bend it to this tone.`,
    );
  }
  parts.push(
    `Intensity level ${level}/5 (${intensityLabel(level)}). ${INTENSITY_DIRECTION[level]}`,
  );
  return parts.join(" ");
}

/** Short human summary for the composer preview and archives. */
export function voiceSummary(tone: PublishTone, intensity: number): string {
  const option = toneOption(tone);
  return `${option.label} · ${intensityLabel(intensity)}`;
}
