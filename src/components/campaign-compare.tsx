import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Columns3, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CompareCampaign = {
  campaignId: string;
  name: string;
  replies: number;
  accounts: number;
  impressions: number;
  engagements: number;
  reach: number;
  engagementRate: number;
  lastReplyAt: string | null;
};

const MAX = 4;

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const ROWS: {
  key: keyof CompareCampaign;
  label: string;
  format: (c: CompareCampaign) => string;
}[] = [
  { key: "replies", label: "Replies", format: (c) => String(c.replies) },
  { key: "accounts", label: "Personas", format: (c) => String(c.accounts) },
  { key: "impressions", label: "Views", format: (c) => formatCount(c.impressions) },
  { key: "reach", label: "Reach", format: (c) => formatCount(c.reach) },
  { key: "engagements", label: "Engagements", format: (c) => formatCount(c.engagements) },
  { key: "engagementRate", label: "Eng. rate", format: (c) => `${c.engagementRate}%` },
  {
    key: "lastReplyAt",
    label: "Last reply",
    format: (c) => (c.lastReplyAt ? new Date(c.lastReplyAt).toLocaleDateString() : "-"),
  },
];

/**
 * Compare mode: pick up to four campaigns and read their metrics as columns,
 * with the best value in each row marked so differences are obvious.
 */
export function CampaignCompare({ campaigns }: { campaigns: CompareCampaign[] }) {
  const [on, setOn] = useState(false);
  const [picked, setPicked] = useState<string[]>(() =>
    campaigns.slice(0, 2).map((c) => c.campaignId),
  );

  const selected = useMemo(
    () => campaigns.filter((c) => picked.includes(c.campaignId)).slice(0, MAX),
    [campaigns, picked],
  );

  const chartData = useMemo(
    () =>
      selected.map((c) => ({
        name: c.name.length > 16 ? `${c.name.slice(0, 15)}…` : c.name,
        Views: c.impressions,
        Engagements: c.engagements,
        Replies: c.replies,
      })),
    [selected],
  );

  function toggle(id: string) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length >= MAX ? prev : [...prev, id],
    );
  }

  if (campaigns.length < 2) return null;

  return (
    <section className="rounded-xl border border-border p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="type-card">Compare campaigns</h3>
          <p className="mt-1 type-meta text-muted-foreground">
            Put up to {MAX} campaigns side by side.
          </p>
        </div>
        <Button
          variant={on ? "secondary" : "outline"}
          size="sm"
          aria-pressed={on}
          className="min-h-9 gap-2 rounded-xl"
          onClick={() => setOn((v) => !v)}
        >
          {on ? (
            <X className="size-4" aria-hidden="true" />
          ) : (
            <Columns3 className="size-4" aria-hidden="true" />
          )}
          {on ? "Exit compare" : "Compare mode"}
        </Button>
      </div>

      {on && (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {campaigns.map((c) => {
              const active = picked.includes(c.campaignId);
              const full = !active && picked.length >= MAX;
              return (
                <button
                  key={c.campaignId}
                  type="button"
                  aria-pressed={active}
                  disabled={full}
                  onClick={() => toggle(c.campaignId)}
                  className={
                    active
                      ? "rounded-lg border border-primary bg-primary/10 px-2.5 py-1 type-meta text-foreground"
                      : `rounded-lg border border-border px-2.5 py-1 type-meta text-muted-foreground ${full ? "opacity-40" : "hover:text-foreground"}`
                  }
                >
                  {c.name}
                </button>
              );
            })}
          </div>

          {selected.length === 0 ? (
            <p className="mt-4 type-meta text-muted-foreground">
              Pick at least one campaign to compare.
            </p>
          ) : (
            <>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left type-body">
                  <thead>
                    <tr className="border-b border-border type-meta uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Metric</th>
                      {selected.map((c) => (
                        <th key={c.campaignId} className="py-2 pr-3 text-right font-semibold">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row) => {
                      const numeric = row.key !== "lastReplyAt";
                      const best = numeric
                        ? Math.max(...selected.map((c) => Number(c[row.key] ?? 0)))
                        : null;
                      return (
                        <tr key={row.key} className="border-b border-border/60 last:border-0">
                          <td className="py-2 pr-3 text-muted-foreground">{row.label}</td>
                          {selected.map((c) => {
                            const isBest =
                              numeric && best !== null && best > 0 && Number(c[row.key]) === best;
                            return (
                              <td
                                key={c.campaignId}
                                className={`py-2 pr-3 text-right tabular-nums ${
                                  isBest ? "font-semibold text-foreground" : ""
                                }`}
                              >
                                {row.format(c)}
                                {isBest && selected.length > 1 ? (
                                  <span className="ml-1 type-meta text-primary">best</span>
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Views" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Engagements" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Replies" fill="#22c55e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
