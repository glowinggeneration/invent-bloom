import type { ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";

const SIZE_STYLES = {
  sm: {
    avatar: "size-8",
    title: "type-meta font-semibold",
    subtitle: "text-[11px]",
  },
  md: {
    avatar: "size-10",
    title: "type-body font-semibold",
    subtitle: "type-meta",
  },
  lg: {
    avatar: "size-16",
    title: "type-card font-semibold",
    subtitle: "type-meta",
  },
} as const;

export type AvatarLabelGroupProps = {
  size?: keyof typeof SIZE_STYLES;
  src?: string | null;
  alt?: string;
  title: string;
  subtitle?: string;
  className?: string;
  trailing?: ReactNode;
};

export function AvatarLabelGroup({
  size = "md",
  src,
  alt,
  title,
  subtitle,
  className,
  trailing,
}: AvatarLabelGroupProps) {
  const styles = SIZE_STYLES[size];

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Avatar className={cn("border border-border bg-muted shadow-sm", styles.avatar)}>
        {src ? <AvatarImage src={src} alt={alt ?? title} className="object-cover" /> : null}
        <AvatarFallback className="bg-positive font-semibold text-navy-foreground">
          {initialsOf(title)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-foreground", styles.title)}>{title}</p>
        {subtitle ? (
          <p className={cn("mt-0.5 truncate text-muted-foreground", styles.subtitle)}>{subtitle}</p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
