/**
 * Single translation service for the whole platform.
 *
 * Puter.js (keyless, User-Pays) is the engine. Every translation feature must
 * call `translate()` from this module — never `puter.ai.chat` directly.
 */

/** Swap the model here and the whole app follows. */
export const TRANSLATION_MODEL = "gpt-5.4-nano";

const PUTER_SRC = "https://js.puter.com/v2/";

/**
 * LibreTranslate fallback config. Point LIBRETRANSLATE_URL at your own
 * self-hosted instance — public mirrors are rate-limited and unreliable.
 */
export const LIBRETRANSLATE_CONFIG = {
  url: import.meta.env["VITE_LIBRETRANSLATE_URL"] ?? "https://translate.your-domain.com",
  apiKey: (import.meta.env["VITE_LIBRETRANSLATE_API_KEY"] as string | undefined) ?? "",
  /** Set false to silence the "served by" console line. */
  debug: true,
};

/** Shared language list: Puter uses `name`, LibreTranslate uses `code`. */
export type TranslationLanguage = { name: string; code: string };

export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  { name: "English", code: "en" },
  { name: "Swahili", code: "sw" },
  { name: "French", code: "fr" },
  { name: "Arabic", code: "ar" },
  { name: "Portuguese", code: "pt" },
  { name: "Spanish", code: "es" },
  { name: "German", code: "de" },
  { name: "Chinese", code: "zh" },
];

export function resolveLanguage(target: string | TranslationLanguage): TranslationLanguage {
  if (typeof target !== "string") return target;
  const needle = target.trim().toLowerCase();
  return (
    TRANSLATION_LANGUAGES.find(
      (l) => l.name.toLowerCase() === needle || l.code.toLowerCase() === needle,
    ) ?? { name: target, code: needle.slice(0, 2) }
  );
}

/** Raw LibreTranslate call. Throws on any non-OK response. */
export async function translateLibre(
  text: string,
  targetCode: string,
  sourceCode = "auto",
): Promise<string> {
  const res = await fetch(`${LIBRETRANSLATE_CONFIG.url}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: sourceCode,
      target: targetCode,
      format: "text",
      ...(LIBRETRANSLATE_CONFIG.apiKey ? { api_key: LIBRETRANSLATE_CONFIG.apiKey } : {}),
    }),
  });
  if (!res.ok) throw new Error(`LibreTranslate ${res.status}`);
  const data = (await res.json()) as { translatedText?: string };
  const out = String(data?.translatedText ?? "").trim();
  if (!out) throw new Error("LibreTranslate returned an empty translation");
  return out;
}

/** Lovable AI translation (server-side gateway call). Throws on failure. */
export async function translateAi(text: string, targetLanguage: string): Promise<string> {
  const [out] = await translateAiMany([text], targetLanguage);
  const value = String(out ?? "").trim();
  if (!value) throw new Error("AI translation returned an empty result");
  return value;
}

/** Batch variant: one round-trip for a whole feed. */
export async function translateAiMany(texts: string[], targetLanguage: string): Promise<string[]> {
  const { translateTexts } = await import("./translation.functions");
  const res = await translateTexts({ data: { texts, targetLanguage } });
  return res.translations;
}

export type TranslationResult = {
  /** The text the caller passed in, preserved so UIs can show both. */
  original: string;
  /** Translated text (falls back to the original when translation fails). */
  translated: string;
  targetLanguage: string;
  /** True when Puter could not be reached and the original is shown instead. */
  failed: boolean;
};

export const TRANSLATION_FALLBACK_MESSAGE = "Translation unavailable, please try again.";

type PuterChatPart = { text?: string };
type PuterChatResponse =
  | string
  | { message?: { content?: string }; text?: string; toString(): string }
  | AsyncIterable<PuterChatPart>;

type PuterGlobal = {
  ai: {
    chat: (
      prompt: string,
      options?: { model?: string; stream?: boolean },
    ) => Promise<PuterChatResponse>;
  };
};

declare global {
  interface Window {
    puter?: PuterGlobal;
  }
}

let loader: Promise<PuterGlobal> | null = null;

/** Loads the Puter.js script once, lazily, on first translation. */
function loadPuter(): Promise<PuterGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Translation is only available in the browser"));
  }
  if (window.puter) return Promise.resolve(window.puter);
  if (loader) return loader;

  loader = new Promise<PuterGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PUTER_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (window.puter) resolve(window.puter);
      else reject(new Error("Puter.js loaded without an AI client"));
    };
    script.addEventListener("load", onLoad);
    script.addEventListener("error", () =>
      reject(new Error("Could not load the translation engine")),
    );
    if (!existing) {
      script.src = PUTER_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((err) => {
    loader = null;
    throw err;
  });

  return loader;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<PuterChatPart> {
  return (
    Boolean(value) &&
    typeof (value as AsyncIterable<PuterChatPart>)[Symbol.asyncIterator] === "function"
  );
}

function readText(value: PuterChatResponse): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as { message?: { content?: string }; text?: string };
    if (typeof obj.message?.content === "string") return obj.message.content;
    if (typeof obj.text === "string") return obj.text;
  }
  return String(value ?? "");
}

/** identical text + language pairs are never re-translated. */
const cache = new Map<string, string>();
const MAX_CACHE = 200;

function cacheKey(text: string, target: string) {
  return `${target}::${text}`;
}

function remember(key: string, value: string) {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, value);
}

/**
 * Translate arbitrary text (auto-detects the source language) into
 * `targetLanguage`. Never throws: on failure it returns the original text with
 * `failed: true` so the view keeps rendering.
 */
export async function translate(
  text: string,
  targetLanguage: string | TranslationLanguage = "English",
  options: { stream?: boolean; onPartial?: (soFar: string) => void } = {},
): Promise<TranslationResult> {
  const lang = resolveLanguage(targetLanguage);
  const original = String(text ?? "").trim();
  if (!original) {
    return { original: "", translated: "", targetLanguage: lang.name, failed: false };
  }

  const key = cacheKey(original, lang.name);
  const cached = cache.get(key);
  if (cached !== undefined) {
    options.onPartial?.(cached);
    return { original, translated: cached, targetLanguage: lang.name, failed: false };
  }

  const prompt = [
    `Translate the text below into ${lang.name}.`,
    "It may mix languages or slang. Keep handles, hashtags and links unchanged, and keep the original tone.",
    "Output only the translated text - no explanations, comments, or additional notes:",
    "",
    original,
  ].join("\n");

  const served = (engine: string) => {
    if (LIBRETRANSLATE_CONFIG.debug) console.info(`[translation] served by ${engine}`);
  };

  // 1) Lovable AI — one server round-trip, no third-party auth popup, fastest.
  try {
    const translated = await translateAi(original, lang.name);
    remember(key, translated);
    options.onPartial?.(translated);
    served("lovable-ai");
    return { original, translated, targetLanguage: lang.name, failed: false };
  } catch {
    // fall through to Puter
  }

  try {
    const puter = await loadPuter();
    const response = await puter.ai.chat(prompt, {
      model: TRANSLATION_MODEL,
      stream: Boolean(options.stream),
    });

    let out = "";
    if (isAsyncIterable(response)) {
      for await (const part of response) {
        out += part?.text ?? "";
        options.onPartial?.(out);
      }
    } else {
      out = readText(response);
      options.onPartial?.(out);
    }

    const translated = out.trim();
    if (!translated) throw new Error("Empty translation");
    remember(key, translated);
    served("puter");
    return { original, translated, targetLanguage: lang.name, failed: false };
  } catch {
    // Puter failed (error, dismissed auth popup, network, or empty result).
    // LibreTranslate does not stream: emit the full string in one go.
    try {
      const translated = await translateLibre(original, lang.code);
      remember(key, translated);
      options.onPartial?.(translated);
      served("libretranslate");
      return { original, translated, targetLanguage: lang.name, failed: false };
    } catch {
      options.onPartial?.(original);
      return { original, translated: original, targetLanguage: lang.name, failed: true };
    }
  }
}
