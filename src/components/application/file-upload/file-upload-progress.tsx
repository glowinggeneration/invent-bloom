import { AlertCircle, CheckCircle2, File, RefreshCw, Trash2 } from "lucide-react";

import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { UploadProgressItem } from "./use-media-upload-queue";

function readableFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadProgressList({
  items,
  onRetry,
  onRemove,
  className,
}: {
  items: UploadProgressItem[];
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <ul className={cn("grid gap-2", className)} aria-live="polite">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {item.status === "failed" ? (
                <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
              ) : item.status === "complete" ? (
                <CheckCircle2 className="size-4 text-positive" aria-hidden="true" />
              ) : (
                <File className="size-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {item.error ??
                      `${readableFileSize(item.size)} · ${
                        item.status === "reading"
                          ? "Preparing"
                          : item.status === "uploading"
                            ? "Uploading"
                            : "Ready"
                      }`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.status === "failed" ? (
                    <ButtonUtility
                      size="sm"
                      color="ghost"
                      tooltip={`Retry ${item.name}`}
                      icon={RefreshCw}
                      onClick={() => onRetry(item.id)}
                    />
                  ) : null}
                  <ButtonUtility
                    size="sm"
                    color="ghost"
                    tooltip={`Remove ${item.name}`}
                    icon={Trash2}
                    onClick={() => onRemove(item.id)}
                  />
                </div>
              </div>
              <Progress
                value={item.progress}
                className={cn("mt-2 h-1.5", item.status === "failed" && "[&>div]:bg-destructive")}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
