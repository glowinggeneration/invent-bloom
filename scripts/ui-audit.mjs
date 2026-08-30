#!/usr/bin/env node
/**
 * UI Quality Audit — static design-system linter.
 *
 * Checks every file under src/ against the design system defined in
 * src/styles.css and docs/DESIGN-QA.md, then classifies findings:
 *
 *   P0  Broken experience        (accessibility blockers, viewport bugs)
 *   P1  Major inconsistency      (raw colour values, non-token motion)
 *   P2  Noticeable polish issue  (arbitrary spacing / radius values)
 *   P3  Minor refinement         (nits worth cleaning up)
 *
 * Usage:
 *   node scripts/ui-audit.mjs            # human report
 *   node scripts/ui-audit.mjs --json     # machine readable
 *   node scripts/ui-audit.mjs --strict   # exit 1 when P0/P1 exist
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** Files the audit intentionally skips. */
const SKIP = [
  "src/components/ui/", // shadcn primitives — upstream owned
  "src/integrations/",
  "src/routeTree.gen.ts",
  "src/styles.css", // the token source itself
];

/** Approved spacing steps (px). Tailwind class numbers map to 4px units. */
const SPACE_SCALE = [0, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48, 56, 64];
/** Approved motion durations (ms). */
const MOTION_SCALE = [0, 120, 150, 160, 180, 200, 220, 240, 300, 320, 350, 420, 500, 700, 1000];

const RULES = [
  {
    id: "colour/raw-hex",
    severity: "P1",
    area: "Colour",
    hint: "Use a semantic token (text-foreground, bg-primary, var(--positive)) instead of a raw hex.",
    test: (line) => {
      const m = line.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (!m) return null;
      // Allow hex inside chart/pdf export code where a literal RGB is required.
      return m.join(", ");
    },
    allowFile: (f) => /pdf|chart-colors|brand-kit|og-image/.test(f),
  },
  {
    id: "colour/hardcoded-utility",
    severity: "P1",
    area: "Colour",
    hint: "Swap for tokens: text-foreground / text-muted-foreground / bg-card / border-border.",
    test: (line) => {
      const m = line.match(
        /\b(?:hover:|focus:|dark:|group-hover:)?(?:text|bg|border|fill|stroke)-(?:white|black|(?:gray|grey|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/g,
      );
      return m ? [...new Set(m)].join(", ") : null;
    },
  },
  {
    id: "colour/arbitrary-value",
    severity: "P1",
    area: "Colour",
    hint: "Arbitrary colour values bypass theming and dark mode.",
    test: (line) => {
      const m = line.match(/\b(?:text|bg|border|fill|stroke)-\[(?:#|rgb|hsl|oklch)[^\]]*\]/g);
      return m ? [...new Set(m)].join(", ") : null;
    },
  },
  {
    id: "spacing/arbitrary-value",
    severity: "P2",
    area: "Spacing",
    hint: `Round to the approved scale (${SPACE_SCALE.slice(1, 12).join(", ")} …).`,
    test: (line) => {
      const hits = [];
      for (const m of line.matchAll(
        /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y)-\[(\d+(?:\.\d+)?)px\]/g,
      )) {
        const px = Number(m[1]);
        if (!SPACE_SCALE.includes(px / 4) && !SPACE_SCALE.includes(px)) hits.push(m[0]);
      }
      return hits.length ? [...new Set(hits)].join(", ") : null;
    },
  },
  {
    id: "radius/arbitrary-value",
    severity: "P2",
    area: "Components",
    hint: "Use rounded-md / rounded-lg / rounded-xl / rounded-2xl / rounded-full.",
    test: (line) => {
      const m = line.match(/\brounded(?:-[trbl]{1,2})?-\[[^\]]+\]/g);
      return m ? [...new Set(m)].join(", ") : null;
    },
  },
  {
    id: "motion/off-scale-duration",
    severity: "P1",
    area: "Motion",
    hint: `Use --motion-fast (180ms), --motion-base (240ms), --motion-slow (350ms) or duration-{${MOTION_SCALE.slice(3, 9).join(",")}}.`,
    test: (line) => {
      const hits = [];
      for (const m of line.matchAll(/\bduration-(?:\[(\d+)ms\]|(\d+))\b/g)) {
        const ms = Number(m[1] ?? m[2]);
        if (!MOTION_SCALE.includes(ms)) hits.push(m[0]);
      }
      for (const m of line.matchAll(/transition(?:-duration)?:\s*(\d+)ms/g)) {
        if (!MOTION_SCALE.includes(Number(m[1]))) hits.push(m[0]);
      }
      return hits.length ? [...new Set(hits)].join(", ") : null;
    },
  },
  {
    id: "responsive/viewport-unit",
    severity: "P0",
    area: "Responsive",
    hint: "h-screen breaks under mobile browser chrome. Use h-dvh / min-h-dvh.",
    test: (line) => (/\b(?:min-|max-)?h-screen\b/.test(line) ? "h-screen" : null),
  },
  {
    id: "a11y/positive-tabindex",
    severity: "P0",
    area: "Accessibility",
    hint: "tabIndex > 0 breaks keyboard order. Use 0 or -1.",
    test: (line) => (/tabIndex=\{?\s*[1-9]/.test(line) ? "tabIndex" : null),
  },
  {
    id: "a11y/clickable-div",
    severity: "P0",
    area: "Accessibility",
    hint: "onClick on a div is invisible to keyboards. Use <button> or add role + onKeyDown.",
    test: (line, file, all, index) => {
      if (!/^\s*<(?:div|span|li)\b/.test(line)) return null;
      const block = all.slice(index, index + 6).join(" ");
      const open = block.split(">")[0] ?? "";
      if (!/onClick=/.test(open)) return null;
      if (/role=|asChild|tabIndex/.test(open)) return null;
      return "clickable non-interactive element";
    },
  },
  {
    id: "content/technical-copy",
    severity: "P3",
    area: "Copy",
    hint: "Use the friendly error voice from src/lib/friendly-errors.ts.",
    test: (line) => {
      if (!/(toast\.(error|warning)|<AlertDescription|placeholder=)/.test(line)) return null;
      const m = line.match(
        /"[^"]*\b(undefined|null|failed to fetch|Error:|500|RLS|exception|stack)\b[^"]*"/i,
      );
      return m ? m[0].slice(0, 60) : null;
    },
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full).replaceAll("\\", "/");
    if (SKIP.some((s) => rel.startsWith(s))) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry)) out.push(rel);
  }
  return out;
}

const findings = [];
for (const file of walk(SRC)) {
  const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    if (/ui-audit-ignore/.test(line)) return;
    for (const rule of RULES) {
      if (rule.allowFile?.(file)) continue;
      const detail = rule.test(line, file, lines, i);
      if (detail) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          area: rule.area,
          file,
          line: i + 1,
          detail,
          hint: rule.hint,
        });
      }
    }
  });
}

const order = ["P0", "P1", "P2", "P3"];
findings.sort(
  (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || a.file.localeCompare(b.file),
);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ total: findings.length, findings }, null, 2));
} else {
  const counts = Object.fromEntries(
    order.map((p) => [p, findings.filter((f) => f.severity === p).length]),
  );
  console.log("\nUI Quality Audit");
  console.log("================");
  console.log(order.map((p) => `${p} ${counts[p]}`).join("   "), `  (total ${findings.length})\n`);

  const byRule = new Map();
  for (const f of findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule).push(f);
  }
  for (const [rule, list] of byRule) {
    console.log(`${list[0].severity}  ${rule}  (${list.length})  — ${list[0].hint}`);
    for (const f of list.slice(0, 8)) console.log(`      ${f.file}:${f.line}  ${f.detail}`);
    if (list.length > 8) console.log(`      … ${list.length - 8} more`);
    console.log("");
  }
  console.log("Fix the shared component, not the page.\n");
}

if (
  process.argv.includes("--strict") &&
  findings.some((f) => f.severity === "P0" || f.severity === "P1")
) {
  process.exit(1);
}
