import { useMemo, useState, useLayoutEffect, useCallback, useRef, useEffect } from "react";
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
}

interface ActiveCell {
  rowId: string;
  column: string;
}

// ----------------- Shared helpers for column analysis -----------------

export type ColumnTypeCounts = {
  numeric: number;
  categorical: number;
  freeText: number;
  other: number;
};

export type ColumnTypeLabel = "Numeric" | "Categorical" | "Free Text" | "Other";

export interface ColumnSummary {
  columnName: string;
  type: ColumnTypeLabel;
  missing: number;
  missingPercent: number;
  uniqueValues: number;
}

const looksNumeric = (value: string) => {
  const s = value.trim().replace(",", ".");
  if (!s) return false;
  return /^-?\d+(\.\d+)?$/.test(s);
};

/**
 * Detect typical date, datetime and time formats.
 */
const looksDateTime = (value: string) => {
  const s = value.trim();
  if (!s) return false;

  if (!/\d/.test(s) || !/[\/:\-\sT]/.test(s)) return false;

  const lower = s.toLowerCase();

  const isoYMD =
    /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/;

  const dmy =
    /^\d{1,2}[-/]\d{1,2}[-/]\d{4}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/;

  const timeOnly = /^\d{1,2}:\d{2}(?::\d{2})?\s*(am|pm)?$/i;

  if (isoYMD.test(s) || dmy.test(s) || timeOnly.test(lower)) return true;

  const t = Date.parse(s);
  return !Number.isNaN(t);
};

const isLongText = (value: string) => value.trim().length > 25;

/**
 * Per-column summary: type + missing + unique values.
 */
export function inferColumnSummaries(
  columns: string[],
  rows: Array<Record<string, string>>
): ColumnSummary[] {
  if (!columns.length) return [];

  const totalRows = rows.length;

  return columns.map((colName) => {
    let missing = 0;
    let nonEmpty = 0;
    let numericLike = 0;
    let dateLike = 0;
    let longTextLike = 0;
    const uniques = new Set<string>();

    for (const row of rows) {
      const rawVal = row?.[colName];

      if (rawVal === null || rawVal === undefined) {
        missing += 1;
        continue;
      }

      const val = String(rawVal);
      const trimmed = val.trim();

      if (!trimmed) {
        missing += 1;
        continue;
      }

      nonEmpty += 1;
      uniques.add(trimmed);

      if (looksNumeric(trimmed)) {
        numericLike += 1;
      } else if (looksDateTime(trimmed)) {
        dateLike += 1;
      }

      if (isLongText(trimmed)) {
        longTextLike += 1;
      }
    }

    let type: ColumnTypeLabel;

    if (nonEmpty === 0) {
      type = "Categorical";
    } else {
      const numericRatio = numericLike / nonEmpty;
      const dateRatio = dateLike / nonEmpty;
      const longRatio = longTextLike / nonEmpty;

      if (dateRatio >= 0.6) {
        type = "Other";
      } else if (numericRatio >= 0.6) {
        type = "Numeric";
      } else if (longRatio >= 0.6) {
        type = "Free Text";
      } else {
        type = "Categorical";
      }
    }

    const missingPercent = totalRows > 0 ? (missing / totalRows) * 100 : 0;

    return {
      columnName: colName,
      type,
      missing,
      missingPercent,
      uniqueValues: uniques.size,
    };
  });
}

/**
 * Aggregate counts of each type from the column summaries.
 * "Other" includes date, time, timestamp columns.
 */
export function inferColumnTypeCounts(
  columns: string[],
  rows: Array<Record<string, string>>
): ColumnTypeCounts {
  if (!columns.length || !rows.length) {
    return { numeric: 0, categorical: 0, freeText: 0, other: 0 };
  }

  const summaries = inferColumnSummaries(columns, rows);

  return summaries.reduce<ColumnTypeCounts>(
    (acc, s) => {
      switch (s.type) {
        case "Numeric":
          acc.numeric += 1;
          break;
        case "Free Text":
          acc.freeText += 1;
          break;
        case "Other":
          acc.other += 1;
          break;
        case "Categorical":
        default:
          acc.categorical += 1;
          break;
      }
      return acc;
    },
    { numeric: 0, categorical: 0, freeText: 0, other: 0 }
  );
}

// ----------------- Main DataTable component -----------------

const MIN_COL_WIDTH = 80;

export function DataTable({ columns, rows }: DataTableProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const cellInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const { applyEdit, pendingEdits, startEditing } = useFileStore();

  // ---------- Detect long-text columns for initial width ----------

  const isLongTextColumn = useCallback(
    (columnName: string, sampleRows: Array<Record<string, string>>) => {
      const sampleValues = sampleRows
        .slice(0, 50)
        .map((row) => row[columnName])
        .filter(
          (val) =>
            val !== null && val !== undefined && String(val).trim() !== ""
        );
      if (sampleValues.length === 0) return false;

      const longCount = sampleValues.filter((val) =>
        isLongText(String(val))
      ).length;

      return longCount / sampleValues.length >= 0.5;
    },
    []
  );

  const longTextColumns = useMemo(() => {
    const set = new Set<string>();
    columns.forEach((col) => {
      if (isLongTextColumn(col, rows)) {
        set.add(col);
      }
    });
    return set;
  }, [columns, rows, isLongTextColumn]);

  const defaultWidths = useMemo(() => {
    const map: Record<string, number> = {};
    columns.forEach((col) => {
      map[col] = longTextColumns.has(col) ? 320 : 150;
    });
    return map;
  }, [columns, longTextColumns]);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    defaultWidths
  );

  // Reset widths when columns change
  useEffect(() => {
    setColumnWidths(defaultWidths);
  }, [defaultWidths]);

  // ---------- Resizing logic (Excel-style drag) ----------

  const resizingColRef = useRef<string | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const col = resizingColRef.current;
      if (!col) return;

      const delta = event.clientX - startXRef.current;
      const newWidth = Math.max(
        MIN_COL_WIDTH,
        startWidthRef.current + delta
      );

      setColumnWidths((prev) => ({
        ...prev,
        [col]: newWidth,
      }));
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    resizingColRef.current = null;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const startResize = (colId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColRef.current = colId;
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidths[colId] ?? 150;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    // cleanup in case component unmounts mid-resize
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ---------- Editing logic ----------

  const saveCurrentEdit = useCallback(() => {
    if (activeCell && editValue !== undefined) {
      applyEdit(activeCell.rowId, activeCell.column, editValue);
    }
  }, [activeCell, editValue, applyEdit]);

  const handleCellDoubleClick = useCallback(
    (rowId: string, column: string, currentValue: string) => {
      if (column === "id") return;

      if (activeCell) {
        saveCurrentEdit();
      }

      setActiveCell({ rowId, column });
      setEditValue(currentValue);
      startEditing(rowId, column, currentValue);
    },
    [activeCell, saveCurrentEdit, startEditing]
  );

  useLayoutEffect(() => {
    if (activeCell) {
      const cellKey = `${activeCell.rowId}:${activeCell.column}`;
      const inputElement = cellInputRefs.current.get(cellKey);

      if (inputElement) {
        const len = inputElement.value.length;
        inputElement.setSelectionRange(0, len);
        setTimeout(() => {
          if (document.activeElement === inputElement) {
            inputElement.setSelectionRange(len, len);
          }
        }, 0);
      }
    }
  }, [activeCell]);

  const saveEdit = useCallback(() => {
    if (activeCell) {
      applyEdit(activeCell.rowId, activeCell.column, editValue);
      setActiveCell(null);
      setEditValue("");
    }
  }, [activeCell, editValue, applyEdit]);

  const cancelEdit = useCallback(() => {
    setActiveCell(null);
    setEditValue("");
  }, []);

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [saveEdit, cancelEdit]
  );

  const setInputRef = useCallback(
    (element: HTMLInputElement | null, cellKey: string) => {
      if (element) {
        cellInputRefs.current.set(cellKey, element);
      } else {
        cellInputRefs.current.delete(cellKey);
      }
    },
    []
  );

  const getCellValue = (row: Record<string, string>, column: string): string => {
    const rowId = row.id || "";
    const pendingChange = pendingEdits.get(rowId)?.[column];
    return pendingChange !== undefined ? pendingChange : row[column] || "";
  };

  // Helper: numeric column detection
  const isNumericColumn = useCallback(
    (columnName: string, sampleRows: Array<Record<string, string>>) => {
      if (columnName === "id") return true;

      const sampleValues = sampleRows
        .slice(0, 10)
        .map((row) => row[columnName])
        .filter((val) => val && String(val).trim() !== "");

      if (sampleValues.length === 0) return false;

      const numericCount = sampleValues.filter(
        (val) => !isNaN(Number(val))
      ).length;
      return numericCount / sampleValues.length > 0.8;
    },
    []
  );

  // ----------------- columns -> ColumnDef -----------------

  const columnDefs = useMemo<ColumnDef<Record<string, string>>[]>(
    () =>
      columns.map((col) => {
        const isNumeric = isNumericColumn(col, rows);
        const colWidth = columnWidths[col] ?? 150;

        return {
          accessorKey: col,
          header: ({ column }) => {
            return (
              <div
                className="relative flex h-full w-full items-center"
                style={{ width: colWidth }}
              >
                <Button
                  variant="ghost"
                  onClick={() =>
                    column.toggleSorting(column.getIsSorted() === "asc")
                  }
                  className="flex h-8 min-w-0 flex-1 items-center justify-between px-2 text-xs lg:px-3"
                  title={col}
                >
                  <span className="truncate">{col}</span>
                  {column.getIsSorted() === "asc" ? (
                    <ArrowUp className="ml-1 h-3 w-3 flex-shrink-0" />
                  ) : column.getIsSorted() === "desc" ? (
                    <ArrowDown className="ml-1 h-3 w-3 flex-shrink-0" />
                  ) : (
                    <ArrowUpDown className="ml-1 h-3 w-3 flex-shrink-0" />
                  )}
                </Button>

                {/* resize handle */}
                <div
                  onMouseDown={(e) => startResize(col, e)}
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none bg-transparent hover:bg-slate-300"
                />
              </div>
            );
          },
          sortingFn: isNumeric
            ? (rowA, rowB, columnId) => {
                const aVal = rowA.getValue(columnId) as string;
                const bVal = rowB.getValue(columnId) as string;
                const aNum = Number(aVal);
                const bNum = Number(bVal);

                if (isNaN(aNum) && isNaN(bNum)) return 0;
                if (isNaN(aNum)) return 1;
                if (isNaN(bNum)) return -1;

                return aNum - bNum;
              }
            : "alphanumeric",
          cell: (info) => {
            const row = info.row.original;
            const rowId = row.id || "";
            const columnId = info.column.id;
            const value = getCellValue(row, columnId);
            const cellKey = `${rowId}:${columnId}`;
            const isEditing =
              activeCell?.rowId === rowId && activeCell?.column === columnId;
            const hasEdit = pendingEdits.get(rowId)?.[columnId] !== undefined;
            const isIdColumn = columnId === "id";

            if (isEditing && !isIdColumn) {
              return (
                <Input
                  key={cellKey}
                  ref={(el) => setInputRef(el, cellKey)}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleCellKeyDown}
                  className="h-8 w-full text-xs"
                  autoFocus
                />
              );
            }

            return (
              <div
                onDoubleClick={() =>
                  !isIdColumn && handleCellDoubleClick(rowId, columnId, value)
                }
                className={`flex h-full w-full items-center p-2 text-xs leading-tight overflow-hidden text-ellipsis whitespace-nowrap ${
                  !isIdColumn
                    ? "cursor-pointer hover:bg-muted/50"
                    : "cursor-default"
                } ${
                  hasEdit ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
                } ${isIdColumn ? "opacity-60" : ""}`}
                title={value}
                style={{ width: colWidth }}
              >
                {value}
              </div>
            );
          },
          size: colWidth,
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
      columnWidths,
    ]
  );

  // ---------- react-table + row virtualiser ----------

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

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 53,
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalRowSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalRowSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;

  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="rounded-md border">
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  const totalTableWidth = columns.reduce(
    (sum, col) => sum + (columnWidths[col] ?? 150),
    0
  );

  return (
    <div className="rounded-md border">
      <div
        ref={tableContainerRef}
        className="relative h-[600px] overflow-auto"
      >
        {/* Sticky header */}
        <div
          className="sticky top-0 z-20 flex border-b bg-background"
          style={{ width: totalTableWidth }}
        >
          {table.getHeaderGroups().map((headerGroup) =>
            headerGroup.headers.map((header) => {
              const w = columnWidths[header.column.id] ?? 150;
              return (
                <div
                  key={header.id}
                  className="border-r"
                  style={{ width: w }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </div>
              );
            })
          )}
        </div>

        {/* Body (virtualised rows) */}
        <div style={{ height: totalRowSize, width: totalTableWidth }}>
          {paddingTop > 0 && <div style={{ height: paddingTop }} />}
          {virtualRows.map((virtualRow) => {
            const row = tableRows[virtualRow.index];
            if (!row) return null;

            return (
              <div
                key={virtualRow.key}
                className="flex border-b transition-colors hover:bg-muted/50"
                style={{ height: virtualRow.size }}
              >
                {row.getVisibleCells().map((cell) => {
                  const w = columnWidths[cell.column.id] ?? 150;
                  return (
                    <div
                      key={cell.id}
                      className="border-r"
                      style={{ width: w }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {paddingBottom > 0 && <div style={{ height: paddingBottom }} />}
        </div>
      </div>
    </div>
  );
}
