/** Small "About this app" info popover, triggered from an icon button. Uses semantic tokens instead of hardcoded neutral/orange colors. */
import { ExternalLink, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type AboutPopoverProps = {
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  buildLabel?: string;
};

export function AboutPopover({
  title = "SMAIT",
  description = "Communications intelligence for tracking mentions, sentiment and campaign performance across platforms.",
  ctaLabel = "View changelog",
  ctaHref = "/changelog",
  buildLabel,
}: AboutPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-xl">
          <Info aria-hidden="true" className="size-4" />
          <span className="sr-only">About {title}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 rounded-2xl border-border bg-popover p-6 shadow-xl">
        <div className="flex flex-col gap-7 text-center">
          <div className="flex flex-col gap-2">
            <div className="text-xl font-bold tracking-tight text-foreground">{title}</div>
            <p className="mx-auto max-w-[240px] text-xs font-medium leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="flex flex-col gap-5">
            <Button size="sm" className="h-10 gap-2 rounded-xl" asChild>
              <a href={ctaHref}>
                {ctaLabel}
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            </Button>
            {buildLabel && (
              <div className="text-[11px] font-medium tracking-tight text-muted-foreground/70">
                {buildLabel}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
