/**
 * Generic filterable/selectable data table: text search, min/max numeric
 * range filters, a select filter, row + select-all checkboxes (tri-state),
 * and a status badge column. Rows are typed via `T`; callers supply column
 * accessors so this has no dependency on any specific data model.
 */
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  sortValue?: (row: T) => string | number;
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
  titleColumn: {
    header: string;
    render: (row: T) => React.ReactNode;
    sortValue?: (row: T) => string | number;
  };
  extraColumns?: FilterableDataTableColumn<T>[];
  pageSize?: number;
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
  pageSize = 10,
  className,
}: FilterableDataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState("__title");
  const [sortDirection, setSortDirection] = useState<"ascending" | "descending">("ascending");
  const [page, setPage] = useState(1);

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

  const sorted = useMemo(() => {
    const valueFor = (row: T): string | number => {
      if (sortKey === "__title") return titleColumn.sortValue?.(row) ?? searchableText(row);
      if (sortKey === "__numeric") return numericField?.getValue(row) ?? 0;
      if (sortKey === "__status") return statusField?.getValue(row) ?? "";
      return extraColumns.find((column) => column.key === sortKey)?.sortValue?.(row) ?? "";
    };

    return [...filtered].sort((firstRow, secondRow) => {
      const first = valueFor(firstRow);
      const second = valueFor(secondRow);
      const result =
        typeof first === "number" && typeof second === "number"
          ? first - second
          : String(first).localeCompare(String(second), undefined, {
              numeric: true,
              sensitivity: "base",
            });
      return sortDirection === "descending" ? -result : result;
    });
  }, [
    extraColumns,
    filtered,
    numericField,
    searchableText,
    sortDirection,
    sortKey,
    statusField,
    titleColumn,
  ]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = pageRows.map(getId);
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

  function changeSort(key: string) {
    if (key === sortKey) {
      setSortDirection((current) => (current === "ascending" ? "descending" : "ascending"));
    } else {
      setSortKey(key);
      setSortDirection("ascending");
    }
    setPage(1);
  }

  function sortButton(key: string, label: string) {
    const active = sortKey === key;
    const Icon = active ? (sortDirection === "ascending" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button
        type="button"
        onClick={() => changeSort(key)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-md text-left outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
        <span className="sr-only">
          {active
            ? `Sorted ${sortDirection}. Activate to reverse order.`
            : "Activate to sort this column."}
        </span>
      </button>
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
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
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
                  onChange={(e) => {
                    setMinValue(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Min"
                  type="number"
                />
                <Input
                  className="-ms-px h-10 rounded-l-none border-border/60"
                  value={maxValue}
                  onChange={(e) => {
                    setMaxValue(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Max"
                  type="number"
                />
              </div>
            </div>
          )}
          {statusField && (
            <div className="space-y-2">
              <Label htmlFor="table-status">{statusField.label}</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
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
              <TableHead
                aria-sort={sortKey === "__title" ? sortDirection : "none"}
                className="h-12 border-b border-dashed border-border/60 bg-transparent text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                {sortButton("__title", titleColumn.header)}
              </TableHead>
              {numericField && (
                <TableHead
                  aria-sort={sortKey === "__numeric" ? sortDirection : "none"}
                  className="h-12 border-b border-dashed border-border/60 bg-transparent text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {sortButton("__numeric", numericField.label)}
                </TableHead>
              )}
              {statusField && (
                <TableHead
                  aria-sort={sortKey === "__status" ? sortDirection : "none"}
                  className="h-12 border-b border-dashed border-border/60 bg-transparent text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {sortButton("__status", statusField.label)}
                </TableHead>
              )}
              {extraColumns.map((col) => (
                <TableHead
                  key={col.key}
                  aria-sort={col.sortValue && sortKey === col.key ? sortDirection : undefined}
                  className="h-12 border-b border-dashed border-border/60 bg-transparent text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {col.sortValue ? sortButton(col.key, col.header) : col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length > 0 ? (
              pageRows.map((row) => {
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
        {sorted.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="type-meta text-muted-foreground" aria-live="polite">
              Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)}{" "}
              of {sorted.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={safePage <= 1}
                onClick={() => setPage(Math.max(1, safePage - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <span className="min-w-20 text-center type-meta font-medium tabular-nums">
                {safePage} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={safePage >= totalPages}
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
