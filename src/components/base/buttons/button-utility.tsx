import type { ComponentPropsWithoutRef } from "react";
import type { LucideIcon } from "lucide-react";

import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ButtonUtilityProps = Omit<ComponentPropsWithoutRef<typeof Button>, "children"> & {
  icon: LucideIcon;
  tooltip: string;
  tooltipDescription?: string;
  size?: "sm" | "md";
  color?: "secondary" | "ghost" | "destructive";
};

export function ButtonUtility({
  icon: Icon,
  tooltip,
  tooltipDescription,
  size = "sm",
  color = "secondary",
  className,
  ...props
}: ButtonUtilityProps) {
  const variant = color === "secondary" ? "outline" : color;

  return (
    <Tooltip title={tooltip} description={tooltipDescription}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="icon"
          aria-label={tooltip}
          className={cn(size === "sm" ? "size-8" : "size-9", "rounded-lg", className)}
          {...props}
        >
          <Icon aria-hidden="true" className={size === "sm" ? "size-4" : "size-[18px]"} />
        </Button>
      </TooltipTrigger>
    </Tooltip>
  );
}
