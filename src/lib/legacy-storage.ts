/**
 * Reads a localStorage value from its current key, falling back to the
 * pre-SMAIT-rebrand key so existing users don't lose local drafts and
 * preferences after the storage-key rename. Write paths only ever target
 * the current key, so usage naturally migrates forward.
 */
export function readWithLegacyKey(key: string, legacyKey: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key) ?? window.localStorage.getItem(legacyKey);
  } catch {
    return null;
  }
}
