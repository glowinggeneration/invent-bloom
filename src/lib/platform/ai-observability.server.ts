/**
 * Structured logging for AI calls. Backs Application Build Master Rules
 * §9.8. Scaffold — see src/lib/platform/README.md for wiring
 * instructions. Not called from any route yet.
 *
 * Usage once wired in, around a call made through ai-provider.server.ts:
 *
 *   const started = Date.now();
 *   const outcome = await generateWithFallback(providers, request);
 *   await recordAiEvent(supabaseAdmin, {
 *     userId, feature: "campaign.draft_reply", outcome, startedAt: started,
 *   });
 *
 * Never pass secrets or full prompt/response bodies here if they may
 * contain sensitive user content — record token counts and outcome, not
 * the content itself, unless the product has an explicit, reviewed need
 * to retain prompts for debugging (and a matching retention policy).
 */
import type { AiOutcome } from "./ai-provider.server";

export type AiEventInput = {
  userId: string | null;
  org?: string | null;
  feature: string;
  correlationId?: string;
  promptVersion?: string;
  outcome: AiOutcome;
  startedAt: number;
};

export async function recordAiEvent(
  admin: { from: (table: string) => any },
  input: AiEventInput,
): Promise<void> {
  const latencyMs = Date.now() - input.startedAt;
  const row = input.outcome.ok
    ? {
        user_id: input.userId,
        org: input.org ?? null,
        feature: input.feature,
        provider: input.outcome.response.provider,
        model: input.outcome.response.model,
        prompt_version: input.promptVersion ?? null,
        correlation_id: input.correlationId ?? null,
        input_tokens: input.outcome.response.inputTokens ?? null,
        output_tokens: input.outcome.response.outputTokens ?? null,
        latency_ms: latencyMs,
        retries: Math.max(0, input.outcome.attempts - 1),
        fallback_used: input.outcome.fallbackUsed,
        outcome: "success" as const,
        failure_reason: null,
      }
    : {
        user_id: input.userId,
        org: input.org ?? null,
        feature: input.feature,
        provider: "none",
        model: "none",
        prompt_version: input.promptVersion ?? null,
        correlation_id: input.correlationId ?? null,
        input_tokens: null,
        output_tokens: null,
        latency_ms: latencyMs,
        retries: Math.max(0, input.outcome.attempts - 1),
        fallback_used: false,
        outcome: "failure" as const,
        failure_reason: input.outcome.error.slice(0, 500),
      };

  const { error } = await admin.from("ai_events").insert(row);
  if (error) throw new Error(error.message);
}
