/**
 * Motion-aware scrolling helpers.
 * Anyone who has "Reduce motion" enabled gets an instant jump instead of an animation.
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

export function scrollElementIntoView(
  el: Element | null | undefined,
  block: ScrollLogicalPosition = "center",
) {
  if (!el) return;
  el.scrollIntoView({ behavior: scrollBehavior(), block });
}

/** Scroll to an element by id and move keyboard focus to it. */
export function scrollToId(id: string, block: ScrollLogicalPosition = "start") {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  scrollElementIntoView(el, block);
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  (el as HTMLElement).focus({ preventScroll: true });
}

export function scrollToTop() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: scrollBehavior() });
}
