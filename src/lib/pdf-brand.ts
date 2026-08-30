/**
 * Branded PDF kit.
 *
 * Every export in the platform (report builder, crisis brief, campaign proof,
 * overview) draws through this so the documents look like one family: FKF
 * colours, the federation crest, real charts and a consistent footer.
 *
 * Units are millimetres on A4 portrait.
 */

import { jsPDF } from "jspdf";

export type RGB = [number, number, number];

export const BRAND = {
  red: [196, 30, 46] as RGB,
  redSoft: [252, 232, 234] as RGB,
  green: [16, 122, 70] as RGB,
  greenSoft: [230, 245, 237] as RGB,
  amber: [193, 128, 20] as RGB,
  amberSoft: [253, 243, 224] as RGB,
  ink: [17, 17, 20] as RGB,
  body: [70, 70, 78] as RGB,
  muted: [122, 122, 132] as RGB,
  line: [226, 226, 232] as RGB,
  soft: [246, 247, 249] as RGB,
  white: [255, 255, 255] as RGB,
};

export const CHART_COLORS: RGB[] = [
  BRAND.red,
  BRAND.green,
  [30, 64, 124],
  BRAND.amber,
  [104, 62, 148],
  [20, 20, 24],
];

/** Fetches the crest once so covers can carry it without blocking the export. */
export async function loadBrandLogo(url = "/fkf-logo.png"): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function shorten(n: number) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return Math.round(v).toLocaleString("en-KE");
}

export class BrandPdf {
  readonly doc: jsPDF;
  readonly width: number;
  readonly height: number;
  readonly margin = 16;
  y = 22;
  private logo: string | null = null;

  constructor() {
    this.doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    this.width = this.doc.internal.pageSize.getWidth();
    this.height = this.doc.internal.pageSize.getHeight();
  }

  get contentWidth() {
    return this.width - this.margin * 2;
  }

  /** Thin FKF colour band that tops every page. */
  private pageFurniture() {
    const { doc, width } = this;
    doc.setFillColor(...BRAND.red);
    doc.rect(0, 0, width * 0.62, 2.6, "F");
    doc.setFillColor(...BRAND.green);
    doc.rect(width * 0.62, 0, width * 0.28, 2.6, "F");
    doc.setFillColor(...BRAND.ink);
    doc.rect(width * 0.9, 0, width * 0.1, 2.6, "F");
  }

  newPage() {
    this.doc.addPage();
    this.pageFurniture();
    this.y = 22;
  }

  ensure(needed = 20) {
    if (this.y + needed <= this.height - 18) return;
    this.newPage();
  }

  /** Full-width cover block with crest, title and reporting period. */
  async cover(input: {
    title: string;
    subtitle?: string | undefined;
    periodLabel?: string | undefined;
    generatedAt?: string | Date | null | undefined;
  }) {
    const { doc, width, margin } = this;
    this.logo = await loadBrandLogo();
    this.pageFurniture();

    doc.setFillColor(...BRAND.soft);
    doc.rect(0, 2.6, width, 52, "F");
    doc.setFillColor(...BRAND.red);
    doc.rect(0, 2.6, 3.2, 52, "F");

    let textLeft = margin;
    if (this.logo) {
      try {
        doc.addImage(this.logo, "PNG", margin, 10, 17, 17);
        textLeft = margin + 22;
      } catch {
        /* the report still reads without the crest */
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.red);
    doc.text("FOOTBALL KENYA FEDERATION", textLeft, 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND.muted);
    doc.text("CommsIQ · Powered by Persona_Voices", textLeft, 20);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.setTextColor(...BRAND.ink);
    const titleLines = doc.splitTextToSize(
      input.title || "Communications report",
      this.contentWidth,
    ) as string[];
    let ty = 34;
    for (const line of titleLines.slice(0, 2)) {
      doc.text(line, margin, ty);
      ty += 8;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...BRAND.body);
    const stamp = input.generatedAt ? new Date(input.generatedAt) : new Date();
    const meta = [
      input.periodLabel,
      `Generated ${stamp.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}`,
    ]
      .filter(Boolean)
      .join("  ·  ");
    doc.text(meta, margin, Math.min(ty + 1, 50));

    this.y = 64;
    if (input.subtitle) this.paragraph(input.subtitle);
  }

  heading(text: string) {
    this.ensure(18);
    const { doc, margin } = this;
    this.y += 3;
    doc.setFillColor(...BRAND.red);
    doc.rect(margin, this.y - 3.6, 1.8, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...BRAND.ink);
    doc.text(text, margin + 4.5, this.y);
    this.y += 3.4;
    doc.setDrawColor(...BRAND.line);
    doc.setLineWidth(0.2);
    doc.line(margin, this.y, this.width - margin, this.y);
    this.y += 6;
  }

  paragraph(text: string, size = 9.5) {
    if (!text) return;
    const { doc, margin } = this;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, this.contentWidth) as string[];
    this.ensure(lines.length * 4.8 + 3);
    doc.setTextColor(...BRAND.body);
    doc.text(lines, margin, this.y);
    this.y += lines.length * 4.8 + 3;
  }

  bullet(text: string, color: RGB = BRAND.red) {
    const { doc, margin } = this;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(text, this.contentWidth - 6) as string[];
    this.ensure(lines.length * 4.5 + 2);
    doc.setFillColor(...color);
    doc.circle(margin + 1.2, this.y - 1.2, 0.9, "F");
    doc.setTextColor(...BRAND.body);
    doc.text(lines, margin + 5, this.y);
    this.y += lines.length * 4.5 + 2;
  }

  /** Coloured KPI tiles, three per row. */
  statCards(
    items: { label: string; value: string; hint?: string; tone?: "red" | "green" | "ink" }[],
  ) {
    if (!items.length) return;
    const { doc, margin } = this;
    const perRow = 3;
    const gap = 4;
    const cardW = (this.contentWidth - gap * (perRow - 1)) / perRow;
    const cardH = 21;
    const rows = Math.ceil(items.length / perRow);
    this.ensure(rows * (cardH + gap) + 2);

    items.forEach((item, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = margin + col * (cardW + gap);
      const top = this.y + row * (cardH + gap);
      const accent =
        item.tone === "green" ? BRAND.green : item.tone === "ink" ? BRAND.ink : BRAND.red;

      doc.setFillColor(...BRAND.soft);
      doc.roundedRect(x, top, cardW, cardH, 1.8, 1.8, "F");
      doc.setFillColor(...accent);
      doc.rect(x, top, 1.4, cardH, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.4);
      doc.setTextColor(...BRAND.muted);
      doc.text(item.label.toUpperCase(), x + 4.5, top + 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...BRAND.ink);
      doc.text(item.value, x + 4.5, top + 13.5);
      if (item.hint) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.setTextColor(...BRAND.muted);
        const hint = (doc.splitTextToSize(item.hint, cardW - 8) as string[])[0] ?? "";
        doc.text(hint, x + 4.5, top + 18);
      }
    });

    this.y += rows * (cardH + gap) + 2;
  }

  /** Horizontal bars, good for shares, rankings and sentiment splits. */
  barChart(
    title: string,
    rows: { label: string; value: number; color?: RGB }[],
    opts: { suffix?: string; max?: number; format?: (value: number) => string } = {},
  ) {
    const data = rows.filter((r) => Number.isFinite(r.value));
    if (!data.length) return;
    const { doc, margin } = this;
    const labelW = 46;
    const valueW = 20;
    const trackW = this.contentWidth - labelW - valueW - 8;
    const max = opts.max ?? Math.max(...data.map((r) => Math.abs(r.value)), 1);
    const fmt = opts.format ?? ((v: number) => `${shorten(v)}${opts.suffix ?? ""}`);

    this.ensure(data.length * 7 + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.ink);
    doc.text(title, margin, this.y);
    this.y += 5;

    data.forEach((rowItem, i) => {
      this.ensure(9);
      const top = this.y;
      const color = rowItem.color ?? CHART_COLORS[i % CHART_COLORS.length]!;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.body);
      const label = (doc.splitTextToSize(rowItem.label, labelW - 2) as string[])[0] ?? "";
      doc.text(label, margin, top + 3.4);

      doc.setFillColor(...BRAND.line);
      doc.roundedRect(margin + labelW, top, trackW, 4.6, 2.3, 2.3, "F");
      const ratio = max > 0 ? Math.max(0, Math.min(1, Math.abs(rowItem.value) / max)) : 0;
      if (ratio > 0) {
        doc.setFillColor(...color);
        doc.roundedRect(margin + labelW, top, Math.max(2.4, trackW * ratio), 4.6, 2.3, 2.3, "F");
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.ink);
      doc.text(fmt(rowItem.value), this.width - margin, top + 3.4, { align: "right" });
      this.y += 7;
    });
    this.y += 7;
  }

  /** Vertical columns for day-by-day volume. */
  columnChart(title: string, points: { label: string; value: number }[], color: RGB = BRAND.red) {
    const data = points.filter((p) => Number.isFinite(p.value));
    if (!data.length) return;
    const { doc, margin } = this;
    const h = 34;
    this.ensure(h + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.ink);
    doc.text(title, margin, this.y);
    this.y += 4;

    const top = this.y;
    const w = this.contentWidth;
    const max = Math.max(...data.map((p) => p.value), 1);

    doc.setDrawColor(...BRAND.line);
    doc.setLineWidth(0.15);
    for (let g = 0; g <= 3; g++) {
      const gy = top + (h / 3) * g;
      doc.line(margin, gy, margin + w, gy);
    }

    const gap = data.length > 40 ? 0.4 : 1.4;
    const bw = Math.max(0.8, (w - gap * (data.length + 1)) / data.length);
    data.forEach((p, i) => {
      const bh = Math.max(0.6, (p.value / max) * (h - 1));
      doc.setFillColor(...color);
      doc.rect(margin + gap + i * (bw + gap), top + h - bh, bw, bh, "F");
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...BRAND.muted);
    doc.text(shorten(max), margin, top - 0.6);
    const first = data[0]?.label ?? "";
    const last = data[data.length - 1]?.label ?? "";
    doc.text(first, margin, top + h + 4);
    if (last && last !== first) doc.text(last, margin + w, top + h + 4, { align: "right" });
    this.y = top + h + 12;
  }

  /** Filled trend line, used for reach / confidence over time. */
  lineChart(title: string, points: { label: string; value: number }[], color: RGB = BRAND.green) {
    const data = points.filter((p) => Number.isFinite(p.value));
    if (data.length < 2) return;
    const { doc, margin } = this;
    const h = 34;
    this.ensure(h + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.ink);
    doc.text(title, margin, this.y);
    this.y += 4;

    const top = this.y;
    const w = this.contentWidth;
    const values = data.map((p) => p.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = Math.max(1, max - min);

    doc.setDrawColor(...BRAND.line);
    doc.setLineWidth(0.15);
    for (let g = 0; g <= 3; g++) doc.line(margin, top + (h / 3) * g, margin + w, top + (h / 3) * g);

    const xy = data.map((p, i) => ({
      x: margin + (i / (data.length - 1)) * w,
      y: top + h - ((p.value - min) / span) * (h - 2) - 1,
    }));

    // Soft area under the line.
    doc.setFillColor(...color);
    doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
    for (let i = 1; i < xy.length; i++) {
      const a = xy[i - 1]!;
      const b = xy[i]!;
      doc.triangle(a.x, a.y, b.x, b.y, a.x, top + h, "F");
      doc.triangle(b.x, b.y, b.x, top + h, a.x, top + h, "F");
    }
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    doc.setDrawColor(...color);
    doc.setLineWidth(0.7);
    for (let i = 1; i < xy.length; i++) doc.line(xy[i - 1]!.x, xy[i - 1]!.y, xy[i]!.x, xy[i]!.y);
    const lastPoint = xy[xy.length - 1]!;
    doc.setFillColor(...color);
    doc.circle(lastPoint.x, lastPoint.y, 0.9, "F");
    doc.setLineWidth(0.2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...BRAND.muted);
    doc.text(shorten(max), margin, top - 0.6);
    doc.text(data[0]?.label ?? "", margin, top + h + 4);
    doc.text(data[data.length - 1]?.label ?? "", margin + w, top + h + 4, { align: "right" });
    this.y = top + h + 12;
  }

  /** Donut with a legend, used for sentiment and source mixes. */
  donut(title: string, slices: { label: string; value: number; color?: RGB }[]) {
    const data = slices.filter((s) => Number(s.value) > 0);
    if (!data.length) return;
    const { doc, margin } = this;
    const size = 34;
    this.ensure(size + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.ink);
    doc.text(title, margin, this.y);
    this.y += 4;

    const cx = margin + size / 2;
    const cy = this.y + size / 2;
    const r = size / 2;
    const total = data.reduce((n, s) => n + s.value, 0) || 1;

    let angle = -Math.PI / 2;
    data.forEach((slice, i) => {
      const color = slice.color ?? CHART_COLORS[i % CHART_COLORS.length]!;
      const sweep = (slice.value / total) * Math.PI * 2;
      const steps = Math.max(2, Math.ceil((sweep / (Math.PI * 2)) * 96));
      doc.setFillColor(...color);
      for (let s = 0; s < steps; s++) {
        const a1 = angle + (sweep * s) / steps;
        const a2 = angle + (sweep * (s + 1)) / steps;
        doc.triangle(
          cx,
          cy,
          cx + r * Math.cos(a1),
          cy + r * Math.sin(a1),
          cx + r * Math.cos(a2),
          cy + r * Math.sin(a2),
          "F",
        );
      }
      angle += sweep;
    });

    // Punch the middle out so it reads as a donut.
    doc.setFillColor(...BRAND.white);
    doc.circle(cx, cy, r * 0.58, "F");

    let ly = this.y + 6;
    data.forEach((slice, i) => {
      const color = slice.color ?? CHART_COLORS[i % CHART_COLORS.length]!;
      doc.setFillColor(...color);
      doc.roundedRect(margin + size + 8, ly - 2.4, 3, 3, 0.6, 0.6, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4);
      doc.setTextColor(...BRAND.body);
      doc.text(slice.label, margin + size + 13, ly);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND.ink);
      doc.text(`${Math.round((slice.value / total) * 100)}%`, this.width - margin, ly, {
        align: "right",
      });
      ly += 6;
    });

    this.y = Math.max(this.y + size, ly) + 9;
  }

  /** Banded table with a coloured header row. */
  table(headers: string[], rows: string[][], widths?: number[]) {
    if (!rows.length) return;
    const { doc, margin } = this;
    const cols = headers.length;
    const w = widths ?? Array.from({ length: cols }, () => this.contentWidth / cols);
    const rowH = 7;
    this.ensure(rowH * 2 + 4);

    const drawHeader = () => {
      doc.setFillColor(...BRAND.ink);
      doc.rect(margin, this.y, this.contentWidth, rowH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.8);
      doc.setTextColor(...BRAND.white);
      let x = margin;
      headers.forEach((head, i) => {
        const right = i > 0;
        doc.text(head.toUpperCase(), right ? x + w[i]! - 2.5 : x + 2.5, this.y + 4.7, {
          align: right ? "right" : "left",
        });
        x += w[i]!;
      });
      this.y += rowH;
    };

    drawHeader();
    rows.forEach((cells, rIdx) => {
      if (this.y + rowH > this.height - 18) {
        this.newPage();
        drawHeader();
      }
      if (rIdx % 2 === 1) {
        doc.setFillColor(...BRAND.soft);
        doc.rect(margin, this.y, this.contentWidth, rowH, "F");
      }
      let x = margin;
      cells.forEach((cell, i) => {
        const right = i > 0;
        doc.setFont("helvetica", right ? "bold" : "normal");
        doc.setFontSize(8.2);
        doc.setTextColor(...(right ? BRAND.ink : BRAND.body));
        const text = (doc.splitTextToSize(cell, w[i]! - 5) as string[])[0] ?? "";
        doc.text(text, right ? x + w[i]! - 2.5 : x + 2.5, this.y + 4.7, {
          align: right ? "right" : "left",
        });
        x += w[i]!;
      });
      this.y += rowH;
    });
    this.y += 5;
  }

  /** Tinted panel for recommendations, risks and headline reads. */
  callout(title: string, body: string, tone: "red" | "green" | "amber" = "green") {
    const { doc, margin } = this;
    const accent = tone === "red" ? BRAND.red : tone === "amber" ? BRAND.amber : BRAND.green;
    const fill =
      tone === "red" ? BRAND.redSoft : tone === "amber" ? BRAND.amberSoft : BRAND.greenSoft;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(body, this.contentWidth - 12) as string[];
    const boxH = lines.length * 4.6 + 13;
    this.ensure(boxH + 4);
    doc.setFillColor(...fill);
    doc.roundedRect(margin, this.y, this.contentWidth, boxH, 2, 2, "F");
    doc.setFillColor(...accent);
    doc.rect(margin, this.y, 1.6, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...accent);
    doc.text(title, margin + 6, this.y + 6.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.body);
    doc.text(lines, margin + 6, this.y + 11.5);
    this.y += boxH + 5;
  }

  note(text: string) {
    const { doc, margin } = this;
    this.ensure(14);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.6);
    doc.setTextColor(...BRAND.muted);
    const lines = doc.splitTextToSize(text, this.contentWidth) as string[];
    doc.text(lines, margin, this.y);
    this.y += lines.length * 3.8 + 2;
  }

  /** Footer with the brand lockup and page numbers, applied to every page. */
  private finish() {
    const { doc, width, height, margin } = this;
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...BRAND.line);
      doc.setLineWidth(0.2);
      doc.line(margin, height - 13, width - margin, height - 13);
      doc.setFillColor(...BRAND.red);
      doc.circle(margin + 1.2, height - 9.4, 1.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.4);
      doc.setTextColor(...BRAND.ink);
      doc.text("FKF CommsIQ", margin + 4, height - 8.6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND.muted);
      doc.text("Powered by Persona_Voices", margin + 24, height - 8.6);
      doc.text(`Page ${i} of ${pages}`, width - margin, height - 8.6, { align: "right" });
    }
  }

  save(filename: string) {
    this.finish();
    this.doc.save(filename);
  }
}

export function slugify(value: string, fallback = "report") {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || fallback
  );
}

export { shorten as compactNumber };
