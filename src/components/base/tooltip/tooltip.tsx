import type { ReactNode } from "react";

import {
  Tooltip as TooltipRoot,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type TooltipProps = {
  title: string;
  description?: string | undefined;
  children: ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
};

function Tooltip({ title, description, children, className, side = "top" }: TooltipProps) {
  return (
    <TooltipProvider delayDuration={250}>
      <TooltipRoot>
        {children}
        <TooltipContent
          side={side}
          className={cn("max-w-72 rounded-xl px-3 py-2.5 text-left", className)}
        >
          <p className="text-xs font-semibold text-popover-foreground">{title}</p>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

export { Tooltip, TooltipTrigger };
