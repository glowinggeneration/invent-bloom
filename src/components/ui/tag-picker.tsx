/**
 * Tag picker — animated selection of monitoring terms.
 * Selected tags animate between the "suggested" tray and the selection box.
 * Fully controlled so the parent owns the campaign state.
 */
import { X } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const spring = { type: "spring", stiffness: 300, damping: 40 } as const;

export type TagPickerProps = {
  /** Currently selected values, in order. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Optional quick-pick suggestions shown below the selection box. */
  suggestions?: string[];
  /** Show a free-text input so operators can add their own terms. */
  allowCustom?: boolean;
  placeholder?: string;
  label?: string;
  id?: string;
  className?: string;
};

const key = (tag: string) => tag.toLowerCase();

export function TagPicker({
  value,
  onChange,
  suggestions = [],
  allowCustom = true,
  placeholder = "Type a term and press Enter",
  label,
  id = "tag-picker",
  className,
}: TagPickerProps) {
  const [draft, setDraft] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [value]);

  const remove = (tag: string) => onChange(value.filter((t) => key(t) !== key(tag)));
  const add = (tag: string) => {
    const clean = tag.trim();
    if (!clean) return;
    if (value.some((t) => key(t) === key(clean))) return;
    onChange([...value, clean]);
  };

  const available = suggestions.filter((s) => !value.some((t) => key(t) === key(s)));

  return (
    <MotionConfig transition={spring}>
      <div className={cn("flex w-full flex-col gap-2", className)}>
        {label ? (
          <label className="text-xs font-medium" htmlFor={`${id}-input`}>
            {label}
          </label>
        ) : null}

        <motion.div
          ref={boxRef}
          layout
          className="flex max-h-40 min-h-14 w-full flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-input bg-background p-1.5"
        >
          <AnimatePresence initial={false}>
            {value.map((tag) => (
              <motion.span
                key={key(tag)}
                layoutId={`tag-${key(tag)}`}
                className="flex h-8 w-fit items-center gap-1 rounded-lg border border-border bg-card py-1 pl-3 pr-1 text-sm font-medium"
              >
                <motion.span layoutId={`tag-${key(tag)}-label`} className="truncate">
                  {tag}
                </motion.span>
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  onClick={() => remove(tag)}
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>

          {value.length === 0 ? (
            <span className="self-center px-2 text-xs text-muted-foreground">
              No terms selected yet.
            </span>
          ) : null}
        </motion.div>

        {allowCustom ? (
          <input
            id={`${id}-input`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(draft);
                setDraft("");
              } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
                remove(value[value.length - 1]!);
              }
            }}
            onBlur={() => {
              add(draft);
              setDraft("");
            }}
            placeholder={placeholder}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : null}

        {available.length > 0 ? (
          <motion.div layout className="w-full rounded-xl border border-border bg-card p-2">
            <div className="flex flex-wrap gap-2">
              {available.map((tag) => (
                <motion.button
                  key={key(tag)}
                  type="button"
                  layoutId={`tag-${key(tag)}`}
                  onClick={() => add(tag)}
                  className="flex h-8 shrink-0 items-center rounded-lg bg-muted px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                >
                  <motion.span layoutId={`tag-${key(tag)}-label`}>{tag}</motion.span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </div>
    </MotionConfig>
  );
}
