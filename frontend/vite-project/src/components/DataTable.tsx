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
  modifiedCells?: Array<{ rowId: string; column: string }>;
}

interface ActiveCell {
  rowId: string;
  column: string;
}

export function DataTable({ columns, rows, readOnly = false, modifiedCells = [] }: DataTableProps) {
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

  // Calculate dynamic column width based on content
  const calculateColumnWidth = useCallback(
    (columnName: string, sampleRows: Array<Record<string, string>>) => {
      // Get max length from column name and sample values
      const headerLength = columnName.length;
      const maxContentLength = Math.max(
        ...sampleRows.slice(0, 50).map((row) => {
          const value = row[columnName] || "";
          return value.length;
        }),
        0
      );
      
      const maxLength = Math.max(headerLength, maxContentLength);
      // Calculate width to ensure column name fits completely
      // 9px per character for column name + 40px for padding/icon, min 120px, max 400px
      const nameWidth = headerLength * 9 + 40;
      const contentWidth = maxLength * 8;
      return Math.min(Math.max(nameWidth, contentWidth, 120), 400);
    },
    []
  );

  // Convert columns to TanStack Table ColumnDef format
  const columnDefs = useMemo<ColumnDef<Record<string, string>>[]>(
    () =>
      columns.map((col) => {
        const isNumeric = isNumericColumn(col, rows);
        const columnWidth = calculateColumnWidth(col, rows);

        return {
          id: col,
          accessorKey: col,
          header: ({ column }) => {
            return (
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
                className="h-7 px-2 lg:px-3 w-full justify-start text-[11px]"
                title={col}
              >
                <span className="truncate flex-1 text-left">
                  {col}
                </span>
                <span className="flex-shrink-0 ml-1">
                  {column.getIsSorted() === "asc" ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : column.getIsSorted() === "desc" ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3" />
                  )}
                </span>
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
                  className="h-7 w-full text-[11px]"
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
                className={`w-full h-full flex items-center px-2 ${
                  !isIdColumn && !readOnly
                    ? "cursor-pointer hover:bg-muted/50"
                    : "cursor-default"
                } ${
                  isIdColumn ? "opacity-60" : ""
                }`}
                title={value}
              >
                <span className="truncate w-full text-[11px]">
                  {value}
                </span>
              </div>
            );
          },
          size: columnWidth,
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
      readOnly,
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
  const leafHeaders = table.getFlatHeaders();

  // Row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40, // Fixed row height
    overscan: 5,
  });

  // Column virtualizer
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columns.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: (index) => columnDefs[index]?.size || 100,
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
    <div className="h-full flex flex-col overflow-hidden">
      <div ref={tableContainerRef} className="flex-1 overflow-auto">
        {/* Table container with fixed total size */}
        <div
          style={{
            height: `${totalRowSize + 50}px`,
            width: `${totalColumnSize}px`,
            minWidth: '100%'
          }}
        >
          {/* Sticky header */}
          <div
            className="sticky top-0 bg-background z-2 border-b"
            style={{ display: "flex" }}
          >
            {paddingLeft > 0 && <div style={{ width: `${paddingLeft}px` }} />}
            {virtualColumns.map((virtualColumn) => {
              const header = leafHeaders[virtualColumn.index];
              return (
                <div
                  key={virtualColumn.key}
                  className="text-left align-middle border-r overflow-hidden"
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
                        className="align-middle flex items-center border-r overflow-hidden"
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
