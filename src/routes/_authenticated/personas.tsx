import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpDown,
  ImageIcon,
  LayoutGrid,
  Loader2,
  Megaphone,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLUSTERS, personaCluster } from "@/lib/insights";
import { PERSONAS, type Persona } from "@/lib/personas";
import {
  listPersonaImages,
  syncPersonaImages,
  type PersonaImage,
} from "@/lib/persona-images.functions";
import { isAdminEmail } from "@/lib/access";
import { useProfile } from "@/hooks/use-profile";
import { PageTitle } from "@/components/ui-kit";
import { friendlyError } from "@/lib/friendly-errors";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/personas")({
  head: () => ({
    meta: [
      { title: "Personas - CommsIQ" },
      {
        name: "description",
        content:
          "Browse the 100 research-grounded urban Kenyan personas that review every message tested in CommsIQ.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Personas - CommsIQ" },
      {
        property: "og:description",
        content: "The 100 urban Kenyan personas behind every CommsIQ analysis.",
      },
    ],
  }),
  component: PersonasPage,
});

const PERSONA_PAGE_SIZE = 18;

const AGE_BANDS = [
  { id: "18-24", label: "18–24", min: 18, max: 24 },
  { id: "25-34", label: "25–34", min: 25, max: 34 },
  { id: "35-44", label: "35–44", min: 35, max: 44 },
  { id: "45+", label: "45+", min: 45, max: 200 },
];

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="type-meta mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function PersonasPage() {
  const { data: profile, isLoading } = useProfile();
  const [query, setQuery] = useState("");
  const [cluster, setCluster] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [segment, setSegment] = useState<string>("all");
  const [ageBand, setAgeBand] = useState<string>("all");
  const [sort, setSort] = useState<string>("default");
  const [grouped, setGrouped] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(PERSONA_PAGE_SIZE);

  const queryClient = useQueryClient();
  const fetchImages = useServerFn(listPersonaImages);
  const runSync = useServerFn(syncPersonaImages);

  const { data: images } = useQuery({
    queryKey: ["persona-images"],
    queryFn: () => fetchImages(),
    enabled: !isLoading,
    staleTime: 5 * 60 * 1000,
  });

  const imageMap = useMemo(() => {
    const map = new Map<string, PersonaImage>();
    for (const img of images ?? []) map.set(img.personaId, img);
    return map;
  }, [images]);

  const sync = useMutation({
    mutationFn: () => runSync({ data: { limit: 12 } }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["persona-images"] });
      if (res.error) {
        toast.error(friendlyError(res.error));
      } else if (res.added === 0 && res.remaining === 0) {
        toast.success("Done.");
      } else {
        toast.success(
          `Added artwork for ${res.added} persona${res.added === 1 ? "" : "s"} · ${res.remaining} left`,
        );
      }
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const missingCount = PERSONAS.length - imageMap.size;

  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const p of PERSONAS) for (const pl of p.platforms) set.add(pl);
    return [...set].sort();
  }, []);

  const clusterCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of PERSONAS) {
      const c = personaCluster(p);
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return CLUSTERS.filter((c) => map.has(c)).map((c) => ({ cluster: c, count: map.get(c) ?? 0 }));
  }, []);

  const segments = useMemo(() => [...new Set(PERSONAS.map((p) => p.segment))].sort(), []);

  const activeFilters =
    (cluster !== "all" ? 1 : 0) +
    (platform !== "all" ? 1 : 0) +
    (segment !== "all" ? 1 : 0) +
    (ageBand !== "all" ? 1 : 0) +
    (query.trim() ? 1 : 0) +
    (sort !== "default" ? 1 : 0);

  const clearAll = () => {
    setCluster("all");
    setPlatform("all");
    setSegment("all");
    setAgeBand("all");
    setSort("default");
    setQuery("");
  };

  useEffect(() => {
    setVisibleLimit(PERSONA_PAGE_SIZE);
  }, [query, cluster, platform, segment, ageBand, sort, grouped]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const band = AGE_BANDS.find((b) => b.id === ageBand);
    const rows = PERSONAS.filter((p) => {
      if (cluster !== "all" && personaCluster(p) !== cluster) return false;
      if (platform !== "all" && !p.platforms.includes(platform)) return false;
      if (segment !== "all" && p.segment !== segment) return false;
      if (band && (p.age < band.min || p.age > band.max)) return false;
      if (!q) return true;
      return [p.name, p.segment, p.role, p.location, p.vibe].join(" ").toLowerCase().includes(q);
    });
    if (sort === "name") return [...rows].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "age-asc") return [...rows].sort((a, b) => a.age - b.age);
    if (sort === "age-desc") return [...rows].sort((a, b) => b.age - a.age);
    return rows;
  }, [query, cluster, platform, segment, ageBand, sort]);

  const displayed = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof PERSONAS>();
    for (const p of displayed) {
      const c = personaCluster(p);
      map.set(c, [...(map.get(c) ?? []), p]);
    }
    return CLUSTERS.filter((c) => map.has(c)).map((c) => ({
      cluster: c as string,
      personas: map.get(c) ?? [],
    }));
  }, [displayed]);

  return (
    <WorkspaceShell title="Personas" wide>
      <PageTitle
        description={`${PERSONAS.length} research-grounded urban Kenyan personas review every message you test.`}
        actions={
          <>
            {missingCount > 0 && isAdminEmail(profile?.email) ? (
              <Button
                variant="outline"
                className="gap-2"
                disabled={sync.isPending}
                onClick={() => sync.mutate()}
              >
                {sync.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
                Load artwork
              </Button>
            ) : null}
            <Button asChild className="gap-2">
              <Link to="/campaign-manager">
                <Megaphone className="size-4" /> Test a campaign
              </Link>
            </Button>
          </>
        }
      >
        Persona panel
      </PageTitle>

      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border bg-card px-4 py-3 type-meta text-muted-foreground">
        <span>
          <strong className="text-foreground">{PERSONAS.length}</strong> personas
        </span>
        <span>
          <strong className="text-foreground">{clusterCounts.length}</strong> clusters
        </span>
        <span>
          <strong className="text-foreground">{filtered.length}</strong> matching
        </span>
        {missingCount > 0 && isAdminEmail(profile?.email) ? (
          <span>
            <strong className="text-foreground">{missingCount}</strong> need artwork
          </span>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search personas…"
              aria-label="Search personas"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={filtersOpen || activeFilters > 0 ? "secondary" : "outline"}
              className="h-10 gap-2 rounded-xl"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((value) => !value)}
            >
              <SlidersHorizontal className="size-4" />
              Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
            </Button>
            <Button
              type="button"
              variant={grouped ? "secondary" : "outline"}
              className="h-10 gap-2 rounded-xl"
              onClick={() => setGrouped((value) => !value)}
            >
              <LayoutGrid className="size-4" /> {grouped ? "Clustered" : "Flat list"}
            </Button>
            <p className="ml-auto type-meta text-muted-foreground lg:ml-2">
              Showing {displayed.length} of {filtered.length}
            </p>
          </div>
        </div>

        {filtersOpen ? (
          <div className="mt-3 grid gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <FilterField label="Platform">
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="h-10" aria-label="Filter by platform">
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  {platforms.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Cluster">
              <Select value={cluster} onValueChange={setCluster}>
                <SelectTrigger className="h-10" aria-label="Filter by cluster">
                  <SelectValue placeholder="All clusters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clusters</SelectItem>
                  {clusterCounts.map((item) => (
                    <SelectItem key={item.cluster} value={item.cluster}>
                      {item.cluster} ({item.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Segment">
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger className="h-10" aria-label="Filter by segment">
                  <SelectValue placeholder="All segments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All segments</SelectItem>
                  {segments.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Age">
              <Select value={ageBand} onValueChange={setAgeBand}>
                <SelectTrigger className="h-10" aria-label="Filter by age">
                  <SelectValue placeholder="All ages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ages</SelectItem>
                  {AGE_BANDS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Sort">
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-10" aria-label="Sort personas">
                  <ArrowUpDown className="size-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default order</SelectItem>
                  <SelectItem value="name">Name A–Z</SelectItem>
                  <SelectItem value="age-asc">Youngest first</SelectItem>
                  <SelectItem value="age-desc">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            {activeFilters > 0 ? (
              <div className="flex items-end lg:col-span-5">
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear all filters
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {grouped ? (
          <div className="mt-6 space-y-8">
            {groups.map((group) => (
              <section key={group.cluster}>
                <div className="flex items-center gap-2">
                  <h2 className="type-card">{group.cluster}</h2>
                  <span className="rounded-full bg-secondary px-2 py-1 type-meta text-secondary-foreground">
                    {group.personas.length}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {group.personas.map((persona) => (
                    <PersonaCard
                      key={persona.id}
                      persona={persona}
                      image={imageMap.get(persona.id)}
                      onOpen={() => setSelectedPersona(persona)}
                    />
                  ))}
                </div>
              </section>
            ))}
            {groups.length === 0 ? (
              <p className="type-body text-muted-foreground">
                Nothing here yet. Personas matching your filters will appear here.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {displayed.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                image={imageMap.get(persona.id)}
                onOpen={() => setSelectedPersona(persona)}
              />
            ))}
          </div>
        )}

        {displayed.length < filtered.length ? (
          <div className="mt-5 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setVisibleLimit((current) => current + PERSONA_PAGE_SIZE)}
            >
              Show 18 more personas
            </Button>
          </div>
        ) : null}
      </div>

      <Sheet
        open={selectedPersona !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPersona(null);
        }}
      >
        {selectedPersona ? (
          <PersonaDetails persona={selectedPersona} image={imageMap.get(selectedPersona.id)} />
        ) : null}
      </Sheet>
    </WorkspaceShell>
  );
}

function PersonaCard({
  persona,
  image,
  onOpen,
}: {
  persona: Persona;
  image?: PersonaImage | undefined;
  onOpen: () => void;
}) {
  const initials = persona.name
    .split(" ")
    .slice(0, 2)
    .map((name) => name[0])
    .join("");
  return (
    <article className="group flex h-full min-h-64 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg">
      <div
        className="h-14 w-full bg-gradient-to-br from-secondary to-muted bg-cover bg-center"
        style={
          image
            ? {
                backgroundImage: `url(${image.backgroundUrl})`,
                backgroundColor: image.color ?? undefined,
              }
            : undefined
        }
        aria-hidden="true"
      />
      <div className="flex flex-1 flex-col p-4 pt-0">
        <div className="-mt-7">
          {image ? (
            <img
              src={image.avatarUrl}
              alt={`Abstract artwork representing ${persona.name}`}
              loading="lazy"
              className="size-14 rounded-full border-[3px] border-card object-cover shadow-sm"
            />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full border-[3px] border-card bg-secondary text-sm font-bold text-secondary-foreground shadow-sm">
              {initials}
            </span>
          )}
        </div>

        <div className="mt-3 min-w-0">
          <h3 className="truncate type-card">{persona.name}</h3>
          <p className="truncate type-meta text-muted-foreground">
            {persona.age} · {persona.location}
          </p>
        </div>

        <span className="mt-2 line-clamp-2 min-h-9 w-fit max-w-full rounded-lg bg-primary/10 px-2 py-1 type-meta font-medium leading-4 text-primary">
          {persona.segment}
        </span>

        <div className="mt-auto flex flex-wrap gap-1 pt-3">
          {persona.platforms.slice(0, 2).map((platform) => (
            <span
              key={platform}
              className="max-w-full truncate rounded-full bg-secondary px-2 py-0.5 type-meta text-secondary-foreground"
            >
              {platform}
            </span>
          ))}
          {persona.platforms.length > 2 ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 type-meta text-muted-foreground">
              +{persona.platforms.length - 2}
            </span>
          ) : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 w-full justify-center border border-border"
          onClick={onOpen}
        >
          View profile
        </Button>
      </div>
    </article>
  );
}

function PersonaDetails({
  persona,
  image,
}: {
  persona: Persona;
  image?: PersonaImage | undefined;
}) {
  const initials = persona.name
    .split(" ")
    .slice(0, 2)
    .map((name) => name[0])
    .join("");
  const topTraits = Object.entries(persona.traits ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg">
      <div
        className="h-28 bg-gradient-to-br from-secondary to-muted bg-cover bg-center"
        style={image ? { backgroundImage: `url(${image.backgroundUrl})` } : undefined}
        aria-hidden="true"
      />
      <div className="px-6 pb-8">
        <div className="-mt-9">
          {image ? (
            <img
              src={image.avatarUrl}
              alt={`Abstract artwork representing ${persona.name}`}
              className="size-18 rounded-full border-4 border-background object-cover shadow-sm"
            />
          ) : (
            <span className="flex size-18 items-center justify-center rounded-full border-4 border-background bg-secondary text-base font-bold shadow-sm">
              {initials}
            </span>
          )}
        </div>

        <SheetHeader className="mt-4">
          <SheetTitle>{persona.name}</SheetTitle>
          <SheetDescription>
            {persona.age} · {persona.location} · {persona.role}
          </SheetDescription>
        </SheetHeader>

        {!image ? (
          <p className="mt-3 w-fit rounded-full bg-muted px-2.5 py-1 type-meta text-muted-foreground">
            Artwork pending
          </p>
        ) : null}

        <p className="mt-5 border-l-2 border-primary/40 pl-4 type-body italic leading-relaxed text-foreground">
          “{persona.quote}”
        </p>

        <dl className="mt-6 space-y-2 border-t border-border pt-5">
          <Row label="Segment" value={persona.segment} />
          <Row label="Cluster" value={personaCluster(persona)} />
          <Row label="Vibe" value={persona.vibe} />
          <Row label="Decides by" value={persona.decisionStyle} />
          <Row label="Platforms" value={persona.platforms.join(", ")} />
        </dl>

        {topTraits.length > 0 ? (
          <div className="mt-6 space-y-2 border-t border-border pt-5">
            <h3 className="type-card">Strongest traits</h3>
            {topTraits.map(([trait, value]) => (
              <div key={trait} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate type-meta capitalize text-muted-foreground">
                  {trait}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }}
                  />
                </span>
                <span className="w-8 text-right type-meta tabular-nums text-muted-foreground">
                  {Math.round(Math.min(1, value) * 100)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="type-card">Profile</h3>
          <p className="mt-2 type-body leading-relaxed text-muted-foreground">{persona.profile}</p>
        </div>

        {image ? (
          <p className="mt-5 type-meta text-muted-foreground/70">
            Art by{" "}
            <a
              href={`${image.photographerUrl}?utm_source=fkf_commsiq&utm_medium=referral`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {image.photographerName}
            </a>{" "}
            on Unsplash
          </p>
        ) : null}
      </div>
    </SheetContent>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 type-meta text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 type-meta text-foreground">{value}</dd>
    </div>
  );
}
