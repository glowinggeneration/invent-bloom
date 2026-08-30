import { useEffect } from "react";
import { ExternalLink, FileText, Quote, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EvidenceCitation {
  id: string;
  title: string;
  source?: string;
  url?: string;
  quote?: string;
  timestamp?: string;
  tone?: "positive" | "neutral" | "critical";
}

export interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  citations: EvidenceCitation[];
  children?: React.ReactNode;
}

const TONE_DOT: Record<NonNullable<EvidenceCitation["tone"]>, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-muted-foreground",
  critical: "bg-red-500",
};

/** Right-side drawer for showing source citations & evidence behind a score. */
export function EvidenceDrawer({
  open,
  onClose,
  title = "Evidence & sources",
  description,
  citations,
  children,
}: EvidenceDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-[90] transition-opacity",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute inset-y-0 right-0 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
          {citations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No citations available.</p>
          ) : (
            <ul className="space-y-3">
              {citations.map((c) => (
                <li key={c.id} className="rounded-xl border border-border bg-background/50 p-3">
                  <div className="flex items-start gap-2">
                    {c.tone && (
                      <span
                        aria-hidden
                        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE_DOT[c.tone])}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        {c.source ?? "Source"}
                        {c.timestamp && (
                          <span className="text-muted-foreground/70">· {c.timestamp}</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground">{c.title}</p>
                      {c.quote && (
                        <blockquote className="mt-2 flex gap-1.5 border-l-2 border-primary/40 pl-2 text-xs italic text-muted-foreground">
                          <Quote className="h-3 w-3 shrink-0 opacity-50" />
                          {c.quote}
                        </blockquote>
                      )}
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Open source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
