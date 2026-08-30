/** Shared empty-state placeholder for the smait chart primitives. */
export function ChartEmpty({
  hint = "No records yet for this window.",
}: {
  hint?: string | undefined;
}) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
      {hint}
    </div>
  );
}
