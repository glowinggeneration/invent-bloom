import { useState, type ReactNode } from "react";
import { ExternalLink, Languages, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { translate as translateText, TRANSLATION_FALLBACK_MESSAGE } from "@/lib/translation";
import { detectTone, TONE_STYLE, type ToneLabel } from "@/lib/tone";
import { readablePostText } from "@/lib/tweet-text";

/** Absolute stamp like the native post footer: 8:49 PM · Aug 6, 2026 */
export function formatPostStamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${time} · ${date}`;
}

export type PostMetric = { label: string; value: number };

/**
 * The native-X style post card used on Mentions, reused wherever we show a
 * published post or reply. Same shape as Mentions, minus the reply button and
 * sentiment: outbound posts get a tone read instead.
 */
export function PostCard({
  author,
  text,
  url,
  replyTo,
  quote,
  stamp,
  metrics = [],
  tone,
  badges,
  footer,
  translatable = true,
  className = "",
}: {
  author: ReactNode;
  text: string;
  url?: string | null | undefined;
  replyTo?: ReactNode | undefined;
  quote?: { name?: string | null | undefined; text: string } | null | undefined;
  stamp?: string | null | undefined;
  metrics?: PostMetric[] | undefined;
  tone?: ToneLabel | undefined;
  badges?: ReactNode | undefined;
  footer?: ReactNode | undefined;
  translatable?: boolean | undefined;
  className?: string | undefined;
}) {
  const [translation, setTranslation] = useState<{ text: string; language: string } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const body = readablePostText(text);
  const toneLabel = tone ?? detectTone(body);
  const shownMetrics = metrics.filter((m) => m.value > 0);

  async function handleTranslate() {
    if (translation) {
      setTranslation(null);
      return;
    }
    setTranslating(true);
    setTranslateError(null);
    const res = await translateText(body, "English", {
      stream: true,
      onPartial: (soFar) => setTranslation({ text: soFar, language: "English" }),
    });
    if (res.failed) {
      setTranslation(null);
      setTranslateError(TRANSLATION_FALLBACK_MESSAGE);
    } else {
      setTranslation({ text: res.translated, language: "English" });
    }
    setTranslating(false);
  }

  return (
    <div
      className={`group rounded-2xl border border-border bg-background p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border/80 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background sm:p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{author}</div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="View on X"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>

      {replyTo ? <div className="mt-2 type-meta text-muted-foreground">{replyTo}</div> : null}

      {quote?.text ? (
        <blockquote className="mt-2 rounded-lg border-l-2 border-border bg-muted/40 px-3 py-2 type-meta text-muted-foreground">
          {quote.name ? <span className="font-medium text-foreground">{quote.name}</span> : null}{" "}
          <span className="line-clamp-3 whitespace-pre-wrap break-words">
            {readablePostText(quote.text)}
          </span>
        </blockquote>
      ) : null}

      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">
        {body || "(no text)"}
      </p>

      {translatable && body ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => void handleTranslate()}
            disabled={translating}
            aria-label={translation ? "Hide translation" : "Translate post to English"}
            title={translation ? "Hide translation" : "Translate to English"}
          >
            {translating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Languages className="size-4" aria-hidden="true" />
            )}
          </Button>
          {translating ? (
            <span className="type-meta text-muted-foreground">Translating…</span>
          ) : translation ? (
            <span className="type-meta text-muted-foreground">English translation</span>
          ) : null}
        </div>
      ) : null}

      {translation ? (
        <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-muted/60 p-3 text-[15px] leading-relaxed text-foreground">
          {translation.text}
        </p>
      ) : null}
      {translateError ? <p className="mt-2 type-meta text-destructive">{translateError}</p> : null}

      {stamp || shownMetrics.length > 0 ? (
        <p className="mt-3 type-meta text-muted-foreground">
          {stamp}
          {shownMetrics.map((m) => (
            <span key={m.label}>
              {stamp || m !== shownMetrics[0] ? " · " : ""}
              <span className="font-semibold text-foreground">{m.value.toLocaleString()}</span>{" "}
              {m.label}
            </span>
          ))}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${TONE_STYLE[toneLabel]}`}
          title="Tone of this post"
        >
          {toneLabel}
        </span>
        {badges}
      </div>

      {footer}
    </div>
  );
}
