import { HelpCircle, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { resetFirstRun } from "@/lib/first-run";
import {
  TIP_DEFS,
  clearTipResetHistory,
  recordTipReset,
  setAllTips,
  setTipEnabled,
  useTipPrefs,
  useTipResetHistory,
} from "@/lib/tip-prefs";

export function TipPreferences() {
  const prefs = useTipPrefs();
  const history = useTipResetHistory();

  function resetTips() {
    resetFirstRun();
    recordTipReset("All guides");
    toast.success("Done.");
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <HelpCircle className="size-4 text-primary" /> Tip preferences
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose which first-time tooltips and guides appear on this device.
      </p>

      <ul className="mt-4 divide-y divide-border/70">
        {TIP_DEFS.map((tip) => (
          <li key={tip.id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{tip.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{tip.description}</p>
            </div>
            <Switch
              checked={prefs[tip.id]}
              aria-label={`Toggle ${tip.title}`}
              onCheckedChange={(checked) => {
                setTipEnabled(tip.id, checked);
                toast.success("Saved.");
              }}
            />
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={resetTips}>
          <HelpCircle className="size-4" /> Reset first-time tips
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setAllTips(true);
            toast.success("Saved.");
          }}
        >
          Enable all
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setAllTips(false);
            toast.success("Saved.");
          }}
        >
          Disable all
        </Button>
      </div>

      <div className="mt-5 rounded-xl border border-border/70 bg-secondary/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <History className="size-3.5 text-muted-foreground" /> Reset history
          </p>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                clearTipResetHistory();
                toast.success("Done.");
              }}
            >
              Clear
            </Button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Nothing here yet. Guides you reset on this device will show up here.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {history.map((entry, i) => (
              <li
                key={`${entry.at}-${i}`}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="min-w-0 truncate font-medium">{entry.label}</span>
                <span className="shrink-0 text-muted-foreground">
                  {new Date(entry.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
