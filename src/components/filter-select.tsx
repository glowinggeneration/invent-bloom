import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterOption<T extends string = string> = {
  value: T;
  label: string;
  count?: number;
};

type Props<T extends string> = {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: FilterOption<T>[];
  className?: string;
  triggerClassName?: string;
};

/**
 * Simple, professional dropdown filter used across the app.
 * Label sits above a compact select so filter rows stay quiet and consistent.
 */
export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
  triggerClassName,
}: Props<T>) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
      <span className="type-meta font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger
          aria-label={label}
          className={`h-9 rounded-xl border-border bg-background text-sm ${triggerClassName ?? "w-full sm:w-48"}`}
        >
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
              {typeof o.count === "number" ? (
                <span className="ml-1 tabular-nums text-muted-foreground">({o.count})</span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
