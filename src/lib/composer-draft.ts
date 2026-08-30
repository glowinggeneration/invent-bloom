import type { ExtractedFile } from "@/lib/extract-file";

export type ComposerDraft = {
  text: string;
  files: ExtractedFile[];
};

/** Shared key for the message-testing composer draft. */
export const TESTING_DRAFT_KEY = "fkf.testing.draft";

/** Rough cap so a huge image data URL never blows the storage quota. */
const MAX_BYTES = 4_000_000;

export function loadComposerDraft(key: string): ComposerDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ComposerDraft>;
    const text = typeof parsed.text === "string" ? parsed.text : "";
    const files = Array.isArray(parsed.files)
      ? (parsed.files.filter(
          (f) => f && typeof (f as ExtractedFile).name === "string",
        ) as ExtractedFile[])
      : [];
    if (!text && files.length === 0) return null;
    return { text, files };
  } catch {
    return null;
  }
}

export function saveComposerDraft(key: string, draft: ComposerDraft) {
  if (typeof window === "undefined") return;
  try {
    if (!draft.text && draft.files.length === 0) {
      window.sessionStorage.removeItem(key);
      return;
    }
    let payload = JSON.stringify(draft);
    if (payload.length > MAX_BYTES) {
      // Drop attachment payloads (image data URLs / excerpts) but keep the text.
      payload = JSON.stringify({ text: draft.text, files: [] });
    }
    window.sessionStorage.setItem(key, payload);
  } catch {
    /* storage full or unavailable - drafting is best effort */
  }
}

export function clearComposerDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
