/**
 * Lightweight tone read for posts we publish (as opposed to sentiment, which we
 * only score on inbound mentions). Tone describes how the message sounds, so
 * teams can see at a glance whether a persona sounded celebratory, urgent, etc.
 */
export type ToneLabel =
  "Celebratory" | "Supportive" | "Urgent" | "Playful" | "Informative" | "Critical" | "Neutral";

const RULES: { label: ToneLabel; words: RegExp }[] = [
  {
    label: "Celebratory",
    words:
      /\b(congrat\w*|champion\w*|victory|winner|won|trophy|historic|proud|celebrat\w*|hongera|bravo|milestone)\b|🏆|🎉|🥳|🙌/i,
  },
  {
    label: "Urgent",
    words:
      /\b(now|today|urgent|deadline|last chance|don'?t miss|hurry|breaking|kick ?off|live|immediately|leo)\b|🚨|⏰|⚡/i,
  },
  {
    label: "Critical",
    words:
      /\b(disappoint\w*|fail\w*|shame|corrupt\w*|unacceptable|concern\w*|problem|issue|apolog\w*|wrong)\b/i,
  },
  {
    label: "Playful",
    words: /\b(haha|lol|😂|😅|banter|vibes|sawa|poa|fam|come on)\b|😂|😉|🔥|😎/i,
  },
  {
    label: "Supportive",
    words:
      /\b(together|support|thank\w*|asante|karibu|we stand|behind you|believe|community|grateful|welcome)\b|❤️|💚|🙏|🤝/i,
  },
  {
    label: "Informative",
    words:
      /\b(announc\w*|update|report|schedule|fixture|details|statement|register|apply|read more|learn|results?)\b|📊|📅|📝|ℹ️/i,
  },
];

export const TONE_STYLE: Record<ToneLabel, string> = {
  Celebratory: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Supportive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Urgent: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  Playful: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  Informative: "bg-primary/10 text-primary",
  Critical: "bg-destructive/10 text-destructive",
  Neutral: "bg-muted text-muted-foreground",
};

/** Best-effort tone read for a post's copy. */
export function detectTone(text: string | null | undefined): ToneLabel {
  const value = (text ?? "").trim();
  if (!value) return "Neutral";
  for (const rule of RULES) {
    if (rule.words.test(value)) return rule.label;
  }
  if (/[!?]{2,}/.test(value)) return "Urgent";
  return "Neutral";
}
