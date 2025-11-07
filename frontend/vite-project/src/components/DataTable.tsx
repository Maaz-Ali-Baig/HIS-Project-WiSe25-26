import { useRef, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

interface DataTableProps {
  columns: string[];
  rows: Array<Record<string, string>>;
}

export function DataTable({ columns, rows }: DataTableProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Convert columns to TanStack Table ColumnDef format
  const columnDefs = useMemo<ColumnDef<Record<string, string>>[]>(
    () =>
      columns.map((col) => ({
        accessorKey: col,
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-8 px-2 lg:px-3"
            >
              {col}
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </Button>
          );
        },
        cell: (info) => info.getValue() as string,
        size: 150,
        enableSorting: true,
        enableColumnFilter: true,
      })),
    [columns]
  );

  // Initialize table
  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  const { rows: tableRows } = table.getRowModel();

  // Row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 53, // Fixed row height
    overscan: 5,
  });

  // Column virtualizer
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columns.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 150, // Fixed column width
    overscan: 3,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  const totalRowSize = rowVirtualizer.getTotalSize();
  const totalColumnSize = columnVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalRowSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;
  const paddingLeft = virtualColumns.length > 0 ? virtualColumns[0]?.start || 0 : 0;
  const paddingRight =
    virtualColumns.length > 0
      ? totalColumnSize - (virtualColumns[virtualColumns.length - 1]?.end || 0)
      : 0;

  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="rounded-md border">
        <div className="h-24 flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <div
        ref={tableContainerRef}
        className="h-[600px] overflow-auto relative"
      >
        {/* Table container with fixed total size */}
        <div style={{ height: `${totalRowSize}px`, width: `${totalColumnSize}px` }}>
          {/* Sticky header */}
          <div
            className="sticky top-0 z-20 bg-background border-b"
            style={{ display: "flex" }}
          >
            {paddingLeft > 0 && <div style={{ width: `${paddingLeft}px` }} />}
            {virtualColumns.map((virtualColumn) => {
              const header = table.getHeaderGroups()[0]?.headers[virtualColumn.index];
              return (
                <div
                  key={virtualColumn.key}
                  className="text-left align-middle border-r"
                  style={{
                    width: `${virtualColumn.size}px`,
                  }}
                >
                  {header && flexRender(header.column.columnDef.header, header.getContext())}
                </div>
              );
            })}
            {paddingRight > 0 && <div style={{ width: `${paddingRight}px` }} />}
          </div>

          {/* Virtual rows */}
          <div>
            {paddingTop > 0 && <div style={{ height: `${paddingTop}px` }} />}
            {virtualRows.map((virtualRow) => {
              const row = tableRows[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  key={virtualRow.key}
                  className="border-b transition-colors hover:bg-muted/50"
                  style={{
                    display: "flex",
                    height: `${virtualRow.size}px`,
                  }}
                >
                  {paddingLeft > 0 && <div style={{ width: `${paddingLeft}px` }} />}
                  {virtualColumns.map((virtualColumn) => {
                    const cell = row.getVisibleCells()[virtualColumn.index];
                    return (
                      <div
                        key={virtualColumn.key}
                        className="p-4 align-middle flex items-center border-r"
                        style={{
                          width: `${virtualColumn.size}px`,
                        }}
                      >
                        {cell && flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    );
                  })}
                  {paddingRight > 0 && <div style={{ width: `${paddingRight}px` }} />}
                </div>
              );
            })}
            {paddingBottom > 0 && <div style={{ height: `${paddingBottom}px` }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
