import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "signals", label: "Momentum & issues" },
  { id: "intelligence", label: "What this means" },
  { id: "brief", label: "What changed" },
  { id: "official", label: "Official posts" },
  { id: "accounts", label: "Who's shaping it" },
  { id: "topics", label: "Trending topics" },
  { id: "sources", label: "Top sources" },
] as const;

/** Sticky jump nav so the deeper Overview sections are reachable from the top. */
export function OverviewSectionNav() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      Boolean,
    ) as HTMLElement[];
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Overview sections"
      className="sticky top-2 z-20 -mx-1 overflow-x-auto rounded-full border border-border bg-background/85 px-1.5 py-1.5 backdrop-blur"
    >
      <ul className="flex min-w-max items-center gap-1">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              onClick={(event) => {
                event.preventDefault();
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActive(section.id);
              }}
              className={
                active === section.id
                  ? "block rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  : "block rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
              }
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
