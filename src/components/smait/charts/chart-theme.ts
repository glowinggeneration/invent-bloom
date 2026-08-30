/** Shared chart palette & defaults. Colors reference semantic tokens so
 * they follow light/dark theme automatically. Use as CSS var strings
 * (e.g. `stroke="hsl(var(--chart-1))"`) or read from CHART_COLORS. */

export const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  positive: "hsl(160 84% 39%)",
  neutral: "hsl(var(--muted-foreground))",
  negative: "hsl(0 84% 60%)",
  warning: "hsl(38 92% 50%)",
  info: "hsl(217 91% 60%)",
  accent: "hsl(280 76% 60%)",
} as const;

export const SENTIMENT_COLORS = {
  positive: CHART_COLORS.positive,
  neutral: CHART_COLORS.neutral,
  negative: CHART_COLORS.negative,
} as const;

export const CATEGORICAL_PALETTE: string[] = [
  CHART_COLORS.primary,
  CHART_COLORS.positive,
  CHART_COLORS.warning,
  CHART_COLORS.info,
  CHART_COLORS.accent,
  CHART_COLORS.negative,
];

export const CHART_DEFAULTS = {
  gridStroke: "hsl(var(--border))",
  axisTick: "hsl(var(--muted-foreground))",
  fontSize: 11,
  strokeWidth: 1.5,
  radius: 6,
} as const;

export type SentimentKey = keyof typeof SENTIMENT_COLORS;
