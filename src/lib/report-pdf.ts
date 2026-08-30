import { jsPDF } from "jspdf";
import type { Analysis } from "@/lib/analysis";
import { METRIC_LABELS } from "@/lib/analysis";
import {
  clusterReactions,
  confidenceLabel,
  engagementForecast,
  expectedReach,
  negativeBacklash,
  shareProbability,
  suggestionStats,
} from "@/lib/insights";

const RED: [number, number, number] = [198, 40, 40];
const GREEN: [number, number, number] = [22, 128, 84];
const INK: [number, number, number] = [17, 17, 17];
const MUTED: [number, number, number] = [110, 110, 115];
const LINE: [number, number, number] = [224, 224, 228];

const M = 44; // page margin
const W = 595.28; // A4 width (pt)
const H = 841.89;

export function buildAnalysisPdf(analysis: Analysis, title: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = M;

  const newPage = () => {
    doc.addPage();
    y = M;
  };
  const need = (space: number) => {
    if (y + space > H - 64) newPage();
  };

  function footer() {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINE);
      doc.line(M, H - 48, W - M, H - 48);
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("CommsIQ - Powered by Persona_Voices", M, H - 34);
      doc.text(`Page ${i} of ${pages}`, W - M, H - 34, { align: "right" });
    }
  }

  function heading(text: string) {
    if (y > M) y += 12;
    need(56);
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.text(text, M, y);
    y += 8;
    doc.setDrawColor(...LINE);
    doc.line(M, y, W - M, y);
    y += 18;
  }

  function paragraph(text: string, size = 10) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(text, W - M * 2) as string[];
    for (const line of lines) {
      need(16);
      doc.text(line, M, y);
      y += 14;
    }
  }

  function barChart(rows: { label: string; value: number }[], color: [number, number, number]) {
    const labelW = 130;
    const trackW = W - M * 2 - labelW - 40;
    for (const row of rows) {
      need(22);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(row.label, M, y + 8);
      doc.setFillColor(238, 238, 241);
      doc.roundedRect(M + labelW, y, trackW, 10, 5, 5, "F");
      const value = Math.max(0, Math.min(100, row.value));
      if (value > 0) {
        doc.setFillColor(...color);
        doc.roundedRect(M + labelW, y, Math.max(6, (trackW * value) / 100), 10, 5, 5, "F");
      }
      doc.setTextColor(...MUTED);
      doc.text(`${Math.round(value)}%`, W - M, y + 8, { align: "right" });
      y += 20;
    }
    y += 6;
  }

  function confidenceRing(value: number) {
    const cx = M + 52;
    const cy = y + 52;
    const r = 42;
    doc.setDrawColor(238, 238, 241);
    doc.setLineWidth(11);
    doc.circle(cx, cy, r, "S");
    doc.setDrawColor(...RED);
    // approximate the arc with short segments
    const steps = Math.max(1, Math.round((value / 100) * 72));
    for (let i = 0; i < steps; i++) {
      const a1 = -Math.PI / 2 + (i / 72) * Math.PI * 2;
      const a2 = -Math.PI / 2 + ((i + 1) / 72) * Math.PI * 2;
      doc.line(
        cx + r * Math.cos(a1),
        cy + r * Math.sin(a1),
        cx + r * Math.cos(a2),
        cy + r * Math.sin(a2),
      );
    }
    doc.setLineWidth(0.6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...INK);
    doc.text(`${Math.round(value)}%`, cx, cy + 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("CONFIDENCE", cx, cy + 17, { align: "center" });
  }

  function statCard(x: number, top: number, w: number, value: string, label: string) {
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, top, w, 46, 8, 8, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...INK);
    doc.text(value, x + 12, top + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 12, top + 36);
  }

  // ---- Cover header ----
  doc.setFillColor(...RED);
  doc.rect(0, 0, W, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...RED);
  doc.text("FKF COMMSIQ", M, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(new Date().toLocaleString(), W - M, y + 8, { align: "right" });
  y += 32;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  const titleLines = doc.splitTextToSize(title || "Message test", W - M * 2) as string[];
  for (const line of titleLines) {
    doc.text(line, M, y);
    y += 24;
  }
  y += 4;

  // ---- Confidence block ----
  const blockTop = y;
  confidenceRing(analysis.confidence);
  const cardX = M + 120;
  const cardW = (W - M - cardX - 12) / 2;
  statCard(cardX, blockTop + 6, cardW, confidenceLabel(analysis.confidence), "Verdict");
  statCard(
    cardX + cardW + 12,
    blockTop + 6,
    cardW,
    `${expectedReach(analysis)}%`,
    "Expected reach",
  );
  statCard(cardX, blockTop + 58, cardW, `${shareProbability(analysis)}%`, "Share probability");
  statCard(
    cardX + cardW + 12,
    blockTop + 58,
    cardW,
    `${negativeBacklash(analysis)}%`,
    "Negative backlash",
  );
  y = blockTop + 124;

  heading("Executive summary");
  paragraph(analysis.summary);
  y += 10;

  // ---- Charts ----
  heading("Confidence by dimension");
  barChart(
    (Object.keys(METRIC_LABELS) as (keyof Analysis["metrics"])[]).map((key) => ({
      label: METRIC_LABELS[key],
      value: analysis.metrics[key],
    })),
    RED,
  );

  heading("Sentiment split");
  barChart(
    [
      { label: "Positive", value: analysis.sentiment.positive },
      { label: "Neutral", value: analysis.sentiment.neutral },
      { label: "Negative", value: analysis.sentiment.negative },
    ],
    GREEN,
  );

  heading("Engagement forecast");
  barChart(engagementForecast(analysis), RED);

  const clusters = clusterReactions(analysis);
  if (clusters.length) {
    heading("Audience clusters");
    barChart(
      clusters.map((c) => ({ label: c.cluster, value: c.score })),
      GREEN,
    );
  }

  // ---- Recommendations ----
  newPage();
  heading("Recommended messages");
  analysis.suggestions.slice(0, 3).forEach((s, i) => {
    const stats = suggestionStats(analysis, i);
    need(120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(`${i + 1}. ${s.title}`, M, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GREEN);
    doc.text(
      `Projected confidence ${stats.confidence}%  ·  Share ${stats.share}%  ·  Backlash ${stats.backlash}%`,
      M,
      y + 8,
    );
    y += 22;
    doc.setDrawColor(...LINE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const body = doc.splitTextToSize(s.message, W - M * 2 - 28) as string[];
    const boxH = body.length * 13 + 18;
    need(boxH + 10);
    doc.roundedRect(M, y, W - M * 2, boxH, 8, 8, "S");
    doc.setTextColor(...INK);
    doc.setFontSize(10);
    let ty = y + 18;
    for (const line of body) {
      doc.text(line, M + 12, ty);
      ty += 13;
    }
    y += boxH + 10;
    paragraph(`Why it works: ${s.rationale}`, 9);
    y += 14;
  });

  if (analysis.risks.length) {
    heading("Risks & objections");
    for (const risk of analysis.risks) {
      need(18);
      doc.setFillColor(...RED);
      doc.circle(M + 3, y - 3, 2, "F");
      const lines = doc.splitTextToSize(risk, W - M * 2 - 16) as string[];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      for (const line of lines) {
        need(16);
        doc.text(line, M + 14, y);
        y += 14;
      }
      y += 4;
    }
  }

  footer();
  return doc;
}

export function downloadAnalysisPdf(analysis: Analysis, title: string) {
  const doc = buildAnalysisPdf(analysis, title);
  const slug = (title || "message-test")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  doc.save(`fkf-commsiq-${slug || "report"}.pdf`);
}
