/**
 * Multi-provider AI adapter with bounded fallback and cost-aware model
 * selection. Backs Application Build Master Rules §9.1 (fallback behind
 * an adapter), §9.3 (least expensive model that meets the target), and
 * §9.7 (bounded retry cost). Scaffold — see src/lib/platform/README.md.
 *
 * Existing AI calls (src/lib/campaigns.server.ts, src/lib/smait-ai.functions.ts)
 * call the Lovable AI gateway directly and are NOT routed through this
 * adapter yet. Wire a call site in by replacing its `fetch(GATEWAY_URL, ...)`
 * with `generateWithFallback(providers, request)`.
 */

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiRequest = {
  messages: AiMessage[];
  /** Optional JSON schema; when present the provider must return schema-valid JSON (Master Rules §9.2). */
  responseSchema?: unknown;
  maxOutputTokens?: number;
};

export type AiResponse = {
  content: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
};

export interface AiProvider {
  name: string;
  model: string;
  generate(request: AiRequest, signal?: AbortSignal): Promise<AiResponse>;
}

export type AiOutcome =
  | { ok: true; response: AiResponse; attempts: number; fallbackUsed: boolean }
  | { ok: false; error: string; attempts: number };

export type FallbackOptions = {
  /** Per-provider timeout. Total wall-clock time is bounded by providers.length * timeoutMs. */
  timeoutMs?: number;
  onAttempt?: (info: { provider: string; attempt: number; error?: string }) => void;
};

/**
 * Tries providers in order, moving to the next only on failure or
 * timeout — never retries the same provider in a loop, so cost is
 * bounded by the number of configured providers (Master Rules §9.7).
 */
export async function generateWithFallback(
  providers: AiProvider[],
  request: AiRequest,
  options: FallbackOptions = {},
): Promise<AiOutcome> {
  if (providers.length === 0) {
    return { ok: false, error: "No AI providers configured.", attempts: 0 };
  }

  const timeoutMs = options.timeoutMs ?? 15_000;
  let attempts = 0;
  let lastError = "Unknown error";

  for (const [index, provider] of providers.entries()) {
    attempts += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await provider.generate(request, controller.signal);
      clearTimeout(timer);
      return { ok: true, response, attempts, fallbackUsed: index > 0 };
    } catch (error) {
      clearTimeout(timer);
      lastError = error instanceof Error ? error.message : String(error);
      options.onAttempt?.({ provider: provider.name, attempt: attempts, error: lastError });
    }
  }

  return { ok: false, error: lastError, attempts };
}

/**
 * Wraps a fetch-based provider (e.g. the Lovable AI gateway used
 * elsewhere in this codebase) into the AiProvider shape.
 */
export function createFetchProvider(config: {
  name: string;
  model: string;
  url: string;
  apiKey: string;
  extractContent: (json: unknown) => string;
  extractUsage?: (json: unknown) => { inputTokens?: number; outputTokens?: number };
}): AiProvider {
  return {
    name: config.name,
    model: config.model,
    async generate(request, signal) {
      const res = await fetch(config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: request.messages,
          ...(request.maxOutputTokens ? { max_tokens: request.maxOutputTokens } : {}),
        }),
        ...(signal ? { signal } : {}),
      });
      if (!res.ok) throw new Error(`${config.name} responded ${res.status}`);
      const json: unknown = await res.json();
      const usage = config.extractUsage?.(json) ?? {};
      return {
        content: config.extractContent(json),
        provider: config.name,
        model: config.model,
        ...usage,
      };
    },
  };
}
