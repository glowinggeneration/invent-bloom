/**
 * Our own published-rate estimate of AI gateway cost - never a figure the
 * provider confirms to us. The Lovable gateway (ai.gateway.lovable.dev)
 * does not return a per-call dollar amount, only token counts, so every
 * cost figure derived from this table is explicitly an estimate and must
 * be labelled as one everywhere it's shown - see EXCEPTION_REGISTER.md.
 *
 * Rates are USD per 1,000 tokens, matching the model id strings already
 * used at each gateway call site (e.g. "google/gemini-3.6-flash" in
 * smait.server.ts). Add a row here whenever a new model is wired in;
 * estimateCostUsd() returns null for any model without one rather than
 * guessing.
 */

type PricePerThousand = { input: number; output: number };

const MODEL_PRICING: Record<string, PricePerThousand> = {
  "google/gemini-3.6-flash": { input: 0.0003, output: 0.0012 },
};

/**
 * Estimated USD cost of one call, or null when the model has no pricing
 * entry - callers must render "not available", never a silent $0.00.
 */
export function estimateCostUsd(
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  const rate = MODEL_PRICING[model];
  if (!rate) return null;
  const input = inputTokens ?? 0;
  const output = outputTokens ?? 0;
  return Number(((input / 1000) * rate.input + (output / 1000) * rate.output).toFixed(6));
}

export function formatUsdEstimate(value: number | null): string {
  if (value === null) return "Not available";
  if (value < 0.01) return "< $0.01";
  return `$${value.toFixed(2)}`;
}
