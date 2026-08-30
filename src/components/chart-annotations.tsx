import { useMemo, useState, useSyncExternalStore } from "react";
import { MessageSquarePlus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { annotationStore, type Annotation } from "@/lib/annotations";

const CAUSES: { key: Annotation["causeType"]; label: string; placeholder: string }[] = [
  { key: "persona", label: "Persona", placeholder: "Which persona moved this?" },
  { key: "message", label: "Input message", placeholder: "Which wording or edit?" },
  { key: "other", label: "Other", placeholder: "Image, timing, context..." },
];

function useAnnotations(analysisId: string) {
  return useSyncExternalStore(
    annotationStore.subscribe,
    () => annotationStore.get(analysisId),
    () => annotationStore.get(analysisId),
  );
}

/**
 * Optional per-chart notes: record which persona or input message you think
 * caused a confidence change, so later runs can be compared with context.
 */
export function ChartAnnotations({
  analysisId,
  target,
  targetLabel,
  personaNames = [],
}: {
  analysisId: string;
  target: string;
  targetLabel: string;
  personaNames?: string[];
}) {
  const all = useAnnotations(analysisId);
  const notes = useMemo(() => all.filter((a) => a.target === target), [all, target]);
  const [open, setOpen] = useState(false);
  const [causeType, setCauseType] = useState<Annotation["causeType"]>("persona");
  const [cause, setCause] = useState("");
  const [note, setNote] = useState("");

  const listId = `annotation-personas-${target}`;

  function save() {
    if (!note.trim() && !cause.trim()) return;
    annotationStore.add(analysisId, {
      target,
      causeType,
      cause: cause.trim(),
      note: note.trim(),
    });
    setCause("");
    setNote("");
    setOpen(false);
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          className="min-h-9 gap-2 rounded-xl px-2 type-meta"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X className="size-4" aria-hidden="true" />
          ) : (
            <MessageSquarePlus className="size-4" aria-hidden="true" />
          )}
          {open ? "Cancel" : `Annotate ${targetLabel.toLowerCase()}`}
        </Button>
        {notes.length > 0 && (
          <span className="type-meta text-muted-foreground">
            {notes.length} note{notes.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {CAUSES.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={causeType === c.key}
                onClick={() => setCauseType(c.key)}
                className={
                  causeType === c.key
                    ? "rounded-lg border border-primary bg-primary/10 px-2.5 py-1 type-meta text-foreground"
                    : "rounded-lg border border-border px-2.5 py-1 type-meta text-muted-foreground hover:text-foreground"
                }
              >
                {c.label}
              </button>
            ))}
          </div>
          <Input
            value={cause}
            list={causeType === "persona" ? listId : undefined}
            onChange={(e) => setCause(e.target.value)}
            placeholder={CAUSES.find((c) => c.key === causeType)?.placeholder}
            aria-label="What caused the change"
            className="rounded-lg"
          />
          {causeType === "persona" && (
            <datalist id={listId}>
              {personaNames.slice(0, 100).map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          )}
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What changed and why you think so"
            rows={2}
            aria-label="Annotation note"
            className="rounded-lg"
          />
          <Button type="button" size="sm" className="min-h-9 rounded-xl" onClick={save}>
            Save note
          </Button>
        </div>
      )}

      {notes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {notes.map((a) => (
            <li key={a.id} className="flex items-start gap-2 rounded-lg bg-muted/50 p-2">
              <div className="min-w-0 flex-1">
                <p className="type-meta font-medium text-foreground">
                  {CAUSES.find((c) => c.key === a.causeType)?.label}
                  {a.cause ? `: ${a.cause}` : ""}
                </p>
                {a.note && <p className="type-meta text-muted-foreground">{a.note}</p>}
              </div>
              <button
                type="button"
                aria-label="Delete annotation"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => annotationStore.remove(analysisId, a.id)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
