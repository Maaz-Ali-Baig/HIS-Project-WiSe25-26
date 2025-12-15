import { useMemo, useState, useLayoutEffect, useCallback, useRef } from "react";
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
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useFileStore } from "../store/fileStore";

interface DataTableProps {
  columns: string[];
  rows: Array<Record<string, string>>;
  readOnly?: boolean;
}

interface ActiveCell {
  rowId: string;
  column: string;
}

export function DataTable({ columns, rows, readOnly = false }: DataTableProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const cellInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const { applyEdit, pendingEdits, startEditing } = useFileStore();

  // Save current edit before opening a new one
  const saveCurrentEdit = useCallback(() => {
    if (activeCell && editValue !== undefined) {
      console.log("💾 Saving edit:", { ...activeCell, editValue });
      applyEdit(activeCell.rowId, activeCell.column, editValue);
    }
  }, [activeCell, editValue, applyEdit]);

  const handleCellDoubleClick = useCallback(
    (rowId: string, column: string, currentValue: string) => {
      // Ignore double-clicks when in read-only mode
      if (readOnly) {
        return;
      }

      // Ignore double-clicks on the id column
      if (column === "id") {
        console.log("🚫 Cannot edit id column");
        return;
      }

      console.log("🖱️ Double click:", { rowId, column, currentValue });

      // Save current edit if any
      if (activeCell) {
        saveCurrentEdit();
      }

      // Start editing the new cell
      setActiveCell({ rowId, column });
      setEditValue(currentValue);
      startEditing(rowId, column, currentValue);
    },
    [readOnly, activeCell, saveCurrentEdit, startEditing],
  );

  // Select text when input is mounted (autoFocus handles initial focus)
  useLayoutEffect(() => {
    if (activeCell) {
      const cellKey = `${activeCell.rowId}:${activeCell.column}`;
      const inputElement = cellInputRefs.current.get(cellKey);

      if (inputElement) {
        // Select all text on mount
        const len = inputElement.value.length;
        inputElement.setSelectionRange(0, len);
        // Move caret to end after selection
        setTimeout(() => {
          if (document.activeElement === inputElement) {
            inputElement.setSelectionRange(len, len);
          }
        }, 0);
      }
    }
  }, [activeCell]); // Only run when activeCell changes, not on every editValue change

  const saveEdit = useCallback(() => {
    if (activeCell) {
      console.log("💾 Finalizing edit:", { ...activeCell, editValue });
      applyEdit(activeCell.rowId, activeCell.column, editValue);
      setActiveCell(null);
      setEditValue("");
    }
  }, [activeCell, editValue, applyEdit]);

  const cancelEdit = useCallback(() => {
    console.log("❌ Canceling edit");
    setActiveCell(null);
    setEditValue("");
  }, []);

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveEdit(); // Save but don't advance to another cell
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [saveEdit, cancelEdit],
  );

  // Callback ref to store input element references
  const setInputRef = useCallback(
    (element: HTMLInputElement | null, cellKey: string) => {
      if (element) {
        cellInputRefs.current.set(cellKey, element);
      } else {
        cellInputRefs.current.delete(cellKey);
      }
    },
    [],
  );

  const getCellValue = (
    row: Record<string, string>,
    column: string,
  ): string => {
    const rowId = row.id || "";
    const pendingChange = pendingEdits.get(rowId)?.[column];
    return pendingChange !== undefined ? pendingChange : row[column] || "";
  };

  // Helper function to check if a string is numeric
  const isNumericColumn = useCallback(
    (columnName: string, sampleRows: Array<Record<string, string>>) => {
      // Always treat 'id' column as numeric
      if (columnName === "id") return true;

      // Check first few non-empty values to determine if column is numeric
      const sampleValues = sampleRows
        .slice(0, 10)
        .map((row) => row[columnName])
        .filter((val) => val && val.trim() !== "");

      if (sampleValues.length === 0) return false;

      // If more than 80% of values are numeric, treat as numeric column
      const numericCount = sampleValues.filter(
        (val) => !isNaN(Number(val)),
      ).length;
      return numericCount / sampleValues.length > 0.8;
    },
    [],
  );

  // Convert columns to TanStack Table ColumnDef format
  const columnDefs = useMemo<ColumnDef<Record<string, string>>[]>(
    () =>
      columns.map((col) => {
        const isNumeric = isNumericColumn(col, rows);

        return {
          accessorKey: col,
          header: ({ column }) => {
            return (
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
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
          sortingFn: isNumeric
            ? (rowA, rowB, columnId) => {
                // Custom numeric sorting
                const aVal = rowA.getValue(columnId) as string;
                const bVal = rowB.getValue(columnId) as string;
                const aNum = Number(aVal);
                const bNum = Number(bVal);

                // Handle NaN values (put them at the end)
                if (isNaN(aNum) && isNaN(bNum)) return 0;
                if (isNaN(aNum)) return 1;
                if (isNaN(bNum)) return -1;

                return aNum - bNum;
              }
            : "alphanumeric", // Use default string sorting for non-numeric columns
          cell: (info) => {
            const row = info.row.original;
            const rowId = row.id || "";
            const column = info.column.id;
            const value = getCellValue(row, column);
            const cellKey = `${rowId}:${column}`;
            const isEditing =
              activeCell?.rowId === rowId && activeCell?.column === column;
            const hasEdit = pendingEdits.get(rowId)?.[column] !== undefined;
            const isIdColumn = column === "id";

            if (isEditing && !isIdColumn) {
              return (
                <Input
                  key={cellKey}
                  ref={(el) => setInputRef(el, cellKey)}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleCellKeyDown}
                  className="h-8 w-full"
                  autoFocus
                />
              );
            }

            return (
              <div
                onDoubleClick={() =>
                  !isIdColumn &&
                  !readOnly &&
                  handleCellDoubleClick(rowId, column, value)
                }
                className={`w-full h-full flex items-center p-4 ${
                  !isIdColumn && !readOnly
                    ? "cursor-pointer hover:bg-muted/50"
                    : "cursor-default"
                } ${hasEdit ? "bg-yellow-50 dark:bg-yellow-900/20" : ""} ${
                  isIdColumn ? "opacity-60" : ""
                }`}
                title={
                  readOnly
                    ? "Read-only view"
                    : isIdColumn
                      ? "ID column (read-only)"
                      : "Double-click to edit"
                }
              >
                {value}
              </div>
            );
          },
          size: 150,
          enableSorting: true,
          enableColumnFilter: true,
        };
      }),
    [
      columns,
      rows,
      activeCell,
      editValue,
      pendingEdits,
      handleCellDoubleClick,
      saveEdit,
      handleCellKeyDown,
      setInputRef,
      isNumericColumn,
    ],
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
  const paddingLeft =
    virtualColumns.length > 0 ? virtualColumns[0]?.start || 0 : 0;
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
    <div className="rounded-md border max-h-[calc(100vh-100px)] flex flex-col">
      <div ref={tableContainerRef} className="flex-1 overflow-auto relative">
        {/* Table container with fixed total size */}
        <div
          style={{
            height: `${totalRowSize + 50}px`,
            width: `${totalColumnSize}px`,
          }}
        >
          {/* Sticky header */}
          <div
            className="sticky top-0 bg-background z-2 border-b"
            style={{ display: "flex" }}
          >
            {paddingLeft > 0 && <div style={{ width: `${paddingLeft}px` }} />}
            {virtualColumns.map((virtualColumn) => {
              const header =
                table.getHeaderGroups()[0]?.headers[virtualColumn.index];
              return (
                <div
                  key={virtualColumn.key}
                  className="text-left align-middle border-r"
                  style={{
                    width: `${virtualColumn.size}px`,
                  }}
                >
                  {header &&
                    flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
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
                  {paddingLeft > 0 && (
                    <div style={{ width: `${paddingLeft}px` }} />
                  )}
                  {virtualColumns.map((virtualColumn) => {
                    const cell = row.getVisibleCells()[virtualColumn.index];
                    return (
                      <div
                        key={virtualColumn.key}
                        className="align-middle flex items-center border-r"
                        style={{
                          width: `${virtualColumn.size}px`,
                        }}
                      >
                        {cell &&
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                      </div>
                    );
                  })}
                  {paddingRight > 0 && (
                    <div style={{ width: `${paddingRight}px` }} />
                  )}
                </div>
              );
            })}
            {paddingBottom > 0 && (
              <div style={{ height: `${paddingBottom}px` }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
