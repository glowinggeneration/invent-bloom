/**
 * Content-language guards used by monitored public feeds.
 *
 * FKF's operational listening brief excludes Chinese-script content. This
 * intentionally checks the visible text only and does not inspect handles,
 * URLs or metadata, which can legitimately contain CJK characters without the
 * actual mention being Chinese-language content.
 */
const CJK_SCRIPT = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u;

export function containsChineseScript(...parts: Array<string | null | undefined>): boolean {
  return parts.some((part) => Boolean(part && CJK_SCRIPT.test(part)));
}
