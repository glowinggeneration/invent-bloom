/**
 * Voice cards: a hard style contract handed to each persona in a batch so no
 * two replies read like the same writer. The persona says *what* they care
 * about; the card fixes *how* they say it - opening move, structure, length,
 * register, language mix and punctuation habit.
 *
 * Cards are assigned by position in the batch, so a run of ten personas gets
 * ten different shapes before any wording is generated.
 */

export type VoiceCard = {
  id: string;
  /** How the reply starts. */
  opening: string;
  /** Sentence shape and rhythm. */
  structure: string;
  /** Rough length target in words. */
  length: string;
  /** Register and attitude. */
  register: string;
  /** English / Kiswahili / Sheng mix. */
  language: string;
  /** Punctuation and casing habit. */
  punctuation: string;
  /** How many emojis and where. */
  emoji: string;
};

export const VOICE_CARDS: VoiceCard[] = [
  {
    id: "blunt-opener",
    opening: "state the position in the first four words, no preamble",
    structure: "two short sentences, second one lands the point",
    length: "18-28 words",
    register: "blunt, confident, street-level",
    language: "Kenyan English with one Sheng word",
    punctuation: "full stops only, no exclamation marks",
    emoji: "one emoji at the very end",
  },
  {
    id: "question-first",
    opening: "open with a genuine question to the poster",
    structure: "question, then a one-line reason for asking",
    length: "20-32 words",
    register: "curious, respectful, probing",
    language: "plain English",
    punctuation: "one question mark, no ellipses",
    emoji: "no emoji, or a single 👀 style marker mid-text",
  },
  {
    id: "story-anchor",
    opening: "start from a small personal observation",
    structure: "observation, then what it means for the topic",
    length: "28-40 words",
    register: "warm, experience-driven",
    language: "English with a natural Kiswahili phrase",
    punctuation: "commas and a dash, relaxed flow",
    emoji: "one emoji after the first clause",
  },
  {
    id: "numbers",
    opening: "lead with a concrete detail, date or figure",
    structure: "fact, then a measured conclusion",
    length: "22-34 words",
    register: "analytical, cool-headed",
    language: "formal English",
    punctuation: "no emojis in the first sentence, precise punctuation",
    emoji: "at most one 📈 or 🧠 style marker at the end",
  },
  {
    id: "agree-and-push",
    opening: "concede one point before adding your own",
    structure: "concession, pivot, ask",
    length: "26-38 words",
    register: "diplomatic but firm",
    language: "English with a Kiswahili connector",
    punctuation: "one semicolon or dash",
    emoji: "one emoji only if it softens the pivot",
  },
  {
    id: "one-liner",
    opening: "a single punchy line, no build-up",
    structure: "one sentence, under fifteen words",
    length: "8-15 words",
    register: "dry, witty, understated",
    language: "Sheng-leaning",
    punctuation: "lowercase start is fine, minimal punctuation",
    emoji: "one emoji maximum",
  },
  {
    id: "community",
    opening: "speak for a group you belong to (fans, parents, traders)",
    structure: "who you speak for, what you want, why",
    length: "30-42 words",
    register: "earnest, collective, hopeful",
    language: "Kiswahili opener then English",
    punctuation: "no rhetorical questions",
    emoji: "two emojis, one mid-text one at the end",
  },
  {
    id: "corrective",
    opening: "gently correct a misunderstanding in the post",
    structure: "correction, evidence, invitation to check",
    length: "24-36 words",
    register: "calm, factual, non-combative",
    language: "clear English, no slang",
    punctuation: "no exclamation marks at all",
    emoji: "no emojis",
  },
  {
    id: "hype",
    opening: "open on energy - a reaction word",
    structure: "reaction, then the reason for it",
    length: "14-24 words",
    register: "loud, celebratory, fan-first",
    language: "Sheng and English mixed",
    punctuation: "one exclamation mark maximum",
    emoji: "two or three emojis clustered at the end",
  },
  {
    id: "practical",
    opening: "start with what should happen next",
    structure: "suggestion, then the practical benefit",
    length: "24-34 words",
    register: "solution-focused, unsentimental",
    language: "plain English",
    punctuation: "no questions, no emphasis marks",
    emoji: "one emoji at most",
  },
  {
    id: "sceptic",
    opening: "open with measured doubt, not insult",
    structure: "doubt, the specific gap, what would change your mind",
    length: "26-38 words",
    register: "sceptical, unimpressed, fair",
    language: "English with a wry Sheng aside",
    punctuation: "no emojis before the last word",
    emoji: "one dry emoji at the end, or none",
  },
  {
    id: "elder",
    opening: "start with perspective from time or history",
    structure: "then and now, then a quiet judgement",
    length: "30-44 words",
    register: "measured, senior, unhurried",
    language: "formal English with one proverb-like line",
    punctuation: "long sentences, no slang punctuation",
    emoji: "no emojis, or a single 🙏",
  },
];

/** The card for slot `index` in a batch, cycling once the list runs out. */
export function voiceCard(index: number): VoiceCard {
  return VOICE_CARDS[index % VOICE_CARDS.length]!;
}

/** One-line style contract for the prompt. */
export function voiceCardBrief(card: VoiceCard): string {
  return [
    `STYLE ${card.id}`,
    `open: ${card.opening}`,
    `shape: ${card.structure}`,
    `length: ${card.length}`,
    `register: ${card.register}`,
    `language: ${card.language}`,
    `punctuation: ${card.punctuation}`,
    `emoji: ${card.emoji}`,
  ].join(" | ");
}
