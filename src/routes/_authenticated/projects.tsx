import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ArchiveRestore, Check, FolderKanban, Plus } from "lucide-react";
import { toast } from "sonner";

import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, EmptyState, PageTitle } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentProject } from "@/hooks/use-current-project";
import { createProject, setProjectStatus, type Project } from "@/lib/projects.functions";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects - SMAIT" },
      {
        name: "description",
        content:
          "Keep a communications objective, brief, references, investigations, message tests, campaigns and reports together in one project.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { current, projects, isLoading, selectProject } = useCurrentProject();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [brief, setBrief] = useState("");

  const create = useServerFn(createProject);
  const createMutation = useMutation({
    mutationFn: () => create({ data: { name: name.trim(), objective, brief } }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`"${project.name}" created`);
      setCreateOpen(false);
      setName("");
      setObjective("");
      setBrief("");
      selectProject(project.id);
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const setStatus = useServerFn(setProjectStatus);
  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: "active" | "archived" }) => setStatus({ data: vars }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(project.status === "archived" ? "Project archived" : "Project restored");
      if (project.status === "archived" && current?.id === project.id) selectProject(null);
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const active = projects.filter((p) => p.status === "active");
  const archived = projects.filter((p) => p.status === "archived");

  return (
    <WorkspaceShell title="Projects">
      <PageTitle
        description="Keep a communications objective, brief, references, investigations, message tests, campaigns and reports together."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" aria-hidden="true" />
            New project
          </Button>
        }
      >
        Projects
      </PageTitle>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project to keep everything about one communications objective together."
          action={
            <Button onClick={() => setCreateOpen(true)} variant="outline">
              New project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isCurrent={current?.id === project.id}
              onSelect={() => selectProject(project.id)}
              onArchive={() => statusMutation.mutate({ id: project.id, status: "archived" })}
            />
          ))}
        </div>
      )}

      {archived.length > 0 ? (
        <div className="mt-8">
          <h2 className="type-section mb-3">Archived</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isCurrent={false}
                archived
                onRestore={() => statusMutation.mutate({ id: project.id, status: "active" })}
              />
            ))}
          </div>
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 product launch"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="project-objective">Objective</Label>
              <Textarea
                id="project-objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="What is this project trying to achieve?"
                className="min-h-20"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="project-brief">Brief</Label>
              <Textarea
                id="project-brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Instructions and context future tasks should use"
                className="min-h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}

function ProjectCard({
  project,
  isCurrent,
  archived,
  onSelect,
  onArchive,
  onRestore,
}: {
  project: Project;
  isCurrent: boolean;
  archived?: boolean;
  onSelect?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}) {
  return (
    <Card className={isCurrent ? "ring-1 ring-primary/40" : undefined}>
      <div className="flex items-start justify-between gap-2">
        <Link
          to="/projects/$id"
          params={{ id: project.id }}
          className="flex min-w-0 items-center gap-2 font-semibold hover:underline"
        >
          <FolderKanban className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 truncate">{project.name}</span>
        </Link>
        {isCurrent ? (
          <Badge variant="secondary" className="shrink-0 gap-1 bg-primary/10 text-primary">
            <Check className="size-3" aria-hidden="true" />
            Active
          </Badge>
        ) : null}
      </div>
      {project.objective ? (
        <p className="mt-2 line-clamp-2 type-meta text-muted-foreground">{project.objective}</p>
      ) : (
        <p className="mt-2 type-meta italic text-muted-foreground">No objective set yet.</p>
      )}
      <div className="mt-4 flex items-center gap-2">
        {archived ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRestore}>
            <ArchiveRestore className="size-3.5" aria-hidden="true" />
            Restore
          </Button>
        ) : (
          <>
            {!isCurrent ? (
              <Button variant="outline" size="sm" onClick={onSelect}>
                Set active
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={onArchive}
            >
              <Archive className="size-3.5" aria-hidden="true" />
              Archive
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
