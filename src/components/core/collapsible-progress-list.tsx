/** Collapsible list of people/tasks with progress — shows the first two, expands to reveal the rest. */
import { useState } from "react";
import { ChevronUp } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type ProgressListItem = {
  id: string;
  name: string;
  role: string;
  progress: number;
  avatarUrl?: string;
  fallback: string;
};

export type CollapsibleProgressListProps = {
  title: string;
  items: ProgressListItem[];
  visibleCount?: number;
  className?: string;
};

export function CollapsibleProgressList({
  title,
  items,
  visibleCount = 2,
  className,
}: CollapsibleProgressListProps) {
  const [open, setOpen] = useState(false);
  const visible = items.slice(0, visibleCount);
  const hidden = items.slice(visibleCount);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn("flex w-full max-w-sm flex-col items-start gap-4 p-4", className)}
    >
      <div className="font-medium">{title}</div>
      <ul className="flex w-full flex-col gap-3">
        {visible.map((item) => (
          <ProgressRow key={item.id} item={item} />
        ))}
        {hidden.length > 0 && (
          <CollapsibleContent className="flex flex-col gap-3">
            {hidden.map((item) => (
              <ProgressRow key={item.id} item={item} />
            ))}
          </CollapsibleContent>
        )}
      </ul>
      {hidden.length > 0 && (
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="border-border/70">
            <span>{open ? "Show less" : "Show more"}</span>
            <ChevronUp
              aria-hidden="true"
              className={cn("size-4 transition-transform", open ? "" : "rotate-180")}
            />
          </Button>
        </CollapsibleTrigger>
      )}
    </Collapsible>
  );
}

function ProgressRow({ item }: { item: ProgressListItem }) {
  return (
    <li className="flex items-start gap-4 rounded-md border border-border/60 px-3 py-2">
      <Avatar>
        {item.avatarUrl && <AvatarImage src={item.avatarUrl} alt={item.name} />}
        <AvatarFallback>{item.fallback}</AvatarFallback>
      </Avatar>
      <div className="flex flex-1 flex-col">
        <div className="text-sm font-medium">{item.name}</div>
        <p className="text-xs text-muted-foreground">{item.role}</p>
      </div>
      <span className="text-sm text-muted-foreground">{`${item.progress}%`}</span>
    </li>
  );
}
