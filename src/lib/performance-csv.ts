import type { PerformanceSummary } from "@/lib/performance";

function cell(value: string | number | null | undefined) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function line(values: (string | number | null | undefined)[]) {
  return values.map(cell).join(",");
}

/**
 * Flattens the performance summary into one CSV with a section per table:
 * totals, per-day, per-account, per-campaign and every individual post.
 */
export function performanceCsv(
  data: PerformanceSummary,
  resolveName: (handle: string) => string = (h) => h,
): string {
  const t = data.totals;
  const out: string[] = [];

  out.push("Totals");
  out.push(line(["Metric", "Value"]));
  out.push(line(["Posts", t.posts]));
  out.push(line(["Replies", t.replies]));
  out.push(line(["Views", t.impressions]));
  out.push(line(["Reach", t.reach]));
  out.push(line(["Engagements", t.engagements]));
  out.push(line(["Likes", t.likes]));
  out.push(line(["Retweets", t.retweets]));
  out.push(line(["Replies received", t.repliesReceived]));
  out.push(line(["Bookmarks", t.bookmarks]));
  out.push(line(["Quotes", t.quotes]));
  out.push(line(["Engagement rate %", t.engagementRate]));
  out.push("");

  out.push("By day");
  out.push(line(["Date", "Views", "Engagements", "Reach"]));
  for (const d of data.byDay) out.push(line([d.date, d.impressions, d.engagements, d.reach]));
  out.push("");

  out.push("By persona");
  out.push(line(["Persona", "Posts", "Views", "Engagements", "Reach"]));
  for (const a of data.byAccount) {
    out.push(line([resolveName(a.handle), a.posts, a.impressions, a.engagements, a.reach]));
  }
  out.push("");

  out.push("By campaign");
  out.push(
    line([
      "Campaign",
      "Replies",
      "Personas",
      "Views",
      "Engagements",
      "Reach",
      "Engagement rate %",
      "Last reply",
    ]),
  );
  for (const c of data.byCampaign) {
    out.push(
      line([
        c.name,
        c.replies,
        c.accounts,
        c.impressions,
        c.engagements,
        c.reach,
        c.engagementRate,
        c.lastReplyAt ?? "",
      ]),
    );
  }
  out.push("");

  out.push("Posts");
  out.push(
    line([
      "Published",
      "Persona",
      "Type",
      "Campaign",
      "Text",
      "Views",
      "Reach",
      "Engagements",
      "Likes",
      "Retweets",
      "Replies",
      "Quotes",
      "Bookmarks",
      "URL",
    ]),
  );
  for (const r of data.rows) {
    out.push(
      line([
        r.tweetedAt ?? "",
        resolveName(r.handle),
        r.campaignId ? "Campaign reply" : r.kind === "reply" ? "Comment" : "Post",
        r.campaignName ?? "",
        r.content.replace(/\s+/g, " ").trim(),
        r.impressions,
        r.reach,
        r.engagements,
        r.likes,
        r.retweets,
        r.replies,
        r.quotes,
        r.bookmarks,
        r.url,
      ]),
    );
  }

  return out.join("\n");
}

/** Triggers a browser download of the given CSV text. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
