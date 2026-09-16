import { useEffect, useMemo, useState } from "react";
import { Link, useServerFn } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookmarkPlus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui-kit";
import { SaveToggle } from "@/components/core/save-toggle";
import { readWithLegacyKey } from "@/lib/legacy-storage";
import { getSetupStatus } from "@/lib/onboarding.functions";

const STORAGE_KEY = "smait:saved-investigations:v1";
const LEGACY_STORAGE_KEY = "fkf-commsiq:saved-investigations:v1";

type SavedInvestigation = {
  id: string;
  name: string;
  query: string;
};

function readSaved(): SavedInvestigation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readWithLegacyKey(STORAGE_KEY, LEGACY_STORAGE_KEY);
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

  const fetchSetup = useServerFn(getSetupStatus);
  const { data: setup } = useQuery({ queryKey: ["setup-status"], queryFn: fetchSetup });

  /** Monitoring words, hashtags and topics saved during profile setup. */
  const setupTerms = useMemo(() => {
    if (!setup) return [];
    const list: { key: string; label: string; query: string }[] = [];
    for (const term of setup.keywords) {
      const value = term.trim();
      if (value) list.push({ key: `kw:${value.toLowerCase()}`, label: value, query: value });
    }
    for (const tag of setup.hashtags) {
      const value = tag.trim().replace(/^#/, "");
      if (value) list.push({ key: `ht:${value.toLowerCase()}`, label: `#${value}`, query: `#${value}` });
    }
    for (const topic of setup.topics) {
      const value = topic.trim();
      if (value) list.push({ key: `tp:${value.toLowerCase()}`, label: value, query: value });
    }
    return list;
  }, [setup]);

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
