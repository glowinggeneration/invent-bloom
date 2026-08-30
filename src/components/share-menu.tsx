import { Check, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/friendly-errors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Deep links that always resolve to the signed-in user's most recent test,
 * so a shared URL keeps working after new tests are run.
 */
export function latestAnalysisLink(origin: string) {
  return `${origin}/testing?step=analysis`;
}

export function latestRecommendationsLink(origin: string) {
  return `${origin}/testing?step=recommendations`;
}

type ShareTarget = { label: string; description: string; url: () => string };

export function ShareMenu({
  threadId,
  label = "Share",
}: {
  /** When present, adds permanent links to this exact test. */
  threadId?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const targets: ShareTarget[] = [
    {
      label: "Latest analysis",
      description: "Opens the newest test results",
      url: () => latestAnalysisLink(window.location.origin),
    },
    {
      label: "Latest recommendations",
      description: "Opens the newest rewrites",
      url: () => latestRecommendationsLink(window.location.origin),
    },
  ];

  if (threadId) {
    targets.push(
      {
        label: "This analysis",
        description: "Permanent link to this test",
        url: () => `${window.location.origin}/chat/${threadId}`,
      },
      {
        label: "These recommendations",
        description: "Permanent link to these rewrites",
        url: () => `${window.location.origin}/recommendations/${threadId}`,
      },
    );
  }

  async function share(target: ShareTarget) {
    const url = target.url();
    try {
      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: "CommsIQ", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(target.label);
      window.setTimeout(() => setCopied(null), 2000);
      toast.success(`${target.label} link copied.`);
    } catch (err) {
      toast.error(friendlyError(err, { action: "share this link" }));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
          <Share2 className="size-3.5" /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Share a deep link</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {targets.map((target) => (
          <DropdownMenuItem
            key={target.label}
            className="flex-col items-start gap-0.5"
            onSelect={(event) => {
              event.preventDefault();
              void share(target);
            }}
          >
            <span className="flex w-full items-center gap-2 text-sm font-medium">
              {copied === target.label ? (
                <Check className="size-3.5 text-fkf-green" />
              ) : (
                <Link2 className="size-3.5 text-muted-foreground" />
              )}
              {target.label}
            </span>
            <span className="pl-5 text-xs text-muted-foreground">{target.description}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
          Latest links always open whichever test ran most recently: {origin}/testing?step=analysis
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
