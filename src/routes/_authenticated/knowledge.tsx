import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BookOpen, Check, History, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, EmptyState, PageTitle } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createKnowledgeEntry,
  listKnowledgeEntries,
  listKnowledgeEntryVersions,
  setKnowledgeApprovalStatus,
  updateKnowledgeEntry,
  type KnowledgeCategory,
  type KnowledgeEntry,
} from "@/lib/knowledge.functions";
import { friendlyError } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/knowledge")({
  validateSearch: (search: Record<string, unknown>) => ({
    entry: typeof search["entry"] === "string" ? search["entry"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Knowledge Library - SMAIT" },
      {
        name: "description",
        content:
          "Approved facts, product details, terminology, brand positioning and previous statements Studio checks drafts against.",
      },
    ],
  }),
  component: KnowledgePage,
});

const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  fact: "Fact",
  product_detail: "Product detail",
  terminology: "Terminology",
  positioning: "Brand positioning",
  prior_statement: "Previous statement",
};

function StatusBadge({ entry }: { entry: KnowledgeEntry }) {
  if (entry.isExpired) return <Badge variant="destructive">Expired</Badge>;
  if (entry.approvalStatus === "approved")
    return (
      <Badge variant="secondary" className="bg-primary/10 text-primary">
        Approved
      </Badge>
    );
  if (entry.approvalStatus === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (entry.approvalStatus === "superseded") return <Badge variant="outline">Superseded</Badge>;
  return <Badge variant="outline">Pending review</Badge>;
}

function KnowledgePage() {
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(search.entry ?? null);

  const list = useServerFn(listKnowledgeEntries);
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["knowledge-entries"],
    queryFn: () => list({ data: { includeProjectSpecific: true } }),
  });

  const grouped = useMemo(() => {
    const map = new Map<KnowledgeCategory, KnowledgeEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return map;
  }, [entries]);

  return (
    <WorkspaceShell title="Knowledge Library">
      <PageTitle
        description="Approved facts, product details, terminology, brand positioning and previous statements. Studio checks drafts against approved entries and flags contradictions - AI-generated text is never treated as verified on its own."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" aria-hidden="true" />
            New entry
          </Button>
        }
      >
        Knowledge Library
      </PageTitle>

      {isLoading ? (
        <div className="space-y-3" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          visual={<BookOpen className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />}
          title="No approved knowledge yet"
          description="Add facts, terminology or positioning statements for Studio to check drafts against."
          action={
            <Button onClick={() => setCreateOpen(true)} variant="outline">
              New entry
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {(Object.keys(CATEGORY_LABELS) as KnowledgeCategory[]).map((category) => {
            const items = grouped.get(category);
            if (!items?.length) return null;
            return (
              <div key={category}>
                <h2 className="type-section mb-3">{CATEGORY_LABELS[category]}</h2>
                <div className="space-y-3">
                  {items.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      expanded={expandedId === entry.id}
                      onToggle={() => setExpandedId((id) => (id === entry.id ? null : entry.id))}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateEntryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["knowledge-entries"] })}
      />
    </WorkspaceShell>
  );
}

function EntryCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: KnowledgeEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(entry.content);
  const [changeNote, setChangeNote] = useState("");

  const setStatus = useServerFn(setKnowledgeApprovalStatus);
  const statusMutation = useMutation({
    mutationFn: (status: "pending" | "approved" | "rejected") =>
      setStatus({ data: { id: entry.id, status } }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-entries"] });
      toast.success(
        updated.approvalStatus === "approved"
          ? "Entry approved - Studio will use it as authoritative context."
          : updated.approvalStatus === "rejected"
            ? "Entry rejected"
            : "Entry returned to pending review",
      );
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const update = useServerFn(updateKnowledgeEntry);
  const updateMutation = useMutation({
    mutationFn: () =>
      update({ data: { id: entry.id, content, changeNote: changeNote || "Content edited" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-entries"] });
      setChangeNote("");
      toast.success("Entry updated - a previously approved entry returns to pending review.");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const versionsFn = useServerFn(listKnowledgeEntryVersions);
  const { data: versions } = useQuery({
    queryKey: ["knowledge-entry-versions", entry.id],
    queryFn: () => versionsFn({ data: { entryId: entry.id } }),
    enabled: expanded,
  });

  const dirty = content !== entry.content;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onToggle}
            className="text-left font-semibold hover:underline"
            aria-expanded={expanded}
          >
            {entry.title}
          </button>
          <p className="mt-1 type-meta text-muted-foreground">
            v{entry.version}
            {entry.source ? ` · Source: ${entry.source}` : ""}
            {entry.expiryDate ? ` · Expires ${entry.expiryDate}` : ""}
          </p>
        </div>
        <StatusBadge entry={entry} />
      </div>

      {!expanded ? (
        <p className="mt-2 line-clamp-2 type-body text-muted-foreground">{entry.content}</p>
      ) : (
        <div className="mt-3 space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-24"
            aria-label={`Content for ${entry.title}`}
          />
          {dirty && (
            <div className="space-y-2">
              <Input
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="What changed, and why? (optional)"
              />
              <Button
                size="sm"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving…" : "Save change"}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {entry.approvalStatus !== "approved" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => statusMutation.mutate("approved")}
                disabled={statusMutation.isPending}
              >
                <Check className="size-3.5" aria-hidden="true" />
                Approve
              </Button>
            )}
            {entry.approvalStatus !== "rejected" && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                onClick={() => statusMutation.mutate("rejected")}
                disabled={statusMutation.isPending}
              >
                <X className="size-3.5" aria-hidden="true" />
                Reject
              </Button>
            )}
          </div>

          {versions && versions.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="mb-2 flex items-center gap-1.5 type-meta font-medium text-muted-foreground">
                <History className="size-3.5" aria-hidden="true" />
                Revision history
              </p>
              <ul className="space-y-2">
                {versions.map((v) => (
                  <li key={v.id} className="type-meta text-muted-foreground">
                    v{v.version} — {v.changeNote || "No note"} (
                    {new Date(v.createdAt).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function CreateEntryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<KnowledgeCategory>("fact");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const create = useServerFn(createKnowledgeEntry);
  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          category,
          title: title.trim(),
          content: content.trim(),
          source: source.trim(),
          ...(expiryDate ? { expiryDate } : {}),
        },
      }),
    onSuccess: () => {
      onCreated();
      toast.success("Entry added - pending review before Studio treats it as authoritative.");
      onOpenChange(false);
      setTitle("");
      setContent("");
      setSource("");
      setExpiryDate("");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New knowledge entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as KnowledgeCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as KnowledgeCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="entry-title">Title</Label>
            <Input
              id="entry-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="entry-content">Content</Label>
            <Textarea
              id="entry-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-24"
              placeholder="The approved fact, definition or statement itself"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="entry-source">Source</Label>
            <Input
              id="entry-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Where this was verified or approved"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="entry-expiry">Expiry date (optional)</Label>
            <Input
              id="entry-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!title.trim() || !content.trim() || mutation.isPending}
          >
            {mutation.isPending ? "Adding…" : "Add entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
