import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, FolderKanban, Plus } from "lucide-react";
import { useCurrentProject } from "@/hooks/use-current-project";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Header-level active-project indicator and switcher. Deliberately a small
 * ambient control, not a sixth primary nav destination/mobile tab -
 * switching context should stay reachable from anywhere without competing
 * with the five destinations for tab-bar space.
 */
export function ProjectSwitcher() {
  const { current, projects, selectProject } = useCurrentProject();
  const active = projects.filter((p) => p.status === "active");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden h-10 max-w-48 shrink-0 gap-1.5 sm:inline-flex"
          aria-label={current ? `Active project: ${current.name}` : "No active project selected"}
        >
          <FolderKanban className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 truncate">{current ? current.name : "No project"}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Active project</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => selectProject(null)}>
          <span className="flex w-full items-center justify-between gap-2">
            <span className="text-muted-foreground">No project</span>
            {!current ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
          </span>
        </DropdownMenuItem>
        {active.length > 0 ? <DropdownMenuSeparator /> : null}
        {active.map((project) => (
          <DropdownMenuItem key={project.id} onClick={() => selectProject(project.id)}>
            <span className="flex w-full min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate">{project.name}</span>
              {current?.id === project.id ? (
                <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : null}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/projects" className="flex w-full items-center gap-2">
            <Plus className="size-4" aria-hidden="true" />
            Manage projects
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
