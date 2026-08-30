import { Activity, Gauge, WalletCards } from "lucide-react";

import { Card, SectionTitle, StatCard } from "@/components/ui-kit";
import {
  ACTION_PRICING,
  CREDITS_PER_USD,
  FX_AS_OF,
  PRICING_AS_OF,
  USD_TO_ZAR,
  actionsRemaining,
  formatUsd,
  formatZar,
} from "@/lib/action-cost";

export function AccountCostSummary({
  credits,
  loading,
  configured,
}: {
  credits: number | null;
  loading?: boolean;
  configured?: boolean;
}) {
  const balanceUsd = credits == null ? null : credits / CREDITS_PER_USD;
  const balanceZar = balanceUsd == null ? null : balanceUsd * USD_TO_ZAR;
  const unavailable = !configured && credits == null;
  const value = (kind: "post" | "comment" | "like") =>
    loading
      ? "…"
      : credits == null
        ? unavailable
          ? "Not configured"
          : "—"
        : actionsRemaining(credits, kind).toLocaleString();

  return (
    <section className="mb-6 space-y-3" aria-label="API cost and remaining action capacity">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={WalletCards}
          label="Provider balance"
          value={
            loading
              ? "…"
              : balanceUsd == null
                ? unavailable
                  ? "Not configured"
                  : "—"
                : formatUsd(balanceUsd)
          }
          hint={
            balanceZar == null ? "TwitterAPI.io credits" : `${formatZar(balanceZar)} planning value`
          }
        />
        <StatCard
          icon={Activity}
          label="Remaining posts"
          value={value("post")}
          hint="300 credits · $0.003 each"
        />
        <StatCard
          icon={Activity}
          label="Remaining replies"
          value={value("comment")}
          hint="300 credits · $0.003 each"
        />
        <StatCard
          icon={Gauge}
          label="200-credit actions"
          value={value("like")}
          hint="Like / Repost / Bookmark / Follow provider cost"
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle>Current write costs</SectionTitle>
            <p className="type-meta mt-1 text-muted-foreground">
              Based on the exact TwitterAPI.io V2 endpoints configured in this codebase. Costs are
              provider charges, not campaign recommendations.
            </p>
          </div>
          <p className="type-meta text-muted-foreground">
            Pricing {PRICING_AS_OF} · FX {FX_AS_OF}
          </p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(["post", "comment", "like", "retweet", "bookmark", "follow"] as const).map((kind) => {
            const price = ACTION_PRICING[kind];
            return (
              <div key={kind} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="type-body font-semibold">{price.label}</p>
                    <p className="mt-0.5 type-meta text-muted-foreground">
                      {price.credits.toLocaleString()} credits
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="type-body font-semibold">{formatUsd(price.usd)}</p>
                    <p className="type-meta text-muted-foreground">
                      ≈ {formatZar(price.usd * USD_TO_ZAR)}
                    </p>
                  </div>
                </div>
                <p className="mt-2 type-meta text-muted-foreground">
                  {price.automatedCampaignUse === "enabled"
                    ? "Available in reviewed campaign execution."
                    : price.automatedCampaignUse === "reviewed"
                      ? "Available only through reviewed, limited use."
                      : "Provider supports this action, but automated campaign use is disabled."}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 type-meta text-muted-foreground">
          A media post typically uses one media-upload call ($0.003) plus one create-post call
          ($0.003), before any read/monitoring costs. Rand values use the displayed planning FX rate
          and can move with USD/ZAR.
        </p>
      </Card>
    </section>
  );
}
