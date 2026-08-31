/**
 * Generic filterable/selectable data table: text search, min/max numeric
 * range filters, a select filter, row + select-all checkboxes (tri-state),
 * and a status badge column. Rows are typed via `T`; callers supply column
 * accessors so this has no dependency on any specific data model.
 */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type FilterableDataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
};

export type FilterableDataTableProps<T> = {
  rows: T[];
  getId: (row: T) => string;
  /** Fields the free-text search box matches against. */
  searchableText: (row: T) => string;
  /** Optional numeric field enabling min/max range filters (e.g. price). */
  numericField?: { label: string; getValue: (row: T) => number };
  /** Optional categorical field rendered as a Select + a status badge column. */
  statusField?: {
    label: string;
    getValue: (row: T) => string;
    options: string[];
    badgeClassName?: (value: string) => string;
  };
  avatarField?: { getUrl: (row: T) => string | undefined; getFallback: (row: T) => string };
  titleColumn: { header: string; render: (row: T) => React.ReactNode };
  extraColumns?: FilterableDataTableColumn<T>[];
  className?: string;
};

export function FilterableDataTable<T>({
  rows,
  getId,
  searchableText,
  numericField,
  statusField,
  avatarField,
  titleColumn,
  extraColumns = [],
  className,
}: FilterableDataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minValue.trim() ? Number(minValue) : undefined;
    const max = maxValue.trim() ? Number(maxValue) : undefined;
    return rows.filter((row) => {
      const matchesText = q ? searchableText(row).toLowerCase().includes(q) : true;
      const matchesStatus =
        statusField && status !== "all" ? statusField.getValue(row) === status : true;
      const value = numericField?.getValue(row);
      const matchesMin = min !== undefined && value !== undefined ? value >= min : true;
      const matchesMax = max !== undefined && value !== undefined ? value <= max : true;
      return matchesText && matchesStatus && matchesMin && matchesMax;
    });
  }, [rows, query, minValue, maxValue, status, searchableText, statusField, numericField]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = filtered.map(getId);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));
  const someSelected = visibleIds.some((id) => selectedIdSet.has(id)) && !allSelected;

  function toggleAll(checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, ...visibleIds]))
        : current.filter((id) => !visibleIds.includes(id)),
    );
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((x) => x !== id),
    );
  }

  const columnCount =
    1 +
    (avatarField ? 0 : 0) +
    1 +
    (numericField ? 1 : 0) +
    (statusField ? 1 : 0) +
    extraColumns.length;

  return (
    <div className={cn("mx-auto w-full", className)}>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
        <div className="grid gap-3 border-b border-dashed border-border/60 px-4 py-5 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
          <div className="space-y-2">
            <Label htmlFor="table-search">{titleColumn.header}</Label>
            <div className="relative">
              <Input
                id="table-search"
                className="h-10 rounded-md border-border/60 pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Search aria-hidden="true" size={16} />
              </div>
            </div>
          </div>
          {numericField && (
            <div className="space-y-2">
              <Label>{numericField.label}</Label>
              <div className="flex">
                <Input
                  className="h-10 rounded-r-none border-border/60"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                  placeholder="Min"
                  type="number"
                />
                <Input
                  className="-ms-px h-10 rounded-l-none border-border/60"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                  placeholder="Max"
                  type="number"
                />
              </div>
            </div>
          )}
          {statusField && (
            <div className="space-y-2">
              <Label htmlFor="table-status">{statusField.label}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger
                  id="table-status"
                  className="h-10 w-full rounded-lg border-border/60"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {statusField.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-12 w-10 border-b border-dashed border-border/60 bg-transparent font-medium">
                <Checkbox
                  checked={someSelected ? "indeterminate" : allSelected}
                  onCheckedChange={(value) => toggleAll(value === true)}
                  aria-label="Select all rows"
                />
              </TableHead>
              <TableHead className="h-12 border-b border-dashed border-border/60 bg-transparent text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {titleColumn.header}
              </TableHead>
              {numericField && (
                <TableHead className="h-12 border-b border-dashed border-border/60 bg-transparent text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {numericField.label}
                </TableHead>
              )}
              {statusField && (
                <TableHead className="h-12 border-b border-dashed border-border/60 bg-transparent text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {statusField.label}
                </TableHead>
              )}
              {extraColumns.map((col) => (
                <TableHead
                  key={col.key}
                  className="h-12 border-b border-dashed border-border/60 bg-transparent text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? (
              filtered.map((row) => {
                const id = getId(row);
                const isSelected = selectedIdSet.has(id);
                return (
                  <TableRow
                    key={id}
                    data-state={isSelected ? "selected" : undefined}
                    className="transition-colors hover:bg-muted/10 data-[state=selected]:bg-muted/15"
                  >
                    <TableCell className="py-3.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(value) => toggleRow(id, value === true)}
                        aria-label="Select row"
                      />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        {avatarField && (
                          <Avatar className="rounded-sm">
                            {avatarField.getUrl(row) && (
                              <AvatarImage src={avatarField.getUrl(row)} alt="" />
                            )}
                            <AvatarFallback className="text-xs">
                              {avatarField.getFallback(row)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="font-medium">{titleColumn.render(row)}</div>
                      </div>
                    </TableCell>
                    {numericField && (
                      <TableCell className="py-3.5 font-medium">
                        {numericField.getValue(row)}
                      </TableCell>
                    )}
                    {statusField && (
                      <TableCell className="py-3.5">
                        <Badge
                          className={cn(
                            "border-none",
                            statusField.badgeClassName?.(statusField.getValue(row)),
                          )}
                        >
                          {statusField.getValue(row)}
                        </Badge>
                      </TableCell>
                    )}
                    {extraColumns.map((col) => (
                      <TableCell key={col.key} className="py-3.5 text-muted-foreground">
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnCount + 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
