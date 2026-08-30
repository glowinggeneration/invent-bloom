import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpDown, ImageIcon, LayoutGrid, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
import { listPersonaLearning } from "@/lib/persona-learning.functions";
import { isAdminEmail } from "@/lib/access";
import { useProfile } from "@/hooks/use-profile";
import { PageTitle } from "@/components/ui-kit";
import { friendlyError } from "@/lib/friendly-errors";
import {
  CommandGrid,
  RailAction,
  RailBar,
  RailCard,
  RailStat,
  RailStatList,
} from "@/components/command-layout";
import { Sparkles, SlidersHorizontal, Users, Megaphone, Link2, LifeBuoy } from "lucide-react";

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

  const fetchLearning = useServerFn(listPersonaLearning);
  const { data: learning } = useQuery({
    queryKey: ["persona-learning"],
    queryFn: () => fetchLearning(),
    enabled: !isLoading,
    staleTime: 60 * 1000,
  });

  const learningSummary = useMemo(() => {
    const rows = learning ?? [];
    if (!rows.length) return null;
    const avg = (pick: (r: (typeof rows)[number]) => number) =>
      Math.round((rows.reduce((s, r) => s + pick(r), 0) / rows.length) * 100);
    return {
      evolved: rows.length,
      directness: avg((r) => r.communicationHabit),
      trust: avg((r) => r.institutionalTrust),
      review: rows.filter((r) => r.driftScore >= 0.36).length,
      frozen: rows.filter((r) => r.frozen).length,
    };
  }, [learning]);

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
      >
        Persona panel
      </PageTitle>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="card-surface p-4">
          <p className="type-meta text-muted-foreground">Personas</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{PERSONAS.length}</p>
        </div>
        <div className="card-surface p-4">
          <p className="type-meta text-muted-foreground">Showing</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{filtered.length}</p>
        </div>
        <div className="card-surface p-4">
          <p className="type-meta text-muted-foreground">Clusters</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{clusterCounts.length}</p>
        </div>
        <div className="card-surface p-4">
          <p className="type-meta text-muted-foreground">Missing artwork</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{missingCount}</p>
        </div>
      </div>

      <CommandGrid
        left={
          <div className="hidden xl:block">
            <RailCard title="Search & filters" icon={SlidersHorizontal}>
              <div className="space-y-3">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search personas…"
                    aria-label="Search personas"
                    className="h-9 rounded-xl pl-9"
                  />
                </div>
                <FilterField label="Platform">
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="h-9 rounded-xl" aria-label="Filter by platform">
                      <SelectValue placeholder="All platforms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All platforms</SelectItem>
                      {platforms.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Cluster">
                  <Select value={cluster} onValueChange={setCluster}>
                    <SelectTrigger className="h-9 rounded-xl" aria-label="Filter by cluster">
                      <SelectValue placeholder="All clusters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All clusters ({PERSONAS.length})</SelectItem>
                      {clusterCounts.map((c) => (
                        <SelectItem key={c.cluster} value={c.cluster}>
                          {c.cluster} ({c.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Segment">
                  <Select value={segment} onValueChange={setSegment}>
                    <SelectTrigger className="h-9 rounded-xl" aria-label="Filter by segment">
                      <SelectValue placeholder="All segments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All segments</SelectItem>
                      {segments.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Age">
                  <Select value={ageBand} onValueChange={setAgeBand}>
                    <SelectTrigger className="h-9 rounded-xl" aria-label="Filter by age">
                      <SelectValue placeholder="All ages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ages</SelectItem>
                      {AGE_BANDS.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Sort">
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger className="h-9 rounded-xl" aria-label="Sort personas">
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
                <div className="flex items-center gap-2">
                  <Button
                    variant={grouped ? "secondary" : "outline"}
                    className="h-9 flex-1 gap-2 rounded-xl"
                    onClick={() => setGrouped((v) => !v)}
                  >
                    <LayoutGrid className="size-4" /> {grouped ? "Clustered" : "Flat list"}
                  </Button>
                  {activeFilters > 0 ? (
                    <Button
                      variant="ghost"
                      className="h-9 rounded-xl type-meta text-muted-foreground"
                      onClick={clearAll}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>
            </RailCard>

            <RailCard title="Cluster mix" icon={Users}>
              <div>
                {clusterCounts.map((c) => (
                  <RailBar
                    key={c.cluster}
                    label={c.cluster}
                    value={c.count}
                    total={PERSONAS.length}
                    valueLabel={`${c.count}`}
                  />
                ))}
              </div>
            </RailCard>

            {learningSummary ? (
              <RailCard title="Adaptive learning" icon={Sparkles}>
                <RailStatList>
                  <RailStat label="Personas evolved" value={learningSummary.evolved} />
                  <RailStat label="Avg directness" value={`${learningSummary.directness}%`} />
                  <RailStat label="Avg official trust" value={`${learningSummary.trust}%`} />
                  <RailStat
                    label="Needs review"
                    value={learningSummary.review}
                    tone={learningSummary.review > 0 ? "negative" : "positive"}
                  />
                  <RailStat label="Learning frozen" value={learningSummary.frozen} tone="neutral" />
                </RailStatList>
              </RailCard>
            ) : null}
          </div>
        }
        right={
          <>
            <RailCard title="Actions" icon={Megaphone}>
              <div className="space-y-2">
                {missingCount > 0 && isAdminEmail(profile?.email) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-full gap-2 rounded-xl type-meta"
                    disabled={sync.isPending}
                    onClick={() => sync.mutate()}
                  >
                    {sync.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="size-3.5" />
                    )}
                    Load artwork ({missingCount} left)
                  </Button>
                ) : null}
                <RailAction
                  to="/campaign-manager"
                  icon={Megaphone}
                  title="Test a campaign"
                  description="Run messages past these personas"
                />
                <RailAction
                  to="/linked-accounts"
                  icon={Link2}
                  title="Linked accounts"
                  description="Manage connected platforms"
                />
              </div>
            </RailCard>

            <RailCard title="Guidance" icon={LifeBuoy}>
              <p className="type-meta leading-relaxed text-muted-foreground">
                Every persona reviews content through its own cluster, vibe, and decision style.
                Filter by segment or platform to focus testing on the audiences that matter most for
                a campaign.
              </p>
              <div className="mt-3">
                <RailAction
                  to="/help"
                  icon={LifeBuoy}
                  title="Help center"
                  description="Learn how persona scoring works"
                />
              </div>
            </RailCard>
          </>
        }
      >
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="type-meta text-muted-foreground">
              Showing {displayed.length} of {filtered.length} matching personas
            </p>
            {activeFilters > 0 ? (
              <Button variant="ghost" size="sm" className="xl:hidden" onClick={clearAll}>
                Clear filters
              </Button>
            ) : null}
          </div>

          <details className="mt-3 rounded-xl border border-border bg-muted/20 p-3 xl:hidden">
            <summary className="cursor-pointer list-none type-meta font-semibold text-foreground">
              Refine personas{activeFilters > 0 ? ` · ${activeFilters} active` : ""}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="relative min-w-0 sm:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search personas…"
                  aria-label="Search personas"
                  className="h-10 pl-9"
                />
              </div>
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
              <Button
                type="button"
                variant={grouped ? "secondary" : "outline"}
                className="h-10 self-end"
                onClick={() => setGrouped((value) => !value)}
              >
                {grouped ? "Clustered" : "Flat list"}
              </Button>
            </div>
          </details>

          {grouped ? (
            <div className="mt-4 space-y-8">
              {groups.map((group) => (
                <section key={group.cluster}>
                  <div className="flex items-center gap-2">
                    <h2 className="type-card">{group.cluster}</h2>
                    <span className="rounded-full bg-secondary px-2 py-1 type-meta text-secondary-foreground">
                      {group.personas.length}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {group.personas.map((persona) => (
                      <PersonaCard
                        key={persona.id}
                        persona={persona}
                        image={imageMap.get(persona.id)}
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {displayed.map((persona) => (
                <PersonaCard key={persona.id} persona={persona} image={imageMap.get(persona.id)} />
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
      </CommandGrid>
    </WorkspaceShell>
  );
}

function PersonaCard({ persona, image }: { persona: Persona; image?: PersonaImage | undefined }) {
  const [open, setOpen] = useState(false);
  const initials = persona.name
    .split(" ")
    .slice(0, 2)
    .map((name) => name[0])
    .join("");
  const topTraits = Object.entries(persona.traits ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <article
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      aria-expanded={open}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow duration-200 hover:shadow-lg"
    >
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

        <span className="mt-2 w-fit max-w-full truncate rounded-full bg-primary/10 px-2 py-0.5 type-meta font-medium text-primary">
          {persona.segment}
        </span>

        <div className="mt-auto flex flex-wrap gap-1 pt-3">
          {persona.platforms.slice(0, 3).map((platform) => (
            <span
              key={platform}
              className="max-w-full truncate rounded-full bg-secondary px-2 py-0.5 type-meta text-secondary-foreground"
            >
              {platform}
            </span>
          ))}
          {persona.platforms.length > 3 ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 type-meta text-muted-foreground">
              +{persona.platforms.length - 3}
            </span>
          ) : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 w-full justify-center border border-border"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide details" : "View details"}
        </Button>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
            open ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-border pt-3">
              <p className="type-meta text-muted-foreground">{persona.role}</p>
              <p className="mt-2 border-l-2 border-primary/40 pl-3 type-meta italic leading-relaxed text-foreground">
                “{persona.quote}”
              </p>

              <dl className="mt-3 space-y-1.5">
                <Row label="Cluster" value={personaCluster(persona)} />
                <Row label="Vibe" value={persona.vibe} />
                <Row label="Decides by" value={persona.decisionStyle} />
                <Row label="Platforms" value={persona.platforms.join(", ")} />
              </dl>

              {topTraits.length > 0 ? (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {topTraits.map(([trait, value]) => (
                    <div key={trait} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 truncate type-meta capitalize text-muted-foreground">
                        {trait}
                      </span>
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }}
                        />
                      </span>
                      <span className="w-7 shrink-0 text-right type-meta tabular-nums text-muted-foreground">
                        {Math.round(Math.min(1, value) * 100)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              <p className="mt-3 border-t border-border pt-3 type-meta leading-relaxed text-muted-foreground">
                {persona.profile}
              </p>

              {image ? (
                <p className="mt-3 truncate type-meta text-muted-foreground/70">
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
          </div>
        </div>
      </div>
    </article>
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
