import { useEffect, useState } from "react";
import { BookmarkPlus, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui-kit";

const STORAGE_KEY = "fkf-commsiq:message-templates:v1";

type MessageTemplate = {
  id: string;
  name: string;
  text: string;
};

function readTemplates(): MessageTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.text === "string",
      )
      .slice(0, 12);
  } catch {
    return [];
  }
}

export function MessageTemplates({ onUse }: { onUse: (text: string) => void }) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  useEffect(() => setTemplates(readTemplates()), []);

  function persist(next: MessageTemplate[]) {
    setTemplates(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function save() {
    const cleanText = text.trim().slice(0, 4000);
    if (!cleanText) return;
    const cleanName = (name.trim() || cleanText.slice(0, 42)).slice(0, 60);
    persist(
      [{ id: crypto.randomUUID(), name: cleanName, text: cleanText }, ...templates].slice(0, 12),
    );
    setName("");
    setText("");
  }

  function remove(id: string) {
    persist(templates.filter((template) => template.id !== id));
  }

  return (
    <Card className="mt-4 p-4">
      <details>
        <summary className="flex cursor-pointer list-none items-center gap-2 type-card font-semibold [&::-webkit-details-marker]:hidden">
          <FileText className="size-4 text-primary" /> Saved message templates
          {templates.length ? (
            <span className="rounded-full bg-muted px-2 py-0.5 type-meta font-normal text-muted-foreground">
              {templates.length}
            </span>
          ) : null}
        </summary>
        <p className="type-meta mt-2 text-muted-foreground">
          Save wording you reuse often, then load it directly into Response Studio. Templates stay
          in this browser and do not create a new external storage service.
        </p>

        <div className="mt-4 grid gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Template name, e.g. Fixture announcement"
            maxLength={60}
          />
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste the reusable message wording…"
            className="min-h-28 resize-y"
            maxLength={4000}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="type-meta text-muted-foreground">
              {text.length.toLocaleString()} / 4,000
            </span>
            <Button type="button" size="sm" disabled={!text.trim()} onClick={save}>
              <BookmarkPlus className="size-4" /> Save template
            </Button>
          </div>
        </div>

        {templates.length ? (
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {templates.map((template) => (
              <li key={template.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onUse(template.text)}
                  >
                    <span className="type-body block truncate font-semibold">{template.name}</span>
                    <span className="type-meta mt-1 block line-clamp-2 text-muted-foreground">
                      {template.text}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={`Delete ${template.name}`}
                    onClick={() => remove(template.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => onUse(template.text)}
                >
                  Use template
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </details>
    </Card>
  );
}
