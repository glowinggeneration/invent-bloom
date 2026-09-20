import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Check,
  EyeOff,
  FileCheck2,
  FileText,
  Gauge,
  Pencil,
  Plus,
  SquarePen,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, EmptyState, PageTitle, SectionTitle } from "@/components/ui-kit";
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
import {
  addProjectReference,
  deleteProjectReference,
  listProjectItems,
  listProjectReferences,
  listProjects,
  renameProject,
  setProjectStatus,
  updateProjectContext,
  updateProjectReference,
  type LinkableItemType,
} from "@/lib/projects.functions";
import { friendlyError } from "@/lib/friendly-errors";
import { listKnowledgeEntries } from "@/lib/knowledge.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [{ title: "Project - SMAIT" }],
  }),
  component: ProjectDetailPage,
});

const ITEM_TYPE_META: Record<
  LinkableItemType,
  { label: string; icon: typeof FileText; to: string }
> = {
  thread: { label: "Message test", icon: SquarePen, to: "/chat/$id" },
  campaign: { label: "Campaign", icon: Gauge, to: "/campaign-proof" },
  listening_campaign: { label: "Campaign", icon: Gauge, to: "/campaign-proof" },
  report: { label: "Report", icon: FileText, to: "/reports/$id" },
  managed_report: { label: "Report", icon: FileCheck2, to: "/reports" },
};

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const { current, selectProject } = useCurrentProject();
  const queryClient = useQueryClient();

  const fetchProjects = useServerFn(listProjects);
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => fetchProjects() });
  const project = projectsQuery.data?.find((p) => p.id === id);

  const fetchReferences = useServerFn(listProjectReferences);
  const referencesQuery = useQuery({
    queryKey: ["project-references", id],
    queryFn: () => fetchReferences({ data: { projectId: id } }),
    enabled: Boolean(project),
  });

  const fetchItems = useServerFn(listProjectItems);
  const itemsQuery = useQuery({
    queryKey: ["project-items", id],
    queryFn: () => fetchItems({ data: { projectId: id } }),
    enabled: Boolean(project),
  });

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => {
    if (project) setName(project.name);
  }, [project?.name]);

  const rename = useServerFn(renameProject);
  const renameMutation = useMutation({
    mutationFn: () => rename({ data: { id, name: name.trim() } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setRenaming(false);
      toast.success("Renamed");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const [objective, setObjective] = useState("");
  const [brief, setBrief] = useState("");
  useEffect(() => {
    if (project) {
      setObjective(project.objective);
      setBrief(project.brief);
    }
  }, [project?.objective, project?.brief]);

  const saveContext = useServerFn(updateProjectContext);
  const contextMutation = useMutation({
    mutationFn: () => saveContext({ data: { id, objective, brief } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Context saved");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });
  const contextDirty = project && (objective !== project.objective || brief !== project.brief);

  const setStatus = useServerFn(setProjectStatus);
  const statusMutation = useMutation({
    mutationFn: (status: "active" | "archived") => setStatus({ data: { id, status } }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(updated.status === "archived" ? "Project archived" : "Project restored");
      if (updated.status === "archived" && current?.id === id) selectProject(null);
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const [addRefOpen, setAddRefOpen] = useState(false);
  const [refTitle, setRefTitle] = useState("");
  const [refContent, setRefContent] = useState("");
  const addRef = useServerFn(addProjectReference);
  const addRefMutation = useMutation({
    mutationFn: () =>
      addRef({ data: { projectId: id, title: refTitle.trim(), content: refContent } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-references", id] });
      setAddRefOpen(false);
      setRefTitle("");
      setRefContent("");
      toast.success("Reference added");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const toggleRef = useServerFn(updateProjectReference);
  const toggleRefMutation = useMutation({
    mutationFn: (vars: { id: string; excluded: boolean }) => toggleRef({ data: vars }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-references", id] }),
    onError: (error) => toast.error(friendlyError(error)),
  });

  const fetchKnowledge = useServerFn(listKnowledgeEntries);
  const knowledgeQuery = useQuery({
    queryKey: ["knowledge-entries", "project", id],
    queryFn: () => fetchKnowledge({ data: { projectId: id, includeProjectSpecific: false } }),
    enabled: Boolean(project),
  });

  const deleteRef = useServerFn(deleteProjectReference);
  const deleteRefMutation = useMutation({
    mutationFn: (refId: string) => deleteRef({ data: { id: refId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-references", id] });
      toast.success("Reference removed");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  if (projectsQuery.isLoading) {
    return (
      <WorkspaceShell title="Project">
        <div className="h-48 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
      </WorkspaceShell>
    );
  }

  if (!project) {
    return (
      <WorkspaceShell title="Project">
        <EmptyState
          title="Project not found"
          description="It may have been removed, or you may not have access to it."
          action={
            <Button asChild variant="outline">
              <Link to="/projects">Back to projects</Link>
            </Button>
          }
        />
      </WorkspaceShell>
    );
  }

  const references = referencesQuery.data ?? [];
  const includedCount = references.filter((r) => !r.excluded).length;

  return (
    <WorkspaceShell title={project.name}>
      <PageTitle
        description={
          project.status === "archived" ? "Archived - historical work stays accessible." : undefined
        }
        actions={
          current?.id === id ? (
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
              <Check className="size-3" aria-hidden="true" />
              Active project
            </Badge>
          ) : project.status === "active" ? (
            <Button variant="outline" size="sm" onClick={() => selectProject(id)}>
              Set active
            </Button>
          ) : undefined
        }
      >
        {renaming ? (
          <span className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 max-w-xs"
              autoFocus
            />
            <Button
              size="sm"
              onClick={() => renameMutation.mutate()}
              disabled={!name.trim() || renameMutation.isPending}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            {project.name}
            <button
              type="button"
              onClick={() => setRenaming(true)}
              aria-label="Rename project"
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          </span>
        )}
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Context panel: what instructions/references a task from this
              project will use. Edit is inline; exclude is per-reference. */}
          <Card>
            <SectionTitle>Objective &amp; brief</SectionTitle>
            <p className="mt-1 type-meta text-muted-foreground">
              The instructions tasks started from this project will use.
            </p>
            <div className="mt-4 space-y-4">
              <div className="space-y-1">
                <Label htmlFor="objective">Objective</Label>
                <Textarea
                  id="objective"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="min-h-20"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="brief">Brief</Label>
                <Textarea
                  id="brief"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  className="min-h-28"
                />
              </div>
              {contextDirty ? (
                <Button
                  size="sm"
                  onClick={() => contextMutation.mutate()}
                  disabled={contextMutation.isPending}
                >
                  {contextMutation.isPending ? "Saving…" : "Save context"}
                </Button>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <div>
                <SectionTitle>Linked work</SectionTitle>
                <p className="mt-1 type-meta text-muted-foreground">
                  Existing records kept together here - nothing is duplicated.
                </p>
              </div>
            </div>
            <div className="mt-4">
              {itemsQuery.isLoading ? (
                <div className="space-y-2" aria-hidden="true">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-11 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : (itemsQuery.data ?? []).length === 0 ? (
                <EmptyState
                  title="Nothing linked yet"
                  description="Investigate, test or launch a campaign, then save it to this project."
                />
              ) : (
                <ul className="space-y-2">
                  {(itemsQuery.data ?? []).map((item) => {
                    const meta = ITEM_TYPE_META[item.itemType];
                    const Icon = meta.icon;
                    return (
                      <li
                        key={`${item.itemType}-${item.id}`}
                        className="flex items-center gap-3 rounded-xl border border-border p-3"
                      >
                        <Icon
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{item.title}</span>
                          <span className="block type-meta text-muted-foreground">
                            {meta.label}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>References</SectionTitle>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setAddRefOpen(true)}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add
              </Button>
            </div>
            <p className="mt-1 type-meta text-muted-foreground">
              {includedCount} of {references.length} in use for tasks.
            </p>
            <div className="mt-4">
              {referencesQuery.isLoading ? (
                <div className="space-y-2" aria-hidden="true">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : references.length === 0 ? (
                <p className="type-meta text-muted-foreground">No reference material yet.</p>
              ) : (
                <ul className="space-y-2">
                  {references.map((ref) => (
                    <li
                      key={ref.id}
                      className={cn(
                        "rounded-xl border border-border p-3",
                        ref.excluded && "opacity-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate font-medium">{ref.title}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            aria-label={ref.excluded ? "Include in tasks" : "Exclude from tasks"}
                            aria-pressed={ref.excluded}
                            onClick={() =>
                              toggleRefMutation.mutate({ id: ref.id, excluded: !ref.excluded })
                            }
                            className="text-muted-foreground hover:text-foreground"
                            title={
                              ref.excluded
                                ? "Excluded - click to include"
                                : "Included - click to exclude"
                            }
                          >
                            <EyeOff className="size-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete reference"
                            onClick={() => deleteRefMutation.mutate(ref.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      {ref.content ? (
                        <p className="mt-1 line-clamp-2 type-meta text-muted-foreground">
                          {ref.content}
                        </p>
                      ) : null}
                      {ref.excluded ? (
                        <Badge variant="outline" className="mt-2 text-[10px]">
                          Excluded from tasks
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>Project knowledge</SectionTitle>
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link to="/knowledge" search={{ entry: undefined }}>
                  <BookOpen className="size-3.5" aria-hidden="true" />
                  Open library
                </Link>
              </Button>
            </div>
            <p className="mt-1 type-meta text-muted-foreground">
              {(knowledgeQuery.data ?? []).length === 0
                ? "No project-specific entries yet - organisation-wide approved knowledge still applies."
                : `${(knowledgeQuery.data ?? []).filter((e) => e.approvalStatus === "approved").length} approved entry(ies) specific to this project.`}
            </p>
          </Card>

          <Card>
            <SectionTitle>Status</SectionTitle>
            <p className="mt-1 type-meta text-muted-foreground">
              Archiving keeps everything linked to this project accessible - it only removes it from
              the active list.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() =>
                statusMutation.mutate(project.status === "active" ? "archived" : "active")
              }
              disabled={statusMutation.isPending}
            >
              {project.status === "active" ? (
                <>
                  <Archive className="size-3.5" aria-hidden="true" />
                  Archive project
                </>
              ) : (
                <>
                  <ArchiveRestore className="size-3.5" aria-hidden="true" />
                  Restore project
                </>
              )}
            </Button>
          </Card>
        </div>
      </div>

      <Dialog open={addRefOpen} onOpenChange={setAddRefOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add reference</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="ref-title">Title</Label>
              <Input
                id="ref-title"
                value={refTitle}
                onChange={(e) => setRefTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ref-content">Content</Label>
              <Textarea
                id="ref-content"
                value={refContent}
                onChange={(e) => setRefContent(e.target.value)}
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRefOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addRefMutation.mutate()}
              disabled={!refTitle.trim() || addRefMutation.isPending}
            >
              {addRefMutation.isPending ? "Adding…" : "Add reference"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
