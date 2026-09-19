import { ArrowUp, FileText, Loader2, Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { extractFile, type ExtractedFile } from "@/lib/extract-file";
import { clearComposerDraft, loadComposerDraft, saveComposerDraft } from "@/lib/composer-draft";
import { friendlyError } from "@/lib/friendly-errors";
import { cn } from "@/lib/utils";

export type ComposerPayload = {
  text: string;
  imageDataUrl: string | null;
  attachments: { name: string; excerpt: string }[];
};

const ACCEPT = "image/*,.pdf,.docx,.xlsx,.xls,.csv,.txt,.md";

export function Composer({
  onSubmit,
  pending,
  placeholder = "Paste the message you want to test…",
  autoFocus = true,
  chips,
  onStateChange,
  prefill,
  focusToken,
  runToken,
  draftKey,
  variant = "default",
}: {
  onSubmit: (payload: ComposerPayload) => void;
  pending: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  chips?: { label: string; text: string }[];
  onStateChange?: (state: {
    hasText: boolean;
    hasImage: boolean;
    hasDocument: boolean;
    textLength: number;
  }) => void;
  /** Text pushed into the composer from outside (e.g. "Use example message"). */
  prefill?: { text: string; token: number } | null;
  /** Bump to move keyboard focus into the composer from outside. */
  focusToken?: number;
  /** Bump to submit the composer from outside (e.g. checklist "Run analysis"). */
  runToken?: number;
  /** When set, text + attachments survive navigation via sessionStorage. */
  draftKey?: string;
  /** "hero" renders the large glowing dark composer used on Response Studio. */
  variant?: "default" | "hero";
}) {
  const hero = variant === "hero";
  const restored = useRef(loadComposerDraft(draftKey ?? "")).current;
  const [text, setText] = useState(restored?.text ?? "");
  const [files, setFiles] = useState<ExtractedFile[]>(restored?.files ?? []);
  const [reading, setReading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el && el.value) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (autoFocus && !pending) textareaRef.current?.focus();
  }, [autoFocus, pending]);

  useEffect(() => {
    if (!focusToken) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [focusToken]);

  useEffect(() => {
    if (!prefill?.text) return;
    setText(prefill.text);
    const el = textareaRef.current;
    if (el) {
      el.focus();
      requestAnimationFrame(() => {
        el.setSelectionRange(el.value.length, el.value.length);
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      });
    }
  }, [prefill?.token, prefill?.text]);

  useEffect(() => {
    onStateChange?.({
      hasText: text.trim().length > 0,
      hasImage: files.some((f) => f.kind === "image"),
      hasDocument: files.some((f) => f.kind === "document"),
      textLength: text.trim().length,
    });
  }, [text, files, onStateChange]);

  useEffect(() => {
    if (!draftKey) return;
    saveComposerDraft(draftKey, { text, files });
  }, [draftKey, text, files]);

  function applyChip(chipText: string) {
    setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${chipText}` : chipText));
    textareaRef.current?.focus();
  }

  async function handleFiles(list: FileList) {
    setReading(true);
    for (const file of Array.from(list).slice(0, 5)) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`${file.name} is over 15MB. Choose a smaller file.`);
        continue;
      }
      try {
        const extracted = await extractFile(file);
        setFiles((prev) => [...prev.filter((f) => f.name !== extracted.name), extracted]);
      } catch (error) {
        toast.error(friendlyError(error, { action: `read ${file.name}` }));
      }
    }
    setReading(false);
  }

  function submit() {
    if (pending || reading) return;
    const image = files.find((f) => f.kind === "image");
    const docs = files.filter((f) => f.kind === "document");
    if (!text.trim() && !docs.length) return;
    onSubmit({
      text: text.trim() || "Analyse the attached material.",
      imageDataUrl: image?.dataUrl ?? null,
      attachments: docs.map((d) => ({ name: d.name, excerpt: d.excerpt ?? "" })),
    });
    setText("");
    setFiles([]);
    if (draftKey) clearComposerDraft(draftKey);
  }

  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (!runToken) return;
    submitRef.current();
  }, [runToken]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-2 shadow-[0_2px_24px_-14px_oklch(0_0_0_/_0.5)]",
        hero &&
          "rounded-3xl border-white/10 bg-neutral-950 p-3 shadow-[0_0_50px_-12px] shadow-primary/30 ring-1 ring-primary/15 transition-shadow duration-300 focus-within:shadow-primary/50 focus-within:ring-primary/30",
      )}
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 p-1">
          {files.map((file) => (
            <div key={file.name} className="relative">
              {file.kind === "image" ? (
                <img
                  src={file.dataUrl}
                  alt={file.name}
                  className={cn(
                    "h-24 w-auto rounded-xl border border-border object-cover",
                    hero && "border-white/10",
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "flex max-w-52 items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5",
                    hero && "border-white/10 bg-white/5",
                  )}
                >
                  <FileText className="size-4 shrink-0 text-primary" />
                  <span
                    className={cn("min-w-0 truncate text-xs text-foreground", hero && "text-white")}
                  >
                    {file.name}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((f) => f.name !== file.name))}
                aria-label={`Remove ${file.name}`}
                className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        placeholder={placeholder}
        className={cn(
          "w-full resize-none bg-transparent px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground",
          hero && "px-4 py-3 text-lg text-white caret-primary placeholder:text-white/40",
        )}
      />
      {chips && chips.length > 0 && (
        <div
          className={cn("border-t border-border/70 px-2 pb-1.5 pt-2", hero && "border-white/10")}
        >
          <p
            className={cn(
              "mb-1.5 px-1 type-meta font-medium text-muted-foreground",
              hero && "text-white/50",
            )}
          >
            Refine your message
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Message refinements">
            {chips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => applyChip(chip.text)}
                className={cn(
                  "rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  hero &&
                    "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 rounded-full text-muted-foreground",
              hero && "text-white/60 hover:bg-white/10 hover:text-white",
            )}
            onClick={() => fileRef.current?.click()}
            disabled={reading}
          >
            {reading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Paperclip className="size-4" />
            )}
            <span className="hidden sm:inline">
              {reading ? "Reading files…" : "Attach image, PDF, Word or Excel"}
            </span>
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          className={cn(
            "shrink-0 gap-1.5 rounded-full px-3.5",
            hero && "shadow-[0_0_20px_-4px] shadow-primary/60",
          )}
          disabled={
            pending || reading || (!text.trim() && !files.some((f) => f.kind === "document"))
          }
          onClick={submit}
          aria-label="Test message"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          <span>{pending ? "Testing…" : "Test message"}</span>
        </Button>
      </div>
    </div>
  );
}
