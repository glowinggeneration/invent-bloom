import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBudgetSummary, setWorkspaceBudget } from "@/lib/budget.functions";
import { formatUsdEstimate } from "@/lib/ai-pricing";
import { friendlyError } from "@/lib/friendly-errors";

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * AI spend is tracked separately from `plan_limits` (tier-wide call counts,
 * soft-enforced) - this is a real, workspace-set monetary ceiling, enforced
 * server-side on the one AI call site currently instrumented for it
 * (Response Studio message tests). See EXCEPTION_REGISTER.md for what
 * remains unenforced.
 */
export function AiBudgetCard() {
  const queryClient = useQueryClient();
  const fetchBudget = useServerFn(getBudgetSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["budget-summary"],
    queryFn: () => fetchBudget(),
  });

  const [editing, setEditing] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const [warningInput, setWarningInput] = useState("");

  const save = useServerFn(setWorkspaceBudget);
  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          spendLimitUsd: toNumberOrNull(limitInput),
          warningThresholdUsd: toNumberOrNull(warningInput),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-summary"] });
      toast.success("Budget updated.");
      setEditing(false);
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  function startEditing() {
    setLimitInput(data?.spendLimitUsd != null ? String(data.spendLimitUsd) : "");
    setWarningInput(data?.warningThresholdUsd != null ? String(data.warningThresholdUsd) : "");
    setEditing(true);
  }

  const overWarning =
    data?.warningThresholdUsd != null && data.estimatedSpendUsd >= data.warningThresholdUsd;
  const overLimit = data?.spendLimitUsd != null && data.estimatedSpendUsd >= data.spendLimitUsd;

  return (
    <article className="rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2">
        <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="type-body font-medium">AI budget</h3>
      </div>

      {isLoading ? (
        <div className="mt-3 h-24 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
      ) : !data ? (
        <p className="mt-3 type-meta text-muted-foreground">
          Budget data isn't available right now.
        </p>
      ) : (
        <>
          <p className="mt-3 type-meta text-muted-foreground">
            Estimated spend this month, in {data.currency} - our own estimate from token counts,
            never a confirmed provider invoice.
          </p>
          <p
            className={`mt-2 type-card font-semibold ${overLimit ? "text-destructive" : overWarning ? "text-amber-600 dark:text-amber-400" : ""}`}
          >
            {formatUsdEstimate(data.estimatedSpendUsd)}
            {data.spendLimitUsd != null ? (
              <span className="type-meta font-normal text-muted-foreground">
                {" "}
                of ${data.spendLimitUsd.toFixed(2)} limit
              </span>
            ) : null}
          </p>
          {data.callsWithoutPricing > 0 ? (
            <p className="mt-1 type-meta text-muted-foreground">
              {data.callsWithoutPricing} call(s) this month have no pricing entry and are excluded
              from this estimate - not counted as $0.
            </p>
          ) : null}
          <p className="mt-1 type-meta text-muted-foreground">
            {data.lastReconciledAt
              ? `Last reconciled ${new Date(data.lastReconciledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
              : "No AI usage recorded yet this month."}
          </p>

          {overLimit ? (
            <p className="mt-2 type-meta font-medium text-destructive">
              New AI-generated message tests are currently blocked until this limit is raised.
            </p>
          ) : overWarning ? (
            <p className="mt-2 type-meta font-medium text-amber-600 dark:text-amber-400">
              Approaching the warning threshold.
            </p>
          ) : null}

          {editing ? (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <div className="space-y-1">
                <Label htmlFor="budget-limit" className="type-meta">
                  Monthly spend limit (USD, optional)
                </Label>
                <Input
                  id="budget-limit"
                  type="number"
                  min={0}
                  step={0.01}
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder="No limit"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="budget-warning" className="type-meta">
                  Warning threshold (USD, optional)
                </Label>
                <Input
                  id="budget-warning"
                  type="number"
                  min={0}
                  step={0.01}
                  value={warningInput}
                  onChange={(e) => setWarningInput(e.target.value)}
                  placeholder="No warning"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
              <p className="type-meta text-muted-foreground">
                Any workspace member can set this today - role-gating for this action doesn't exist
                anywhere in this app yet.
              </p>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="mt-4" onClick={startEditing}>
              Set limit
            </Button>
          )}
        </>
      )}
    </article>
  );
}
