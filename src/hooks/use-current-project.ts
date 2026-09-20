import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProjects, type Project } from "@/lib/projects.functions";
import { readCurrentProjectId, writeCurrentProjectId } from "@/lib/current-project";

/**
 * The active project, persisted across sessions via localStorage but
 * always re-validated against the real, workspace-scoped project list -
 * see current-project.ts for why a stale/foreign id here can never expose
 * another workspace's data (the underlying list is already RLS-scoped).
 */
export function useCurrentProject() {
  const fetchProjects = useServerFn(listProjects);
  const query = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(),
    staleTime: 30_000,
  });

  const [projectId, setProjectId] = useState<string | null>(() => readCurrentProjectId());

  const projects = query.data ?? [];
  // A stored id that no longer resolves to a real, accessible project
  // (deleted, archived elsewhere, or simply never valid) just falls back
  // to "no active project" rather than pointing at nothing.
  const current: Project | null =
    (projectId && projects.find((p) => p.id === projectId && p.status === "active")) || null;

  useEffect(() => {
    if (!query.isSuccess) return;
    if (projectId && !current) {
      setProjectId(null);
      writeCurrentProjectId(null);
    }
  }, [query.isSuccess, projectId, current]);

  function selectProject(id: string | null) {
    setProjectId(id);
    writeCurrentProjectId(id);
  }

  return { current, projects, isLoading: query.isLoading, selectProject };
}
