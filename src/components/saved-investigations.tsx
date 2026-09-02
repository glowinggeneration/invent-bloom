import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookmarkPlus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui-kit";
import { SaveToggle } from "@/components/core/save-toggle";

const STORAGE_KEY = "fkf-commsiq:saved-investigations:v1";

type SavedInvestigation = {
  id: string;
  name: string;
  query: string;
};

function readSaved(): SavedInvestigation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.name === "string" && typeof item.query === "string")
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function SavedInvestigations({ currentTopic }: { currentTopic?: string }) {
  const [saved, setSaved] = useState<SavedInvestigation[]>([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState(currentTopic ?? "");

  useEffect(() => setSaved(readSaved()), []);
  useEffect(() => {
    if (currentTopic) setQuery(currentTopic);
  }, [currentTopic]);

  const savedMatch = useMemo(
    () => saved.find((item) => item.query.toLowerCase() === query.trim().toLowerCase()),
    [saved, query],
  );

  function persist(next: SavedInvestigation[]) {
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function save() {
    const cleanQuery = query.trim().slice(0, 120);
    if (!cleanQuery || savedMatch) return;
    const cleanName = (name.trim() || cleanQuery).slice(0, 60);
    persist(
      [{ id: crypto.randomUUID(), name: cleanName, query: cleanQuery }, ...saved].slice(0, 8),
    );
    setName("");
  }

  function toggleSaved() {
    if (savedMatch) {
      remove(savedMatch.id);
      return;
    }
    save();
  }

  function remove(id: string) {
    persist(saved.filter((item) => item.id !== id));
  }

  return (
    <Card className="mt-4 p-4">
      <details>
        <summary className="flex cursor-pointer list-none items-center gap-2 type-card font-semibold [&::-webkit-details-marker]:hidden">
          <BookmarkPlus className="size-4 text-primary" /> Saved investigations
          {saved.length ? (
            <span className="rounded-full bg-muted px-2 py-0.5 type-meta font-normal text-muted-foreground">
              {saved.length}
            </span>
          ) : null}
        </summary>
        <p className="type-meta mt-2 text-muted-foreground">
          Save reusable topic filters for the content already collected in Mentions. This does not
          create another monitoring feed or API request.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name, e.g. Stadium discussion"
            maxLength={60}
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Topic or phrase"
              className="pl-9"
              maxLength={120}
            />
          </div>
          <SaveToggle
            saved={Boolean(savedMatch)}
            onToggle={toggleSaved}
            disabled={!query.trim()}
            className="h-9"
          />
        </div>
        {savedMatch ? (
          <p className="type-meta mt-2 text-muted-foreground">
            This investigation is saved. Select Saved to remove it from your list.
          </p>
        ) : null}

        {saved.length ? (
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {saved.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-xl border border-border p-3"
              >
                <Link to="/mentions" search={{ topic: item.query }} className="min-w-0 flex-1">
                  <span className="type-body block truncate font-semibold">{item.name}</span>
                  <span className="type-meta block truncate text-muted-foreground">
                    {item.query}
                  </span>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label={`Delete ${item.name}`}
                  onClick={() => remove(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </details>
    </Card>
  );
}
