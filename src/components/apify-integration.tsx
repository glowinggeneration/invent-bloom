import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui-kit";
import { testApifyConnection } from "@/lib/apify.functions";

export function ApifyIntegrationCard() {
  const test = useServerFn(testApifyConnection);
  const check = useMutation({ mutationFn: () => test({}) });

  const status = check.data?.connected
    ? "Connected"
    : check.isSuccess
      ? "Not Connected"
      : check.isError
        ? "Not Connected"
        : "Unknown";

  return (
    <Card>
      <h2 className="flex items-center gap-2 type-card">
        <Plug className="size-4 text-primary" /> Apify
      </h2>
      <p className="mt-2 type-body text-muted-foreground">
        Status:{" "}
        <span
          className={
            status === "Connected"
              ? "font-semibold text-fkf-green"
              : "font-semibold text-muted-foreground"
          }
        >
          {check.isPending ? "Checking…" : status}
        </span>
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => check.mutate()}
        disabled={check.isPending}
      >
        Test Connection
      </Button>
    </Card>
  );
}
